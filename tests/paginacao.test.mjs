import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
const modulo = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync('app/lib/paginacao.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(modulo.exports);
const { calcularPagina } = modulo.exports;

test('paginação percorre todos os registros sem repetição ou perda', () => {
  for (const tamanho of [10, 25, 50]) {
    const registros = Array.from({length: 103}, (_, i) => i);
    const vistos = [];
    for (let pagina = 1; pagina <= Math.ceil(registros.length / tamanho); pagina++) {
      const p = calcularPagina(registros.length, pagina, tamanho);
      vistos.push(...registros.slice(p.inicio, p.fim));
    }
    assert.deepEqual(vistos, registros);
  }
});

test('exclusão do último registro ajusta a página e lista vazia mantém limites válidos', () => {
  assert.equal(calcularPagina(26, 2, 25).pagina, 2);
  assert.equal(calcularPagina(25, 2, 25).pagina, 1);
  const vazio = calcularPagina(0, 3, 25);
  assert.deepEqual([vazio.pagina, vazio.paginas, vazio.inicio, vazio.fim], [1, 1, 0, 0]);
  assert.equal(calcularPagina(50, -1, 25).pagina, 1);
});
