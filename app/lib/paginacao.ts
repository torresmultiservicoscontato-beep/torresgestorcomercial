export function calcularPagina(total: number, pagina: number, porPagina: number) {
  const tamanho = [10, 25, 50].includes(porPagina) ? porPagina : 25;
  const paginas = Math.max(1, Math.ceil(total / tamanho));
  const atual = Math.min(paginas, Math.max(1, Math.trunc(pagina) || 1));
  const inicio = (atual - 1) * tamanho;
  return { pagina: atual, paginas, porPagina: tamanho, inicio, fim: Math.min(total, inicio + tamanho), total };
}
