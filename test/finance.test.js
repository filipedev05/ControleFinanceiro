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
