import {categories, entryCategories, validateEntry, summarize, parseAmount, categoryTotals, monthlyEvolution} from './finance.js';
const $ = id => document.getElementById(id);
import {createCloud} from './cloud.js';
import {supabaseConfig} from './config.js';
let cloud;
let busy = false;
let ready = false;
let entries = [];
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
  $('password').value = '';
  $('signup-password').value = '';
  authMessage('');
  cloudMessage('');
  if (focus) $(screen === 'signup' ? 'signup-email' : screen === 'recovery' ? 'new-password' : 'email').focus();
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
    if (!cloud?.user) { resetEntryForm(); entries = []; ready = false; render(); showAccount(); }
  } finally { busy = false; controls.forEach(c => c.disabled = false); }
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
const redirect = location.origin + location.pathname;
$('auth-form').onsubmit = event => {
  event.preventDefault();
  action(async () => { await cloud.login($('email').value.trim(),$('password').value); $('password').value=''; showAccount(); await refresh(); });
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
  if (!$('email').reportValidity() || !$('email').value) { authMessage('Informe seu e-mail para receber o link.'); return; }
  action(async () => { await cloud.recover($('email').value.trim(),redirect); authMessage('Se houver uma conta com esse e-mail, você receberá um link de recuperação.'); });
};
$('password-form').onsubmit = event => {
  event.preventDefault();
  action(async () => {
    await cloud.updatePassword($('new-password').value); $('new-password').value='';
    showAuthScreen('login', false);
    showAccount(); await refresh();
  });
};
$('logout').onclick = () => action(async () => {
  try { await cloud.logout(); }
  finally { resetEntryForm(); entries=[]; ready=false; render(); showAuthScreen('login'); showAccount(); notify(''); cloudMessage('Você saiu. Entre novamente para acessar os dados.'); }
});
$('reload').onclick = () => action(refresh);
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
    showAccount(); await refresh();
  } else showAuthScreen('login', false);
});
