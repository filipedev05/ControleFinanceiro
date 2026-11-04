import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGoal, goalProgress} from '../goals.js';
const spending={id:'goal-1',title:' iFood ',kind:'spending',target_amount:30000,saved_amount:0,start_month:'2026-11',end_month:'2026-11',category:'Restaurantes e delivery',description_filter:'ifood'};
const entry={type:'expense',date:'2026-11-04',category:'Restaurantes e delivery',description:'IFood almoço',amount:5000};
test('limite mensal combina categoria, descrição, tipo e período',()=>{
 const g=validateGoal(spending);
 assert.equal(g.title,'iFood');
 const data=[entry,{...entry,amount:10000},{...entry,type:'income'},{...entry,date:'2026-10-04'},{...entry,category:'Alimentação'},{...entry,description:'Restaurante'}];
 const p=goalProgress(g,data,'2026-11');
 assert.equal(p.current,15000);assert.equal(p.remaining,15000);assert.equal(p.percent,50);
 assert.equal(goalProgress(g,[...data,{...entry,amount:20000}],'2026-11').exceeded,5000);
});
test('limite sem filtros considera todas as despesas e reage a alterações e exclusões',()=>{
 const g=validateGoal({...spending,category:'',description_filter:''});
 assert.equal(goalProgress(g,[entry,{...entry,category:'Moradia',amount:40000}],'2026-11').current,45000);
 assert.equal(goalProgress(g,[{...entry,amount:1000}],'2026-11').current,1000);
 assert.equal(goalProgress(g,[],'2026-11').current,0);
 assert.equal(goalProgress(g,[],'2026-12').ended,true);
});
test('filtro de descrição ignora maiúsculas e acentos',()=>{
 const g=validateGoal({...spending,category:'',description_filter:'cafe'});
 assert.equal(goalProgress(g,[{...entry,description:'Café da manhã'}],'2026-11').current,5000);
});
test('meta de economia usa dinheiro reservado sem confundir com saldo ou outros objetivos',()=>{
 const g=validateGoal({...spending,kind:'saving',target_amount:120000,saved_amount:30000,start_month:'2026-10',end_month:'2027-03'});
 const p=goalProgress(g,[{...entry,type:'income',amount:900000}],'2026-11');
 assert.equal(g.category,'');assert.equal(g.description_filter,'');
 assert.equal(p.current,30000);assert.equal(p.remaining,90000);assert.equal(p.months,5);assert.equal(p.monthly,18000);
 assert.equal(goalProgress(g,[],'2026-09').months,6);
 assert.equal(goalProgress(g,[],'2026-09').upcoming,true);
 assert.equal(goalProgress(g,[],'2027-04').monthly,0);
 assert.equal(goalProgress(g,[],'2027-04').ended,true);
});
test('meta concluída limita a barra em 100% e zera sugestão',()=>{
 const g=validateGoal({...spending,kind:'saving',saved_amount:35000});
 const p=goalProgress(g,[],'2026-11');assert.equal(p.percent,100);assert.equal(p.remaining,0);assert.equal(p.monthly,0);
});
test('metas rejeitam períodos e valores inválidos',()=>{
 for(const changes of [{target_amount:0},{target_amount:1.5},{saved_amount:-1},{start_month:'2026-13'},{end_month:'2026-10'},{end_month:'2027-01'},{title:' '},{description_filter:'x'.repeat(121)},{category:'desconhecida'},{start_month:'0000-01'}]) assert.throws(()=>validateGoal({...spending,...changes}));
});
