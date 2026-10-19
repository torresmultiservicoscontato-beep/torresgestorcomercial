import { carregarAcessoAtual } from "./acesso";
import { obterRepresentanteAdministrado } from "./adminContext";
import { supabase } from "./supabase";

export type ComissaoPedido = {
  ordemId: string;
  vendaId: string;
  representadaId: string;
  representadaNome: string;
  clienteNome: string;
  responsavelUserId: string;
  responsavelNome: string;
  dataVenda: string;
  statusPedido: string;
  numeroPedido: string;
  numeroDocumento: string;
  faturadoEm: string | null;
  valorFaturado: number;
  valorLiquidado: number;
  baseComissao: "faturado" | "liquidado";
  previsaoRepresentante: string | null;
  previsaoPreposto: string | null;
  comissaoRepresentanteTotal: number | null;
  comissaoRepresentanteLiberada: number | null;
  comissaoRepresentanteRecebida: number | null;
  comissaoPrepostoTotal: number;
  comissaoPrepostoLiberada: number;
  comissaoPrepostoPaga: number;
  modo: "gestao" | "preposto";
};

export type RecebimentoPedido = {
  id: string;
  numeroParcela: number;
  vencimento: string | null;
  valorPrevisto: number;
  valorRecebido: number;
  recebidoEm: string | null;
  status: string;
};

function exigirSupabase() {
  if (!supabase) throw new Error("Banco de dados não configurado.");
  return supabase;
}

async function contexto() {
  const cliente = exigirSupabase();
  const {
    data: { user },
    error,
  } = await cliente.auth.getUser();

  if (error || !user) throw new Error("Sua sessão expirou. Entre novamente.");

  const acesso = await carregarAcessoAtual();
  if (!acesso) throw new Error("Não foi possível identificar seu acesso.");

  let titularUserId = acesso.titularUserId;
  const administrado = acesso.papel === "admin" ? obterRepresentanteAdministrado() : null;
  if (administrado?.userId) titularUserId = administrado.userId;

  return { cliente, acesso, titularUserId };
}

function numero(valor: unknown) {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function carregarComissoes(): Promise<{ modo: "gestao" | "preposto"; pedidos: ComissaoPedido[] }> {
  const { cliente, acesso, titularUserId } = await contexto();

  const { data, error } = await cliente.rpc("listar_comissoes_modulo", {
    p_titular_user_id: titularUserId,
  });

  if (error) throw new Error(`Falha ao carregar comissões: ${error.message}`);

  const pedidos = (data ?? []).map((item: any) => ({
    ordemId: item.ordem_id,
    vendaId: item.venda_id,
    representadaId: item.representada_id,
    representadaNome: item.representada_nome,
    clienteNome: item.cliente_nome,
    responsavelUserId: item.responsavel_user_id,
    responsavelNome: item.responsavel_nome,
    dataVenda: item.data_venda,
    statusPedido: item.status_pedido,
    numeroPedido: item.numero_pedido ?? "",
    numeroDocumento: item.numero_documento ?? "",
    faturadoEm: item.faturado_em,
    valorFaturado: numero(item.valor_faturado),
    valorLiquidado: numero(item.valor_liquidado),
    baseComissao: item.base_comissao === "faturado" ? "faturado" : "liquidado",
    previsaoRepresentante: item.previsao_representante,
    previsaoPreposto: item.previsao_preposto,
    comissaoRepresentanteTotal: item.comissao_representante_total === null ? null : numero(item.comissao_representante_total),
    comissaoRepresentanteLiberada: item.comissao_representante_liberada === null ? null : numero(item.comissao_representante_liberada),
    comissaoRepresentanteRecebida: item.comissao_representante_recebida === null ? null : numero(item.comissao_representante_recebida),
    comissaoPrepostoTotal: numero(item.comissao_preposto_total),
    comissaoPrepostoLiberada: numero(item.comissao_preposto_liberada),
    comissaoPrepostoPaga: numero(item.comissao_preposto_paga),
    modo: item.modo === "preposto" ? "preposto" : "gestao",
  })) as ComissaoPedido[];

  return {
    modo: acesso.papel === "preposto" ? "preposto" : "gestao",
    pedidos,
  };
}

export async function carregarRecebimentos(ordemId: string): Promise<RecebimentoPedido[]> {
  const { cliente } = await contexto();
  const { data, error } = await cliente.rpc("listar_recebimentos_ordem", {
    p_ordem_id: ordemId,
  });

  if (error) throw new Error(`Falha ao carregar parcelas: ${error.message}`);

  return (data ?? []).map((item: any) => ({
    id: item.id,
    numeroParcela: Number(item.numero_parcela),
    vencimento: item.vencimento,
    valorPrevisto: numero(item.valor_previsto),
    valorRecebido: numero(item.valor_recebido),
    recebidoEm: item.recebido_em,
    status: item.status,
  }));
}

export async function faturarPedido(input: {
  ordemId: string;
  numeroPedido: string;
  numeroDocumento: string;
  dataFaturamento: string;
  valorFaturado: number;
  parcelas: Array<{ numero: number; vencimento: string; valor: number }>;
}) {
  const { cliente, acesso } = await contexto();
  if (acesso.papel === "preposto") throw new Error("Somente o representante pode faturar pedidos.");

  const { error } = await cliente.rpc("faturar_ordem_venda", {
    p_ordem_id: input.ordemId,
    p_numero_pedido: input.numeroPedido,
    p_numero_documento: input.numeroDocumento,
    p_data_faturamento: input.dataFaturamento,
    p_valor_faturado: input.valorFaturado,
    p_parcelas: input.parcelas,
  });

  if (error) throw new Error(`Falha ao faturar pedido: ${error.message}`);
}

export async function registrarBaixa(input: {
  recebimentoId: string;
  valorRecebido: number;
  dataRecebimento: string;
}) {
  const { cliente, acesso } = await contexto();
  if (acesso.papel === "preposto") throw new Error("Somente o representante pode registrar baixas.");

  const { error } = await cliente.rpc("registrar_baixa_recebimento", {
    p_recebimento_id: input.recebimentoId,
    p_valor_recebido: input.valorRecebido,
    p_data_recebimento: input.dataRecebimento,
  });

  if (error) throw new Error(`Falha ao registrar baixa: ${error.message}`);
}

export async function registrarPagamentoComissao(input: {
  ordemId: string;
  tipo: "representante" | "preposto";
  valor: number;
  data: string;
  observacao?: string;
}) {
  const { cliente, acesso } = await contexto();
  if (acesso.papel === "preposto") throw new Error("Somente o representante pode registrar pagamentos de comissão.");

  const { error } = await cliente.rpc("registrar_pagamento_comissao", {
    p_ordem_id: input.ordemId,
    p_tipo: input.tipo,
    p_valor: input.valor,
    p_data: input.data,
    p_observacao: input.observacao ?? "",
  });

  if (error) throw new Error(`Falha ao registrar pagamento de comissão: ${error.message}`);
}
