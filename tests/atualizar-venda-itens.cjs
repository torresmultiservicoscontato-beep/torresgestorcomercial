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
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/lib/vendas.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:n=>mocks[n]});
 return {api:exports,chamadas};
}
const input={formasPagamento:['Pix'],condicoesPrazo:[],situacao:'Pedido lançado',itens:[{produto:'Teste',quantidade:'2',valorUnitario:'12,50',valorTotal:'25,00'}]};
test('atualiza venda e itens em uma RPC, sem DELETE independente',async()=>{
 const {api,chamadas}=carregar();
 await api.salvarComplementoVenda({id:'venda'},input);
 assert.equal(chamadas.length,1);
 assert.equal(chamadas[0].nome,'atualizar_venda_com_itens');
 assert.equal(chamadas[0].args.p_venda_id,'venda');
 assert.equal(chamadas[0].args.p_itens[0].valor_unitario,12.5);
 assert.equal(chamadas[0].args.p_itens[0].quantidade,2);
});
test('falha da RPC é exibida sem novas mutações',async()=>{
 const {api,chamadas}=carregar(true);
 await assert.rejects(api.salvarComplementoVenda({id:'venda'},input),/Item inválido/);
 assert.equal(chamadas.length,1);
});
