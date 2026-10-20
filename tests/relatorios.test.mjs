import test from 'node:test';
import assert from 'node:assert/strict';
import { resumoComercial, resumoFinanceiro, gerarCsv } from '../app/lib/relatoriosModelo.ts';

test('vendas contadas uma vez, centavos, cancelamento e clientes únicos',()=>{
 const visitas=[{cliente_id:'a',km_trecho:10,duracao_minutos:20},{cliente_id:'a',km_trecho:null,duracao_minutos:null},{cliente_id:'b',km_trecho:2.5,duracao_minutos:10}];
 const vendas=[{cliente_id:'a',valor:0.1,situacao:'Faturado'},{cliente_id:'a',valor:0.2,situacao:'Pedido lançado'},{cliente_id:'b',valor:999,situacao:'Cancelado'},{cliente_id:'fora',valor:1,situacao:'Liquidado'}];
 const r=resumoComercial(visitas,vendas);
 assert.equal(r.total,130);assert.equal(r.pedidos,3);assert.equal(r.compradores,2);assert.equal(r.visitados,2);assert.equal(r.positivacao,50);assert.deepEqual(r.semFechamento,['b']);assert.equal(r.km,12.5);assert.equal(r.kmInformados,2);assert.equal(r.minutos,30);
});
test('faturamento por ordem, comissão própria do preposto e cancelamentos',()=>{
 const base={status_pedido:'Faturado',valor_faturado:100,valor_liquidado:50,comissao_representante_total:4,comissao_representante_liberada:2,comissao_representante_recebida:1,comissao_preposto_total:2,comissao_preposto_liberada:1,comissao_preposto_paga:0.5};
 const pedidos=[base,{...base},{...base,status_pedido:'Cancelado',valor_faturado:999}];
 assert.deepEqual(resumoFinanceiro(pedidos,false),{faturado:20000,liquidado:10000,prevista:800,liberada:400,recebida:200,repasse:100});
 assert.equal(resumoFinanceiro(pedidos,true).prevista,400);
 assert.equal(resumoFinanceiro([{...base,comissao_representante_total:null}],true).prevista,200);
});
test('vazio não gera NaN e CSV mantém acentos, separadores e neutraliza fórmulas',()=>{
 const r=resumoComercial([],[]);assert.equal(r.total,0);assert.equal(r.ticket,0);assert.equal(r.positivacao,null);
 const csv=gerarCsv([['Cliente','Valor'],['=HYPERLINK("x")',10],['  +SUM(1;2)','João; "A"\nB']]);
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes("\"'=HYPERLINK"));assert.ok(csv.includes("\"'  +SUM"));assert.ok(csv.includes('João; ""A""\nB'));
});
