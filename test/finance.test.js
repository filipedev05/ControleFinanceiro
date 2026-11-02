import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEntry, summarize, parseAmount} from '../finance.js';
const entry={description:' Mercado ',type:'expense',amount:12990,category:'Alimentação',date:'2026-10-30'};
test('valida lançamento e remove espaços',()=>assert.equal(validateEntry(entry).description,'Mercado'));
test('rejeita valores inválidos e datas inexistentes',()=>{
 for(const amount of [0,-1,1.5,NaN,Infinity]) assert.throws(()=>validateEntry({...entry,amount}));
 assert.throws(()=>validateEntry({...entry,date:'2026-02-30'}));
 assert.throws(()=>validateEntry({...entry,category:'inválida'}));
});
test('converte reais em centavos sem erro de arredondamento',()=>{
 assert.equal(parseAmount('12,99'),1299); assert.equal(parseAmount('0.29'),29);
 for(const value of ['1.000,50','abc','-1','1,999','']) assert.throws(()=>parseAmount(value));
});
test('calcula receitas, despesas e saldo inclusive negativo',()=>{
 assert.deepEqual(summarize([{type:'income',amount:10000},entry]),{income:10000,expense:12990,balance:-2990});
 assert.deepEqual(summarize([]),{income:0,expense:0,balance:0});
});
test('pizza separa categorias por tipo e ignora categorias zeradas',async()=>{
 const {categoryTotals}=await import('../finance.js');
 const data=[entry,{...entry,amount:10},{...entry,type:'income',category:'Salário',amount:50000}];
 assert.deepEqual(categoryTotals(data,'expense'),[{category:'Alimentação',amount:13000}]);
 assert.deepEqual(categoryTotals(data,'income'),[{category:'Salário',amount:50000}]);
 assert.deepEqual(categoryTotals([],'expense'),[]);
});
test('evolução inclui 12 meses, atravessa o ano e preenche meses vazios',async()=>{
 const {monthlyEvolution}=await import('../finance.js');
 const rows=monthlyEvolution([entry,{...entry,type:'income',date:'2025-12-01',amount:100},{...entry,date:'2025-10-31'},{...entry,date:'2026-11-01'}],'2026-10');
 assert.equal(rows.length,12);
 assert.equal(rows[0].month,'2025-11');
 assert.equal(rows[1].income,100);
 assert.equal(rows[1].expense,0);
 assert.equal(rows[2].balance,0);
 assert.equal(rows.at(-1).month,'2026-10');
 assert.equal(rows.at(-1).expense,12990);
 assert.deepEqual(monthlyEvolution([],''),[]);
});
test('categorias seguem o tipo e preservam categoria antiga na edição',async()=>{
 const {entryCategories,categories}=await import('../finance.js');
 assert.ok(entryCategories('expense').includes('Combustível'));
 assert.ok(!entryCategories('expense').includes('Renda extra'));
 assert.ok(entryCategories('income').includes('Renda extra'));
 assert.ok(!entryCategories('income').includes('Combustível'));
 assert.ok(entryCategories('income','Alimentação').includes('Alimentação'));
 assert.ok(!entryCategories('income','inválida').includes('inválida'));
 assert.equal(new Set(categories).size,categories.length);
 for(const category of categories) assert.equal(validateEntry({...entry,category}).category,category);
});
test('pizza inclui novas categorias e mantém os valores antigos',async()=>{
 const {categoryTotals}=await import('../finance.js');
 assert.deepEqual(categoryTotals([entry,{...entry,category:'Combustível',amount:5000}], 'expense'),[{category:'Alimentação',amount:12990},{category:'Combustível',amount:5000}]);
 assert.deepEqual(categoryTotals([{...entry,type:'income',category:'Renda extra',amount:7000}], 'income'),[{category:'Renda extra',amount:7000}]);
});
