import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';

function carregar(base, rpc) {
  const modulo = { exports: {} };
  const dependencias = {
    './data': { carregarClientes: async () => base },
    './supabase': { supabase: { rpc } },
  };
  const codigo = ts.transpileModule(fs.readFileSync('app/lib/clientesDetalhados.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('require', 'exports', codigo)((nome) => dependencias[nome] ?? {}, modulo.exports);
  return modulo.exports.carregarClientesDetalhados();
}

test('resumos em lotes preservam clientes, datas, endereços e ordem original', async () => {
  const base = Array.from({ length: 401 }, (_, i) => ({ id: String(i), nome: `Cliente ${i}` }));
  const tamanhos = [];
  const resultado = await carregar(base, async (nome, { p_ids, p_hoje }) => {
    assert.equal(nome, 'carregar_resumo_clientes');
    assert.match(p_hoje, /^\d{4}-\d{2}-\d{2}$/);
    tamanhos.push(p_ids.length);
    return { data: [...p_ids].reverse().map(id => ({ id, logradouro: 'Rua A', ultima_visita: '2026-10-20', proxima_visita_prevista: null })), error: null };
  });
  assert.deepEqual(tamanhos, [200, 200, 1]);
  assert.deepEqual(resultado.map(c => c.id), base.map(c => c.id));
  assert.equal(resultado[400].ultimaVisita, '2026-10-20');
  assert.equal(resultado[400].logradouro, 'Rua A');
  assert.equal(resultado[0].proximaVisitaPrevista, null);
});

test('lista vazia não consulta e erro não retorna resultado parcial', async () => {
  assert.deepEqual(await carregar([], () => { throw new Error('Não deveria consultar'); }), []);
  let chamadas = 0;
  await assert.rejects(carregar(Array.from({length: 201}, (_, i) => ({id: String(i)})), async () => {
    chamadas++;
    return chamadas === 1 ? {data: [], error: null} : {data: null, error: {message: 'Falha de rede'}};
  }), /Falha de rede/);
  assert.equal(chamadas, 2);
});
