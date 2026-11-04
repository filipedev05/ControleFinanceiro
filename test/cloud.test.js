import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloud} from '../cloud.js';
const config={url:'https://example.supabase.co',publishableKey:'sb_publishable_example'};
const session={access_token:'access',refresh_token:'refresh',expires_in:3600,user:{id:'user-a',email:'a@example.com'}};
const reply=(value,status=200)=>new Response(value===null?null:JSON.stringify(value),{status});
test('rejeita configuração ausente e chaves privilegiadas',()=>{
 assert.throws(()=>createCloud({url:'',publishableKey:''}));
 assert.throws(()=>createCloud({...config,publishableKey:'sb_secret_example'}));
 const payload=btoa(JSON.stringify({role:'service_role'}));
 assert.throws(()=>createCloud({...config,publishableKey:`eyJ.${payload}.sig`}));
});
test('não consulta registros sem sessão',async()=>{
 const cloud=createCloud(config,()=>{throw new Error('não deveria chamar a rede');});
 await assert.rejects(cloud.list(),/Entre/);
 await assert.rejects(cloud.insert([]),/Entre/);
});
test('login e inserção usam token do usuário e descartam dono enviado pelo arquivo',async()=>{
 const calls=[];
 const cloud=createCloud(config,async(url,options)=>{calls.push({url,options});return reply(url.includes('/token')?session:[]);});
 await cloud.login('a@example.com','senha');
 await cloud.insert([{id:'id',user_id:'user-b',description:'Salário',type:'income',amount:100,date:'2026-10-30',category:'Salário'}]);
 assert.equal(calls[1].options.headers.Authorization,'Bearer access');
 assert.equal(JSON.parse(calls[1].options.body)[0].user_id,'user-a');
 assert.equal(calls[1].options.headers.Prefer,'return=representation');
});
test('paginação carrega mais de um lote sem perder registros',async()=>{
 let pages=0;
 const cloud=createCloud(config,async(url)=>{
  if(url.includes('/token')) return reply(session);
  assert.ok(url.includes('user_id=eq.user-a'));
  assert.ok(url.includes(`offset=${pages*500}`));
  return reply(pages++===0?Array.from({length:500},(_,i)=>({id:i})):[{id:500}]);
 });
 await cloud.login('a','b'); assert.equal((await cloud.list()).length,501); assert.equal(pages,2);
});
test('renova token expirado antes de ler dados',async()=>{
 let tokens=0;
 const cloud=createCloud(config,async(url,options)=>{
  if(url.includes('grant_type=password')) return reply({...session,expires_in:1});
  if(url.includes('grant_type=refresh_token')) {tokens++;assert.equal(JSON.parse(options.body).refresh_token,'refresh');return reply({...session,access_token:'new'});}
  assert.equal(options.headers.Authorization,'Bearer new');return reply([]);
 });
 await cloud.login('a','b'); await cloud.list();assert.equal(tokens,1);
});
test('falha de rede não vira sucesso de salvamento',async()=>{
 const cloud=createCloud(config,async(url)=>{if(url.includes('/token'))return reply(session);throw new TypeError('network');});
 await cloud.login('a','b');await assert.rejects(cloud.insert([]),/conectar/);
});
test('401 limpa sessão e logout local funciona mesmo com falha na rede',async()=>{
 const cloud=createCloud(config,async(url)=>reply(url.includes('/token')?session:{},url.includes('/token')?200:401));
 await cloud.login('a','b');await assert.rejects(cloud.list(),/expirada/);assert.equal(cloud.user,null);
 await cloud.login('a','b');await assert.rejects(cloud.logout());assert.equal(cloud.user,null);
});
test('delete inclui dono e sinaliza registro inexistente',async()=>{
 const cloud=createCloud(config,async(url)=>{
  if(url.includes('/token'))return reply(session);
  assert.ok(url.includes('id=eq.entry-1&user_id=eq.user-a'));return reply([]);
 });
 await cloud.login('a','b');await assert.rejects(cloud.remove('entry-1'),/não encontrado/);
});
test('cadastro e recuperação usam URL de retorno e não exigem sessão prévia',async()=>{
 const calls=[];
 const cloud=createCloud(config,async(url,options)=>{calls.push({url,options});return reply({user:{id:'new'}});});
 assert.equal(await cloud.signup('a@example.com','password123','https://example.com/app/'),null);
 await cloud.recover('a@example.com','https://example.com/app/');
 assert.ok(calls[0].url.includes('/signup?redirect_to=https%3A%2F%2Fexample.com%2Fapp%2F'));
 assert.ok(calls[1].url.includes('/recover?redirect_to='));
 assert.equal(JSON.parse(calls[1].options.body).email,'a@example.com');
 assert.equal(cloud.user,null);
});
test('link de recuperação confirma o usuário antes de trocar senha',async()=>{
 const calls=[];
 const cloud=createCloud(config,async(url,options)=>{
  calls.push({url,options});return reply(options.method==='PUT'?{}:session.user);
 });
 await cloud.acceptLink('#access_token=link-token&refresh_token=refresh&expires_in=3600&type=recovery');
 assert.equal(cloud.user.id,'user-a');
 await cloud.updatePassword('new-password');
 assert.equal(calls[1].options.headers.Authorization,'Bearer link-token');
 assert.equal(JSON.parse(calls[1].options.body).password,'new-password');
});
test('edição exige sessão, filtra o dono e envia somente campos editáveis',async()=>{
 const calls=[];
 const entry={id:'entry-1',description:'Mercado corrigido',type:'expense',amount:2500,category:'Alimentação',date:'2026-11-02',user_id:'user-b'};
 const cloud=createCloud(config,async(url,options)=>{calls.push({url,options});return reply(url.includes('/token')?session:[entry]);});
 await assert.rejects(cloud.update(entry),/Entre/);
 assert.equal(calls.length,0);
 await cloud.login('a','b');
 assert.equal((await cloud.update(entry)).amount,2500);
 const {url,options}=calls[1];
 assert.ok(url.includes('id=eq.entry-1&user_id=eq.user-a'));
 assert.equal(options.method,'PATCH');
 assert.equal(options.headers.Authorization,'Bearer access');
 assert.equal(options.headers.Prefer,'return=representation');
 const body=JSON.parse(options.body);
 assert.equal(body.amount,2500);
 assert.equal(body.user_id,undefined);
 assert.equal(body.id,undefined);
});
test('edição não informa sucesso para registro ausente ou erro de permissão',async()=>{
 for(const status of [200,403]){
  const cloud=createCloud(config,async(url)=>url.includes('/token')?reply(session):reply([],status));
  await cloud.login('a','b');
  await assert.rejects(cloud.update({id:'missing'}),status===200?/não encontrado/:/Não foi possível/);
 }
});
test('somente credenciais inválidas recebem código para contar erro de senha',async()=>{
 for(const [code,status] of [['invalid_credentials',400],['email_not_confirmed',400],['over_request_rate_limit',429]]){
  const cloud=createCloud(config,async()=>reply({error_code:code},status));
  await assert.rejects(cloud.login('a','b'),error=>code==='invalid_credentials'?error.code==='invalid_credentials':error.code===undefined);
 }
 const cloud=createCloud(config,async()=>{throw new Error('network');});
 await assert.rejects(cloud.login('a','b'),error=>error.code===undefined);
});
test('metas exigem sessão e ignoram proprietário enviado pelo cliente',async()=>{
 const calls=[];
 const goal={id:'goal-1',title:'Viagem',kind:'saving',target_amount:100000,saved_amount:20000,start_month:'2026-11',end_month:'2027-06',category:'',description_filter:'',user_id:'user-b'};
 const cloud=createCloud(config,async(url,options)=>{calls.push({url,options});return reply(url.includes('/token')?session:[goal]);});
 await assert.rejects(cloud.listGoals(),/Entre/);
 await assert.rejects(cloud.saveGoal(goal),/Entre/);
 await assert.rejects(cloud.removeGoal(goal.id),/Entre/);
 await cloud.login('a','b');await cloud.saveGoal(goal);
 assert.equal(JSON.parse(calls[1].options.body).user_id,'user-a');
 await cloud.saveGoal(goal,true);
 const patch=calls[2];assert.equal(patch.options.method,'PATCH');assert.ok(patch.url.includes('id=eq.goal-1&user_id=eq.user-a'));
 assert.equal(JSON.parse(patch.options.body).user_id,undefined);
 assert.equal(JSON.parse(patch.options.body).id,undefined);
 await cloud.listGoals();assert.ok(calls[3].url.includes('user_id=eq.user-a'));
 await cloud.removeGoal(goal.id);assert.ok(calls[4].url.includes('user_id=eq.user-a'));assert.equal(calls[4].options.method,'DELETE');
});
test('metas não simulam sucesso ao receber retorno vazio ou falha',async()=>{
 const cloud=createCloud(config,async url=>reply(url.includes('/token')?session:[]));
 await cloud.login('a','b');
 await assert.rejects(cloud.saveGoal({id:'missing'},true),/não encontrada/);
 await assert.rejects(cloud.removeGoal('missing'),/não encontrada/);
});
test('paginação de metas lê lotes completos',async()=>{
 let pages=0;
 const cloud=createCloud(config,async url=>{
  if(url.includes('/token'))return reply(session);
  assert.ok(url.includes(`offset=${pages*500}`));
  return reply(pages++===0?Array.from({length:500},(_,i)=>({id:i})):[]);
 });
 await cloud.login('a','b');assert.equal((await cloud.listGoals()).length,500);assert.equal(pages,2);
});
