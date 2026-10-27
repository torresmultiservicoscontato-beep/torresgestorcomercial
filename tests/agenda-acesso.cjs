const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function agenda({ papel = 'preposto', visualizar = false, usuario = true, administrado = null } = {}) {
  const chamadas = [];
  const acesso = { papel, titularUserId: 'titular', permissoes: { agenda: { visualizar } } };
  const mocks = {
    './acesso': {
      carregarAcessoAtual: async () => acesso,
      pode: (a, modulo, acao) => a.papel !== 'preposto' || !!a.permissoes[modulo]?.[acao],
    },
    './adminContext': { obterRepresentanteAdministrado: () => administrado },
    './prepostoContext': { obterPrepostoAdministrado: () => null },
    './supabase': { supabase: {
      auth: { getUser: async () => ({ data: { user: usuario ? { id: 'usuario' } : null }, error: null }) },
      rpc: async (nome, args) => { chamadas.push({ nome, args }); return { data: [], error: null }; },
    } },
  };
  const exports = {};
  const source = fs.readFileSync(require.resolve('../app/lib/agenda.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(js, { exports, require: nome => mocks[nome] });
  return { api: exports, chamadas };
}

test('acesso direto sem visualizar é bloqueado antes de qualquer consulta RPC', async () => {
  const { api, chamadas } = agenda();
  await assert.rejects(api.carregarAgenda(), /permissão para visualizar/);
  assert.equal(chamadas.length, 0);
});

test('sessão ausente não consulta dados', async () => {
  const { api, chamadas } = agenda({ usuario: false });
  await assert.rejects(api.carregarAgenda(), /sessão expirou/);
  assert.equal(chamadas.length, 0);
});

test('leitura permitida preserva titular para preposto, representante e administrador', async () => {
  for (const config of [
    { papel: 'preposto', visualizar: true },
    { papel: 'usuario' },
    { papel: 'admin', administrado: { userId: 'representante-administrado' } },
  ]) {
    const { api, chamadas } = agenda(config);
    await api.carregarAgenda();
    assert.equal(chamadas.length, 4);
    assert.ok(chamadas.every(c => c.args.p_titular_user_id === (config.administrado?.userId ?? 'titular')));
  }
});

test('permissão de leitura não permite alterações', async () => {
  const { api, chamadas } = agenda({ visualizar: true });
  await assert.rejects(api.salvarEventoAgenda({ titulo: 'Teste' }), /permissão para cadastrar/);
  await assert.rejects(api.salvarEventoAgenda({ id: 'evento' }), /permissão para editar/);
  await assert.rejects(api.atualizarStatusAgenda('evento', 'Concluído'), /permissão para alterar/);
  await assert.rejects(api.cancelarFuturosFrequenciaAgenda('evento'), /permissão para alterar/);
  assert.equal(chamadas.length, 0);
});
