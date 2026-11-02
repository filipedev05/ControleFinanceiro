export const categories = ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Lazer', 'Salário', 'Investimentos', 'Outros'];
export function validateEntry(entry) {
  if (!entry.description?.trim() || entry.description.trim().length > 120) throw new Error('Informe uma descrição de até 120 caracteres.');
  if (!['income', 'expense'].includes(entry.type)) throw new Error('Tipo inválido.');
  if (!Number.isSafeInteger(entry.amount) || entry.amount <= 0) throw new Error('Informe um valor válido maior que zero.');
  if (!categories.includes(entry.category)) throw new Error('Categoria inválida.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || !Number.isFinite(Date.parse(entry.date)) || new Date(entry.date).toISOString().slice(0, 10) !== entry.date) throw new Error('Informe uma data válida.');
  return {...entry, description: entry.description.trim()};
}
export function summarize(entries) {
  const income = entries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
  const expense = entries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
  return {income, expense, balance: income - expense};
}
export function parseAmount(value) {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) throw new Error('Use um valor como 125,50, sem separador de milhar.');
  return Math.round(Number(value.replace(',', '.')) * 100);
}

export function categoryTotals(entries, type) {
  return categories.map(category => ({category, amount: entries.filter(e => e.type === type && e.category === category).reduce((sum, e) => sum + e.amount, 0)})).filter(e => e.amount > 0);
}
export function monthlyEvolution(entries, endMonth) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(endMonth)) return [];
  const [year, month] = endMonth.split('-').map(Number);
  const end = year * 12 + month - 1;
  return Array.from({length:12}, (_, i) => {
    const index = end - 11 + i;
    const key = `${String(Math.floor(index / 12)).padStart(4,'0')}-${String(index % 12 + 1).padStart(2,'0')}`;
    return {month:key, ...summarize(entries.filter(e => e.date.startsWith(key)))};
  });
}
