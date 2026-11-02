import {categories, validateEntry, summarize, parseAmount} from './finance.js';
const $ = id => document.getElementById(id);
import {createCloud} from './cloud.js';
import {supabaseConfig} from './config.js';
let cloud;
let busy = false;
let ready = false;
let entries = [];
const money = value => (value / 100).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const today = new Date();
const localDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
$('month').value = localDate.slice(0,7);
$('entry-form').elements.date.value = localDate;
for (const c of categories) $('category').add(new Option(c,c));
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
    if (!cloud?.user) { entries = []; ready = false; render(); showAccount(); }
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
    remove.onclick = () => { if (confirm(`Excluir “${e.description}”?`)) action(async () => { await cloud.remove(e.id); entries = entries.filter(item => item.id !== e.id); render(); cloudMessage('Registro excluído.'); }); };
    row.append(info,amount,remove); $('entries').append(row);
  }
  $('breakdown').replaceChildren();
  for (const c of categories) {
    const value = monthly.filter(e => e.type === 'expense' && e.category === c).reduce((s,e) => s+e.amount,0);
    if (!value) continue;
    const row = document.createElement('div'); row.className='category-row';
    const label = document.createElement('span'); label.textContent=c;
    const progress = document.createElement('progress'); progress.max=totals.expense; progress.value=value; progress.setAttribute('aria-label',c);
    const amount = document.createElement('strong'); amount.textContent=money(value);
    row.append(label,progress,amount); $('breakdown').append(row);
  }
  if (!totals.expense) $('breakdown').textContent='Nenhuma despesa neste período.';
}
$('entry-form').onsubmit = event => {
  event.preventDefault();
  const form = event.currentTarget;
  action(async () => {
    if (!ready) throw new Error('Atualize os registros antes de adicionar movimentações.');
    const e = validateEntry({id:crypto.randomUUID(),type:form.elements.type.value,description:form.elements.description.value,amount:parseAmount(form.elements.amount.value),date:form.elements.date.value,category:form.elements.category.value});
    const added = await cloud.insert([e]);
    entries.push(...added.map(validateEntry));
    $('month').value = e.date.slice(0,7);
    form.elements.description.value = ''; form.elements.amount.value = '';
    render(); notify('Movimentação salva na sua conta.');
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
  finally { entries=[]; ready=false; render(); showAuthScreen('login'); showAccount(); notify(''); cloudMessage('Você saiu. Entre novamente para acessar os dados.'); }
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
