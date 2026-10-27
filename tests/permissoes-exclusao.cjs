const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function carregar(excluir, editar) {
 const chamadas = [];
 const mocks = {
  './acesso': {carregarAcessoAtual:async()=>({papel:'usuario',titularUserId:'titular'}),pode:(_a,_m,acao)=>acao === "excluir" ? excluir : editar},
  './adminContext': {obterRepresentanteAdministrado:()=>null},
  './prepostoContext': {obterPrepostoAdministrado:()=>null},
  './supabase': {supabase:{auth:{getUser:async()=>({data:{user:{id:'titular'}}})},
   rpc:async(nome,args)=>{chamadas.push({nome,args});return {data:null,error:null};},
   from:()=>{throw new Error('Consulta adicional após salvar');}
  }}
 };
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/lib/visitasDetalhadas.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:n=>mocks[n]});
 return {api:exports,chamadas};
}
test('editar não permite excluir',async()=>{
 const {api,chamadas}=carregar(false,true);
 await assert.rejects(api.excluirVisitaDetalhada('visita'),/permissão/);
 assert.equal(chamadas.length,0);
});
test('excluir não exige editar',async()=>{
 const {api,chamadas}=carregar(true,false);
 await api.excluirVisitaDetalhada('visita');
 assert.equal(chamadas.length,1);
 assert.equal(chamadas[0].nome,'excluir_visita');
 await assert.rejects(api.atualizarVisitaDetalhada({}),/permissão/);
});
