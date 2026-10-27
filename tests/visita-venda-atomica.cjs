const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function carregar(falha = false) {
 const chamadas = [];
 const mocks = {
  './acesso': {carregarAcessoAtual:async()=>({papel:'usuario',titularUserId:'titular'}),pode:()=>true},
  './adminContext': {obterRepresentanteAdministrado:()=>null},
  './prepostoContext': {obterPrepostoAdministrado:()=>null},
  './supabase': {supabase:{auth:{getUser:async()=>({data:{user:{id:'titular'}}})},
   rpc:async(nome,args)=>{chamadas.push({nome,args});return falha ? {error:{message:'Item inválido'}} : {data:{id:args.p_id,houve_venda:args.p_houve_venda,valor_venda:args.p_valor_venda}};},
   from:()=>{throw new Error('Consulta adicional após salvar');}
  }}
 };
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/lib/visitasDetalhadas.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:n=>mocks[n]});
 return {api:exports,chamadas};
}
const visita={id:'visita',clienteId:'cliente',representadas:[{id:'rep',nome:'Representada'}],odometroChegada:'',houveVenda:true,valorVenda:100,formasPagamento:['Pix'],condicoesPrazo:[],situacaoVenda:'Pedido lançado',itensVenda:[{produto:'Teste',quantidade:'2',valorUnitario:'50',valorTotal:'100'}]};
test('criação e edição enviam visita, venda e itens em uma única RPC',async()=>{
 for(const metodo of ['criarVisitaDetalhada','atualizarVisitaDetalhada']){
  const {api,chamadas}=carregar();const salvo=await api[metodo](visita);
  assert.equal(chamadas.length,1);assert.equal(chamadas[0].nome,'salvar_visita_venda_atomica');
  assert.deepEqual(chamadas[0].args.p_itens,visita.itensVenda);
  assert.deepEqual(chamadas[0].args.p_formas_pagamento,['Pix']);
  assert.equal(chamadas[0].args.p_titular_user_id,'titular');
  assert.equal(salvo.id,visita.id);assert.equal(salvo.valorVenda,100);
 }
});
test('erro da transação é exibido sem tentar uma segunda gravação',async()=>{
 const {api,chamadas}=carregar(true);
 await assert.rejects(api.criarVisitaDetalhada(visita),/Item inválido/);
 assert.equal(chamadas.length,1);
});
