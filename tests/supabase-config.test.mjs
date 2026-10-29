import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = ts.transpileModule(fs.readFileSync('app/lib/supabase.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
function carregar(env) {
  const exports = {}, chamadas = [];
  vm.runInNewContext(source, { exports, URL, process: { env }, require: () => ({
    createClient: (...args) => { chamadas.push(args); return { auth: {} }; },
  }) });
  return { ...exports, chamadas };
}
const valido = { NEXT_PUBLIC_APP_ENV: 'test', NEXT_PUBLIC_SUPABASE_URL: 'https://bwoxqsbqbtrkfvrsswrq.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_mock_only' };
test('configuração ausente, parcial ou de exemplo não derruba a página nem cria cliente', () => {
  for (const env of [{}, { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'x' }, { ...valido, NEXT_PUBLIC_APP_ENV: '' }, { ...valido, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'COLE_A_CHAVE_PUBLICA_DO_PROJETO_DE_TESTES' }, { ...valido, NEXT_PUBLIC_SUPABASE_URL: 'inválida' }]) {
    const api = carregar(env);
    assert.equal(api.supabase, null);
    assert.ok(api.supabaseConfigurationError);
    assert.equal(api.chamadas.length, 0);
  }
});
test('test rejeita produção e URLs não canônicas sem chamadas externas', () => {
  for (const url of ['https://sqlrhvxiluzgeldxcmyf.supabase.co', 'http://bwoxqsbqbtrkfvrsswrq.supabase.co', 'https://bwoxqsbqbtrkfvrsswrq.supabase.co/extra', 'https://usuario@bwoxqsbqbtrkfvrsswrq.supabase.co']) {
    const api = carregar({ ...valido, NEXT_PUBLIC_SUPABASE_URL: url });
    assert.equal(api.supabase, null);
    assert.equal(api.chamadas.length, 0);
  }
});
test('configuração de testes e alias anon inicializam apenas o projeto de testes', () => {
  for (const env of [valido, { ...valido, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon_mock_only' }]) {
    const api = carregar(env);
    assert.equal(api.supabaseConfigurationError, null);
    assert.equal(api.supabaseConfigured, true);
    assert.equal(api.chamadas.length, 1);
    assert.equal(api.chamadas[0][0], valido.NEXT_PUBLIC_SUPABASE_URL);
  }
});
