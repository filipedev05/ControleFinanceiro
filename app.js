import {categories, validateEntry, summarize, parseAmount} from './finance.js';
const $ = id => document.getElementById(id);
const key = 'controle-financeiro.v1';
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
try { entries = load(JSON.parse(localStorage.getItem(key) || '[]')); }
catch { notify('Não foi possível carregar os dados. Exporte o conteúdo existente antes de adicionar registros.'); $('entry-form').querySelector('button').disabled = true; }
function save(next) {
  try { localStorage.setItem(key, JSON.stringify(next)); entries = next; render(); return true; }
  catch { notify('Não foi possível salvar. Verifique o espaço e as permissões do navegador.'); return false; }
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
    remove.onclick = () => { if (confirm(`Excluir “${e.description}”?`)) save(entries.filter(item => item.id !== e.id)); };
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
  try {
    const e = validateEntry({id:crypto.randomUUID(), type:form.elements.type.value, description:form.elements.description.value, amount:parseAmount(form.elements.amount.value), date:form.elements.date.value, category:form.elements.category.value});
    if (entries.length >= 10000) throw new Error('Limite de 10.000 registros atingido.');
    if (save([...entries,e])) { $('month').value=e.date.slice(0,7); form.elements.description.value=''; form.elements.amount.value=''; render(); notify('Movimentação adicionada.'); }
  } catch (error) { notify(error.message); }
};
$('month').onchange = render; $('search').oninput = render;
$('export').onclick = () => {
  const raw = localStorage.getItem(key) || '[]';
  const url = URL.createObjectURL(new Blob([raw], {type:'application/json'}));
  const a = document.createElement('a'); a.href=url; a.download=`controle-financeiro-${localDate}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('import').onchange = async event => {
  const file=event.target.files[0]; if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('Arquivo muito grande (máximo 5 MB).');
    const next = load(JSON.parse(await file.text()));
    if (confirm('Substituir os dados deste navegador pelo backup?')) {
      if (save(next)) { $('entry-form').querySelector('button').disabled=false; notify('Backup importado.'); }
    }
  } catch(error) { notify(`Falha na importação: ${error.message}`); }
  event.target.value='';
};
render();
