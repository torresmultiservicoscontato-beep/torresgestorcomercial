export function validarQuantidadeMinima(valor: number) {
  if (!Number.isFinite(valor) || valor <= 0 || valor > 999999999.999 || Math.abs(valor * 1000 - Math.round(valor * 1000)) > 0.0001) {
    throw new Error('Informe uma quantidade mínima maior que zero, com até três casas decimais.');
  }
  return valor;
}
