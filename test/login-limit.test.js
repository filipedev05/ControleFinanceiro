import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoginLimit} from '../login-limit.js';
function fixture(){let time=1000;const data=new Map();const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};return {storage,now:()=>time,advance:ms=>time+=ms};}
test('bloqueia na terceira falha e persiste entre instâncias do navegador',()=>{
 const f=fixture(),limit=createLoginLimit(f.storage,f.now);
 assert.equal(limit.fail().blocked,false);assert.equal(limit.fail().blocked,false);
 assert.equal(limit.fail().blocked,true);
 assert.equal(createLoginLimit(f.storage,f.now).status().blocked,true);
 assert.equal(limit.fail().attempts,3);
 f.advance(15*60*1000);
 assert.equal(limit.status().blocked,false);assert.equal(limit.status().attempts,0);
});
test('sucesso limpa limite e falhas antigas expiram',()=>{
 const f=fixture(),limit=createLoginLimit(f.storage,f.now);
 limit.fail();limit.fail();limit.reset();assert.equal(limit.status().attempts,0);
 limit.fail();f.advance(15*60*1000);assert.equal(limit.fail().attempts,1);
});
test('continua funcionando se armazenamento não estiver disponível',()=>{
 const limit=createLoginLimit(null,()=>1000);
 limit.fail();limit.fail();assert.equal(limit.fail().blocked,true);
 limit.reset();assert.equal(limit.status().blocked,false);
});
