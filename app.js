import {categories, entryCategories, validateEntry, summarize, parseAmount, categoryTotals, monthlyEvolution} from './finance.js';
const $ = id => document.getElementById(id);
import {validateGoal, goalProgress, spendingAlerts} from './goals.js';
import {createCloud} from './cloud.js';
import {supabaseConfig} from './config.js';
import {createLoginLimit} from './login-limit.js';
let limitStorage;
try { limitStorage = localStorage; } catch { limitStorage = null; }
const loginLimit = createLoginLimit(limitStorage);
function updateLoginLimit() {
  const state = loginLimit.status();
  $('login-submit').disabled = busy || state.blocked;
  $('login-limit-message').textContent = state.blocked ? `Três tentativas incorretas. Tente novamente em ${Math.ceil(state.remaining / 60000)} minuto(s) ou use “Esqueci a senha”.` : state.attempts ? `E-mail ou senha incorretos. Restam ${3-state.attempts} tentativa(s).` : '';
}

let cloud;
let busy = false;
let ready = false;
let entries = [];
let goals = [];
let goalsReady = false;
let editingGoalId = null;
let editingId = null;
let chartType = 'expense';
const money = value => (value / 100).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const today = new Date();
const localDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
$('month').value = localDate.slice(0,7);
$('entry-form').elements.date.value = localDate;
function updateCategoryOptions(currentCategory = '') {
  const select = $('category');
  const previous = select.value;
  select.replaceChildren(...entryCategories($('entry-form').elements.type.value, currentCategory).map(c => new Option(c,c)));
  if ([...select.options].some(option => option.value === previous)) select.value = previous;
  if (currentCategory) select.value = currentCategory;
}
$('entry-form').elements.type.onchange = () => updateCategoryOptions();
updateCategoryOptions();
function notify(text) { $('message').textContent = text; }
function load(data) {
  if (!Array.isArray(data) || data.length > 10000) throw new Error('Backup inválido (limite de 10.000 registros).');
  const ids = new Set();
  return data.map(e => {
    if (!e || typeof e.id !== 'string' || ids.has(e.id)) throw new Error('Backup com identificadores inválidos.');
    ids.add(e.id);
    const v = validateEntry(e);
    return {id:v.id, description:v.description, amount:v.amount, type:v.type, category:v.category, date:v.date};
  });
}
function cloudMessage(text) { $('cloud-status').textContent = text; }
function authMessage(text) { $('auth-message').textContent = text; }
function showAuthScreen(screen, focus = true) {
  $('login-screen').hidden = screen !== 'login';
  $('signup-screen').hidden = screen !== 'signup';
  $('password-form').hidden = screen !== 'recovery';
  $('recover-screen').hidden = screen !== 'recover';
  $('password').value = '';
  $('signup-password').value = '';
  authMessage('');
  cloudMessage('');
  if (focus) $(screen === 'signup' ? 'signup-email' : screen === 'recovery' ? 'new-password' : screen === 'recover' ? 'recover-email' : 'email').focus();
}
$('show-signup').onclick = () => showAuthScreen('signup');
$('show-login').onclick = () => showAuthScreen('login');
function showAccount() {
  const logged = Boolean(cloud?.user);
  $('auth-panel').hidden = logged;
  $('dashboard').hidden = !logged;
  $('account').hidden = !logged;
  $('user-email').textContent = cloud?.user?.email || '';
}
async function refresh() {
  ready = false;
  cloudMessage('Carregando registros…');
  const next = await cloud.list();
  entries = next.map(validateEntry);
  ready = true;
  render();
  cloudMessage('Registros atualizados. Alterações são salvas na sua conta online.');
  await refreshGoals();
}
async function action(task) {
  if (busy) return;
  busy = true;
  notify('');
  const controls = [...document.querySelectorAll('button, input, select')];
  controls.forEach(c => c.disabled = true);
  try { await task(); }
  catch (error) {
    cloudMessage(error.message);
    authMessage(error.message);
    if (!cloud?.user) { resetGoalForm(); goals=[]; goalsReady=false; $('goals-status').textContent=''; resetEntryForm(); entries = []; ready = false; render(); showAccount(); }
  } finally { busy = false; controls.forEach(c => c.disabled = false); updateLoginLimit(); }
}
function render() {
  const monthly = entries.filter(e => e.date.startsWith($('month').value));
  const totals = summarize(monthly);
  for (const k of ['balance','income','expense']) $(k).textContent = money(totals[k]);
  const query = $('search').value.toLocaleLowerCase('pt-BR');
  const filtered = monthly.filter(e => `${e.description} ${e.category}`.toLocaleLowerCase('pt-BR').includes(query)).sort((a,b) => b.date.localeCompare(a.date));
  $('count').textContent = `${filtered.length} registro${filtered.length === 1 ? '' : 's'}`;
  $('entries').replaceChildren();
  if (!filtered.length) { const p = document.createElement('p'); p.className='empty'; p.textContent = 'Nenhuma movimentação encontrada. Adicione seu primeiro registro ou escolha outro período.'; $('entries').append(p); }
  for (const e of filtered) {
    const row = document.createElement('div'); row.className = 'transaction';
    const info = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = e.description;
    const detail = document.createElement('small'); detail.textContent = `${e.category} · ${e.date.split('-').reverse().join('/')}`;
    info.append(title,detail);
    const amount = document.createElement('strong'); amount.className = e.type === 'income' ? 'positive' : 'negative'; amount.textContent = `${e.type === 'income' ? '+' : '−'} ${money(e.amount)}`;
    const remove = document.createElement('button'); remove.className='delete'; remove.textContent='×'; remove.setAttribute('aria-label',`Excluir ${e.description}`);
    remove.onclick = () => { if (confirm(`Excluir “${e.description}”?`)) action(async () => { await cloud.remove(e.id); entries = entries.filter(item => item.id !== e.id); if (editingId === e.id) resetEntryForm(); render(); cloudMessage('Registro excluído.'); }); };
    const edit = document.createElement('button'); edit.type='button'; edit.textContent='Editar'; edit.className='edit-entry'; edit.setAttribute('aria-label',`Editar ${e.description}`);
    edit.onclick = () => {
      if (busy) return;
      editingId = e.id;
      const form = $('entry-form');
      for (const key of ['type','description','date']) form.elements[key].value = e[key];
      updateCategoryOptions(e.category);
      form.elements.amount.value = (e.amount / 100).toFixed(2).replace('.', ',');
      $('entry-title').textContent = 'Editar movimentação';
      $('save-entry').textContent = 'Salvar alterações';
      $('cancel-edit').hidden = false;
      notify('Altere os campos e clique em Salvar alterações.');
      form.scrollIntoView({behavior:'smooth', block:'center'});
      form.elements.description.focus({preventScroll:true});
    };
    row.append(info,amount,edit,remove); $('entries').append(row);
  }
  renderCharts(monthly);
  renderGoals();
}
function resetEntryForm() {
  editingId = null;
  $('entry-form').reset();
  updateCategoryOptions();
  $('entry-form').elements.date.value = localDate;
  $('entry-title').textContent = 'Nova movimentação';
  $('save-entry').textContent = '+ Adicionar movimentação';
  $('cancel-edit').hidden = true;
  notify('');
}
$('cancel-edit').onclick = resetEntryForm;
$('chart-expense').onclick = () => { chartType = 'expense'; render(); };
$('chart-income').onclick = () => { chartType = 'income'; render(); };
const chartColors = ['#216649','#427eb0','#ba7130','#805bb0','#b94f6d','#25818c','#7b7b29','#617586'];
function svgElement(name, attributes = {}, text) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value);
  if (text !== undefined) el.textContent = text;
  return el;
}
function renderCharts(monthly) {
  const groups = categoryTotals(monthly, chartType);
  const total = groups.reduce((sum, g) => sum + g.amount, 0);
  const typeLabel = chartType === 'expense' ? 'Despesas' : 'Receitas';
  $('chart-expense').setAttribute('aria-pressed', String(chartType === 'expense'));
  $('chart-income').setAttribute('aria-pressed', String(chartType === 'income'));
  $('distribution-caption').textContent = `${typeLabel} de ${$('month').value.split('-').reverse().join('/')} · Total: ${money(total)}`;
  $('pie-chart').replaceChildren();
  $('breakdown').replaceChildren();
  if (!total) $('breakdown').textContent = `Nenhuma ${chartType === 'expense' ? 'despesa' : 'receita'} neste período.`;
  else {
    const svg = svgElement('svg', {viewBox:'0 0 240 240', role:'img', 'aria-label':`${typeLabel} por categoria. Valores e percentuais na legenda abaixo.`});
    let angle = -Math.PI / 2;
    groups.forEach((g, i) => {
      const colorIndex = categories.indexOf(g.category);
      const color = chartColors[colorIndex] || `hsl(${(colorIndex * 137.508) % 360} 52% 38%)`;
      const next = angle + g.amount / total * Math.PI * 2;
      const shape = groups.length === 1 ? svgElement('circle', {cx:120,cy:120,r:106,fill:color}) : svgElement('path', {d:`M120 120 L${120+106*Math.cos(angle)} ${120+106*Math.sin(angle)} A106 106 0 ${next-angle > Math.PI ? 1 : 0} 1 ${120+106*Math.cos(next)} ${120+106*Math.sin(next)} Z`,fill:color,stroke:'#fff','stroke-width':2});
      const percentage = (g.amount / total * 100).toLocaleString('pt-BR', {maximumFractionDigits:1});
      shape.append(svgElement('title', {}, `${g.category}: ${money(g.amount)} (${percentage}%)`));
      svg.append(shape); angle = next;
      const row = document.createElement('div'); row.className='pie-legend-row';
      const dot = document.createElement('span'); dot.className='legend-dot'; dot.style.backgroundColor=color;
      const label = document.createElement('span'); label.textContent=g.category;
      const value = document.createElement('strong'); value.textContent=`${money(g.amount)} · ${percentage}%`;
      row.append(dot,label,value); $('breakdown').append(row);
    });
    $('pie-chart').append(svg);
  }
  const months = monthlyEvolution(entries, $('month').value);
  const max = Math.max(1, ...months.flatMap(m => [m.income,m.expense]));
  const svg = svgElement('svg', {viewBox:'0 0 720 300', role:'img', 'aria-label':'Evolução mensal de receitas e despesas. Valores disponíveis na tabela abaixo.'});
  for (let i=0; i<=4; i++) {
    const y=245-i*52;
    svg.append(svgElement('line',{x1:92,y1:y,x2:705,y2:y,stroke:'#e0e8e1'}));
    svg.append(svgElement('text',{x:84,y:y+4,'text-anchor':'end','font-size':11,fill:'#54675c'}, money(Math.round(max*i/4))));
  }
  $('evolution-table').replaceChildren();
  months.forEach((m,i) => {
    const x=100+i*50;
    const label=m.month.slice(5)+'/'+m.month.slice(2,4);
    for (const [type, offset, color] of [['income',0,'#217750'],['expense',18,'#bd5a4b']]) {
      const height=m[type]/max*208;
      const bar=svgElement('rect',{x:x+offset,y:245-height,width:15,height,fill:color,rx:2});
      bar.append(svgElement('title',{},`${label} · ${type==='income'?'Receitas':'Despesas'}: ${money(m[type])}`)); svg.append(bar);
    }
    svg.append(svgElement('text',{x:x+15,y:267,'text-anchor':'middle','font-size':11,fill:'#54675c'},label));
    const row=document.createElement('tr');
    for (const value of [label,money(m.income),money(m.expense)]) { const cell=document.createElement('td'); cell.textContent=value; row.append(cell); }
    $('evolution-table').append(row);
  });
  $('evolution-chart').replaceChildren(svg);
}
$('entry-form').onsubmit = event => {
  event.preventDefault();
  const form = event.currentTarget;
  action(async () => {
    if (!ready) throw new Error('Atualize os registros antes de adicionar movimentações.');
    const e = validateEntry({id:editingId || crypto.randomUUID(),type:form.elements.type.value,description:form.elements.description.value,amount:parseAmount(form.elements.amount.value),date:form.elements.date.value,category:form.elements.category.value});
    const editing = Boolean(editingId);
    if (editing) {
      const updated = validateEntry(await cloud.update(e));
      entries = entries.map(item => item.id === updated.id ? updated : item);
    } else {
      const added = await cloud.insert([e]);
      entries.push(...added.map(validateEntry));
    }
    $('month').value = e.date.slice(0,7);
    resetEntryForm();
    render(); notify(editing ? 'Alterações salvas na sua conta.' : 'Movimentação salva na sua conta.');
  });
};
$('month').onchange = render; $('search').oninput = render;
function download(raw,name) {
  const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
  const a=document.createElement('a'); a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('export').onclick = () => action(async () => {
  await refresh();
  download(JSON.stringify(entries,null,2),`controle-financeiro-${localDate}.json`);
});
$('export-local').onclick = () => {
  try { download(localStorage.getItem('controle-financeiro.v1') || '[]','controle-financeiro-dados-antigos.json'); }
  catch { cloudMessage('Não foi possível acessar os dados antigos neste navegador.'); }
};
$('import').onchange = event => {
  const file=event.target.files[0]; if (!file) return;
  action(async () => {
    try {
      if (!ready) throw new Error('Atualize os registros antes de importar.');
      if (file.size > 5*1024*1024) throw new Error('Arquivo muito grande (máximo 5 MB).');
      const next=load(JSON.parse(await file.text()));
      const existing = new Set(entries.map(e=>e.id));
      const fresh=next.filter(e=>!existing.has(e.id));
      if (!fresh.length) { cloudMessage('Nenhum registro novo para importar.'); return; }
      if (confirm(`Adicionar ${fresh.length} registros à sua conta? Os registros atuais serão mantidos.`)) {
        // Um único INSERT: o banco aceita todo o lote ou rejeita sem inserção parcial.
        const added=await cloud.insert(fresh);
        entries.push(...added.map(validateEntry)); render();
        cloudMessage('Backup importado e salvo na sua conta.');
      }
    } finally { event.target.value=''; }
  });
};
const redirect = supabaseConfig.authRedirectUrl;
$('auth-form').onsubmit = event => {
  event.preventDefault();
  action(async () => {
    if (loginLimit.status().blocked) throw new Error('Limite de três tentativas atingido. Aguarde 15 minutos ou recupere sua senha.');
    try { await cloud.login($('email').value.trim(),$('password').value); }
    catch (error) {
      if (error.code === 'invalid_credentials') { loginLimit.fail(); $('password').value=''; }
      throw error;
    }
    loginLimit.reset(); $('password').value=''; showAccount(); await refresh();
  });
};
$('signup-form').onsubmit = event => {
  event.preventDefault();
  action(async () => {
    const email = $('signup-email').value.trim();
    await cloud.signup(email,$('signup-password').value,redirect);
    $('signup-password').value='';
    if (cloud.user) { showAccount(); await refresh(); }
    else {
      $('email').value = email;
      showAuthScreen('login', false);
      authMessage('Confirme sua conta pelo link recebido no e-mail antes de entrar.');
      $('confirmation-email').textContent = email;
      $('email-confirmation').showModal();
    }
  });
};
$('recover').onclick = () => {
  $('recover-email').value = $('email').value.trim();
  $('recover-form').hidden = false;
  $('recover-sent').hidden = true;
  showAuthScreen('recover');
};
$('recover-back').onclick = () => showAuthScreen('login');
$('recover-form').onsubmit = event => {
  event.preventDefault();
  action(async () => {
    await cloud.recover($('recover-email').value.trim(),redirect);
    $('recover-form').hidden = true;
    $('recover-sent').hidden = false;
    authMessage('');
  });
};
$('password-form').onsubmit = event => {
  event.preventDefault();
  action(async () => {
    await cloud.updatePassword($('new-password').value); $('new-password').value='';
    loginLimit.reset();
    await cloud.logout().catch(() => {});
    showAuthScreen('login', false);
    showAccount();
    authMessage('Senha atualizada! Entre com sua nova senha.');
  });
};
$('logout').onclick = () => action(async () => {
  try { await cloud.logout(); }
  finally { resetGoalForm(); goals=[]; goalsReady=false; $('goals-status').textContent=''; resetEntryForm(); entries=[]; ready=false; render(); showAuthScreen('login'); showAccount(); notify(''); cloudMessage('Você saiu. Entre novamente para acessar os dados.'); }
});
function goalMessage(text) { $('goal-message').textContent = text; }
function syncGoalForm() {
  const form=$('goal-form');
  const saving=form.elements.kind.value==='saving';
  $('goal-spending-fields').hidden=saving;
  $('goal-saving-fields').hidden=!saving;
  $('goal-end-label').hidden=!saving;
  form.elements.end_month.required=saving;
  form.elements.saved.required=saving;
  if (!saving) form.elements.end_month.value=form.elements.start_month.value;
}
function resetGoalForm() {
  editingGoalId=null;
  $('goal-form').reset();
  $('goal-form').elements.start_month.value=$('month').value || localDate.slice(0,7);
  $('goal-form').elements.end_month.value=$('goal-form').elements.start_month.value;
  $('goal-form-title').textContent='Nova meta';
  $('goal-save').textContent='Criar meta';
  $('goal-cancel').hidden=true;
  goalMessage(''); syncGoalForm();
}
function goalAction(task) {
  return action(async () => {
    goalMessage('');
    try { if (!goalsReady) throw new Error('As metas ainda não foram carregadas. Clique em Atualizar registros e tente novamente.'); await task(); }
    catch (error) { goalMessage(error.message); throw error; }
  });
}
async function refreshGoals() {
  goalsReady=false;
  $('goals-status').textContent='Carregando metas…';
  try {
    goals=(await cloud.listGoals()).map(validateGoal);
    goalsReady=true;
    $('goals-status').textContent='Metas atualizadas.';
  } catch (error) {
    goals=[];
    $('goals-status').textContent='Não foi possível carregar as metas. Verifique sua conexão e clique em Atualizar registros. Se o problema continuar, entre em contato com o responsável pela plataforma.';
    if (!cloud?.user) throw error;
  }
  renderGoals();
}
function renderBudgetAlerts() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const alerts = goalsReady ? spendingAlerts(goals, entries, month) : [];
  const host = $('budget-alerts');
  const signature = JSON.stringify(alerts);
  if (host.dataset.signature === signature) return;
  host.dataset.signature = signature;
  host.replaceChildren();host.hidden = alerts.length === 0;
  if (!alerts.length) return;
  const heading=document.createElement('h2');heading.textContent='Atenção ao teto de gastos deste mês';host.append(heading);
  for (const alert of alerts) {
    const message=document.createElement('p');message.className=`budget-alert ${alert.level}`;
    const title=document.createElement('strong');title.textContent=`${alert.title}: `;
    const text=alert.level==='exceeded'?`teto ultrapassado em ${money(alert.exceeded)}. Você gastou ${money(alert.current)}.`:alert.level==='reached'?`teto atingido. Você já gastou os ${money(alert.current)} previstos.`:`você já usou ${alert.usedPercent.toLocaleString('pt-BR',{maximumFractionDigits:1})}% do teto. Restam ${money(alert.remaining)} para gastar.`;
    message.append(title,document.createTextNode(text));host.append(message);
  }
  const link=document.createElement('a');link.href='#goals-title';link.textContent='Ver minhas metas';host.append(link);
}
function renderGoals() {
  renderBudgetAlerts();
  const list=$('goals-list'); list.replaceChildren();
  if (!goals.length) {
    const p=document.createElement('p');p.textContent=goalsReady?'Você ainda não tem metas. Crie seu primeiro objetivo.':'As metas ainda não estão disponíveis.';list.append(p);return;
  }
  const currentMonth=localDate.slice(0,7);
  for (const goal of [...goals].sort((a,b)=>a.end_month.localeCompare(b.end_month))) {
    const p=goalProgress(goal,entries,currentMonth);
    const card=document.createElement('article');card.className='goal-card';
    const title=document.createElement('h3');title.textContent=goal.title;
    const dates=document.createElement('p');dates.className='muted';dates.textContent=`${goal.kind==='saving'?'Juntar dinheiro':'Limite de gastos'} · ${goal.start_month.split('-').reverse().join('/')} a ${goal.end_month.split('-').reverse().join('/')}`;
    const amount=document.createElement('strong');amount.textContent=`${money(p.current)} de ${money(goal.target_amount)} ${goal.kind==='saving'?'reservados':'gastos'}`;
    const progress=document.createElement('progress');progress.max=100;progress.value=p.percent;progress.setAttribute('aria-label',`${goal.title}: ${p.percent.toFixed(1)}%`);
    const status=document.createElement('p');
    if (goal.kind==='spending') {
      status.textContent=p.exceeded?`Limite ultrapassado em ${money(p.exceeded)}.`:p.current===goal.target_amount?'Limite de gastos atingido.':`${p.ended?'Restaram':'Disponível no limite'}: ${money(p.remaining)}.`;
      if (p.exceeded) status.className='negative';
      else if (p.current===goal.target_amount) status.className='negative';
      else if (p.current>=goal.target_amount*0.8) {
        status.textContent=`Atenção: você já usou ${(p.current/goal.target_amount*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}% do teto. Restam ${money(p.remaining)}.`;
        status.className='budget-near';
      }
    } else {
      status.textContent=p.remaining===0?'Meta atingida!':p.ended?`Prazo encerrado. Ainda faltam ${money(p.remaining)}.`:`Faltam ${money(p.remaining)}. Sugestão: ${money(p.monthly)} por mês em ${p.months} mês(es).`;
      if (!p.remaining) status.className='positive';
    }
    if (p.upcoming) status.textContent+=' Período ainda não iniciado.';
    if (p.ended && goal.kind==='spending') status.textContent+=' Período encerrado.';
    card.append(title,dates,amount,progress,status);
    if (goal.kind==='spending') {const filters=document.createElement('p');filters.className='muted';filters.textContent=`Categoria: ${goal.category||'Todas'}${goal.description_filter?` · Descrição contém: ${goal.description_filter}`:''}`;card.append(filters);}
    const actions=document.createElement('div');actions.className='goal-actions';
    const edit=document.createElement('button');edit.type='button';edit.textContent=goal.kind==='saving'?'Editar / atualizar valor reservado':'Editar';edit.setAttribute('aria-label',`Editar meta ${goal.title}`);
    edit.onclick=()=>{
      if(busy)return;
      editingGoalId=goal.id;
      const form=$('goal-form');
      for(const field of ['title','kind','start_month','end_month','category','description_filter']) form.elements[field].value=goal[field];
      form.elements.target.value=(goal.target_amount/100).toFixed(2).replace('.',',');
      form.elements.saved.value=(goal.saved_amount/100).toFixed(2).replace('.',',');
      $('goal-form-title').textContent='Editar meta';$('goal-save').textContent='Salvar meta';$('goal-cancel').hidden=false;
      goalMessage('');syncGoalForm();form.scrollIntoView({behavior:'smooth',block:'center'});form.elements.title.focus({preventScroll:true});
    };
    const remove=document.createElement('button');remove.type='button';remove.textContent='Excluir';remove.setAttribute('aria-label',`Excluir meta ${goal.title}`);
    remove.onclick=()=>{if(!busy && confirm(`Excluir a meta “${goal.title}”? Seus lançamentos serão mantidos.`))goalAction(async()=>{await cloud.removeGoal(goal.id);goals=goals.filter(g=>g.id!==goal.id);if(editingGoalId===goal.id)resetGoalForm();renderGoals();goalMessage('Meta excluída.');});};
    actions.append(edit,remove);card.append(actions);list.append(card);
  }
}
$('goal-form').elements.kind.onchange=syncGoalForm;
$('goal-form').elements.start_month.onchange=syncGoalForm;
$('goal-cancel').onclick=resetGoalForm;
for(const category of categories) $('goal-category').add(new Option(category,category));
resetGoalForm();
$('goal-form').onsubmit=event=>{
  event.preventDefault();
  goalAction(async()=>{
    const f=$('goal-form');
    const saving=f.elements.kind.value==='saving';
    const saved=f.elements.saved.value.trim();
    const goal=validateGoal({id:editingGoalId||crypto.randomUUID(),title:f.elements.title.value,kind:f.elements.kind.value,target_amount:parseAmount(f.elements.target.value),saved_amount:saving?parseAmount(saved):0,start_month:f.elements.start_month.value,end_month:saving?f.elements.end_month.value:f.elements.start_month.value,category:saving?'':f.elements.category.value,description_filter:saving?'':f.elements.description_filter.value});
    const updated=validateGoal(await cloud.saveGoal(goal,Boolean(editingGoalId)));
    goals=goals.filter(g=>g.id!==updated.id);goals.push(updated);
    resetGoalForm();renderGoals();goalMessage('Meta salva na sua conta.');
  });
};
$('goals-export').onclick=()=>goalAction(async()=>{await refreshGoals();if(!goalsReady)throw new Error('Não foi possível atualizar as metas para exportar.');download(JSON.stringify(goals,null,2),`controle-financeiro-metas-${localDate}.json`);});

$('reload').onclick = () => action(refresh);
setInterval(updateLoginLimit, 1000);
window.addEventListener('storage', updateLoginLimit);
updateLoginLimit();
render();
action(async () => {
  const hash=location.hash;
  // Remove tokens da URL mesmo se faltar configuração do projeto.
  if (hash) history.replaceState(null,'',location.pathname+location.search);
  cloud=createCloud(supabaseConfig);
  if (hash) {
    if (new URLSearchParams(hash.slice(1)).has('error')) throw new Error('Link inválido ou expirado. Solicite outro.');
    await cloud.acceptLink(hash);
    if (new URLSearchParams(hash.slice(1)).get('type') === 'recovery') {
      showAuthScreen('recovery');
      authMessage('Escolha uma nova senha para sua conta.');
      return;
    }
    if (new URLSearchParams(hash.slice(1)).get('type') === 'signup') {
      // A confirmação valida o link, mas o usuário entra explicitamente pelo formulário.
      // logout sempre descarta a sessão local, mesmo se o servidor estiver indisponível.
      await cloud.logout().catch(() => {});
      showAuthScreen('login', false);
      showAccount();
      authMessage('E-mail confirmado! Sua conta está ativa. Informe seu e-mail e senha para entrar.');
      return;
    }
    showAccount(); await refresh();
  } else showAuthScreen('login', false);
});
