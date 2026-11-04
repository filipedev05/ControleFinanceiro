import {categories} from './finance.js';
const monthPattern = /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/;
export function validateGoal(goal) {
  if (typeof goal.id !== 'string' || !goal.id) throw new Error('Identificador de meta inválido.');
  if (typeof goal.title !== 'string' || !goal.title.trim() || goal.title.trim().length > 100) throw new Error('Informe um nome de até 100 caracteres para a meta.');
  if (!['spending','saving'].includes(goal.kind)) throw new Error('Tipo de meta inválido.');
  if (!Number.isSafeInteger(goal.target_amount) || goal.target_amount <= 0) throw new Error('Informe um valor de meta maior que zero.');
  if (!monthPattern.test(goal.start_month) || !monthPattern.test(goal.end_month) || goal.start_month > goal.end_month) throw new Error('Informe um período válido, com término igual ou posterior ao início.');
  if (goal.kind === 'spending' && goal.start_month !== goal.end_month) throw new Error('O limite de gastos deve corresponder a um único mês.');
  if (!Number.isSafeInteger(goal.saved_amount) || goal.saved_amount < 0) throw new Error('Informe um valor reservado válido, maior ou igual a zero.');
  const category = goal.category || '';
  const query = goal.description_filter || '';
  if (category && !categories.includes(category)) throw new Error('Categoria de meta inválida.');
  if (typeof query !== 'string' || query.trim().length > 120) throw new Error('Use um filtro de descrição de até 120 caracteres.');
  return {id:goal.id,title:goal.title.trim(),kind:goal.kind,target_amount:goal.target_amount,start_month:goal.start_month,end_month:goal.end_month,saved_amount:goal.kind==='saving'?goal.saved_amount:0,category:goal.kind==='spending'?category:'',description_filter:goal.kind==='spending'?query.trim():''};
}
const monthIndex = month => Number(month.slice(0,4))*12+Number(month.slice(5))-1;
const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
export function goalProgress(goal, entries, currentMonth) {
  const current = goal.kind === 'saving' ? goal.saved_amount : entries.filter(e => e.type==='expense' && e.date.slice(0,7)===goal.start_month && (!goal.category || e.category===goal.category) && normalize(e.description).includes(normalize(goal.description_filter))).reduce((sum,e)=>sum+e.amount,0);
  const remaining = Math.max(0, goal.target_amount-current);
  const months = Math.max(0,monthIndex(goal.end_month)-monthIndex(currentMonth > goal.start_month ? currentMonth : goal.start_month)+1);
  return {current,remaining,exceeded:Math.max(0,current-goal.target_amount),percent:Math.min(100,current/goal.target_amount*100),months,monthly:months?Math.ceil(remaining/months):0,upcoming:currentMonth<goal.start_month,ended:currentMonth>goal.end_month};
}

export function spendingAlerts(goals, entries, month) {
  return goals.filter(g => g.kind === 'spending' && g.start_month === month).flatMap(goal => {
    const progress = goalProgress(goal, entries, month);
    const ratio = progress.current / goal.target_amount;
    if (ratio < 0.8) return [];
    return [{id:goal.id,title:goal.title,level:ratio>1?'exceeded':ratio===1?'reached':'near',usedPercent:ratio*100,...progress}];
  }).sort((a,b) => b.usedPercent-a.usedPercent);
}
