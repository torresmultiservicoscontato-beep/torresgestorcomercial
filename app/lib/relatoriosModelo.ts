export type VisitaRelatorio = {
  id: string; user_id: string; responsavel_user_id: string | null; cliente_id: string; cliente_nome: string;
  data: string; resultado: string; tipo_contato: string; origem_venda: string; houve_venda: boolean;
  km_trecho: number | null; duracao_minutos: number | null; hora_entrada: string | null; hora_saida: string | null;
  proxima_acao: string; proxima_data: string | null;
};
export type VendaRelatorio = {
  id: string; responsavel_user_id: string; cliente_id: string; cliente_nome: string; visita_id: string | null;
  data: string; valor: number; situacao: string;
};
export type FinanceiroRelatorio = {
  ordem_id: string; venda_id: string; representada_id: string; representada_nome: string; cliente_nome: string;
  responsavel_user_id: string; responsavel_nome: string; data_venda: string; status_pedido: string;
  numero_pedido: string; faturado_em: string | null; valor_faturado: number; valor_liquidado: number;
  comissao_representante_total: number | null; comissao_representante_liberada: number | null; comissao_representante_recebida: number | null;
  comissao_preposto_total: number; comissao_preposto_liberada: number; comissao_preposto_paga: number;
};
export type AgendaRelatorio = { id: string; responsavel_user_id: string; cliente_id: string | null; titulo: string; data: string; hora: string | null; tipo: string; status: string };
export const reaisEmCentavos = (valor: number | string | null) => Math.round(Number(valor ?? 0) * 100);
export function resumoComercial(visitas: VisitaRelatorio[], vendas: VendaRelatorio[]) {
  const validas = vendas.filter(v => v.situacao !== 'Cancelado');
  const total = validas.reduce((s, v) => s + reaisEmCentavos(v.valor), 0);
  const visitados = new Set(visitas.map(v => v.cliente_id));
  const compradores = new Set(validas.map(v => v.cliente_id));
  const positivadosVisitados = [...visitados].filter(id => compradores.has(id)).length;
  return {
    visitas: visitas.length, visitados: visitados.size, pedidos: validas.length, compradores: compradores.size,
    total, maior: validas.reduce((maior,v) => Math.max(maior,reaisEmCentavos(v.valor)),0), ticket: validas.length ? Math.round(total / validas.length) : 0,
    positivacao: visitados.size ? positivadosVisitados / visitados.size * 100 : null,
    semFechamento: [...visitados].filter(id => !compradores.has(id)),
    km: visitas.reduce((s, v) => s + Math.max(0, Number(v.km_trecho ?? 0)), 0),
    kmInformados: visitas.filter(v => v.km_trecho !== null).length,
    minutos: visitas.reduce((s, v) => s + Math.max(0, Number(v.duracao_minutos ?? 0)), 0),
  };
}
export function resumoFinanceiro(pedidos: FinanceiroRelatorio[], preposto: boolean) {
  return pedidos.filter(p => p.status_pedido !== 'Cancelado').reduce((s, p) => {
    s.faturado += reaisEmCentavos(p.valor_faturado); s.liquidado += reaisEmCentavos(p.valor_liquidado);
    s.prevista += reaisEmCentavos(preposto ? p.comissao_preposto_total : p.comissao_representante_total);
    s.liberada += reaisEmCentavos(preposto ? p.comissao_preposto_liberada : p.comissao_representante_liberada);
    s.recebida += reaisEmCentavos(preposto ? p.comissao_preposto_paga : p.comissao_representante_recebida);
    s.repasse += reaisEmCentavos(p.comissao_preposto_paga);
    return s;
  }, { faturado: 0, liquidado: 0, prevista: 0, liberada: 0, recebida: 0, repasse: 0 });
}
// Aspas preservam separadores/quebras; apóstrofo neutraliza fórmulas em planilhas.
export function gerarCsv(linhas: (string | number | null)[][]) {
  return '\uFEFF' + linhas.map(linha => linha.map(valor => {
    let texto = String(valor ?? '');
    if (typeof valor === 'string' && /^[\s]*[=+@-]/.test(texto)) texto = "'" + texto;
    return '"' + texto.replace(/"/g, '""') + '"';
  }).join(';')).join('\r\n');
}
