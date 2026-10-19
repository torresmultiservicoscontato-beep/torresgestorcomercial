import { carregarAcessoAtual } from "./acesso";
import { obterRepresentanteAdministrado } from "./adminContext";
import { supabase } from "./supabase";

export type RepresentadaModulo = {
  id: string;
  nome: string;
  endereco: string;
  email: string;
  telefone: string;
  cnpj: string;
  comissaoPercentual: number | null;
  baseComissao: "liquidado" | "faturado";
  diaRecebimentoComissao: number | null;
  observacaoComissao: string;
  comissaoPrepostoPercentual: number | null;
  diaPagamentoPreposto: number | null;
  modo: "gestao" | "preposto";
};

export type ProdutoRepresentada = {
  id: string;
  codigo: string;
  nome: string;
  unidade: string;
  ativo: boolean;
};

export type PrepostoRepresentada = {
  vinculoId: string;
  prepostoUserId: string | null;
  nome: string;
  comissaoPrepostoPercentual: number;
  diaPagamentoComissao: number | null;
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

  if (error || !user) throw new Error("Sua sessão expirou. Entre novamente no sistema.");

  const acesso = await carregarAcessoAtual();
  if (!acesso) throw new Error("Não foi possível identificar seu acesso.");

  let titularUserId = acesso.titularUserId;
  const administrado = acesso.papel === "admin" ? obterRepresentanteAdministrado() : null;
  if (administrado?.userId) titularUserId = administrado.userId;

  return { cliente, acesso, titularUserId };
}

export async function carregarRepresentadasModulo(): Promise<{
  modo: "gestao" | "preposto";
  titularUserId: string;
  representadas: RepresentadaModulo[];
}> {
  const { cliente, acesso, titularUserId } = await contexto();

  const { data, error } = await cliente.rpc("listar_representadas_modulo", {
    p_titular_user_id: titularUserId,
  });

  if (error) throw new Error(`Falha ao carregar representadas: ${error.message}`);

  const representadas = (data ?? []).map((item: any) => ({
    id: item.representada_id,
    nome: item.nome,
    endereco: item.endereco ?? "",
    email: item.email ?? "",
    telefone: item.telefone ?? "",
    cnpj: item.cnpj ?? "",
    comissaoPercentual: item.comissao_percentual === null ? null : Number(item.comissao_percentual),
    baseComissao: item.base_comissao === "faturado" ? "faturado" : "liquidado",
    diaRecebimentoComissao: item.dia_recebimento_comissao === null ? null : Number(item.dia_recebimento_comissao),
    observacaoComissao: item.observacao_comissao ?? "",
    comissaoPrepostoPercentual: item.comissao_preposto_percentual === null ? null : Number(item.comissao_preposto_percentual),
    diaPagamentoPreposto: item.dia_pagamento_preposto === null ? null : Number(item.dia_pagamento_preposto),
    modo: item.modo === "preposto" ? "preposto" : "gestao",
  })) as RepresentadaModulo[];

  return {
    modo: acesso.papel === "preposto" ? "preposto" : "gestao",
    titularUserId,
    representadas,
  };
}

export async function salvarRepresentada(input: {
  id?: string | null;
  nome: string;
  endereco: string;
  email: string;
  telefone: string;
  cnpj: string;
  comissaoPercentual: number;
  baseComissao: "liquidado" | "faturado";
  diaRecebimentoComissao: number | null;
  observacaoComissao: string;
}) {
  const { cliente, titularUserId, acesso } = await contexto();
  if (acesso.papel === "preposto") throw new Error("Preposto não pode alterar dados da representada.");

  const { data, error } = await cliente.rpc("salvar_representada_operacao", {
    p_titular_user_id: titularUserId,
    p_representada_id: input.id ?? null,
    p_nome: input.nome,
    p_endereco: input.endereco,
    p_email: input.email,
    p_telefone: input.telefone,
    p_cnpj: input.cnpj,
    p_comissao_percentual: input.comissaoPercentual,
    p_base_comissao: input.baseComissao,
    p_dia_recebimento_comissao: input.diaRecebimentoComissao,
    p_observacao_comissao: input.observacaoComissao,
  });

  if (error) throw new Error(`Falha ao salvar representada: ${error.message}`);
  return data as string;
}

export async function carregarProdutosRepresentada(representadaId: string): Promise<ProdutoRepresentada[]> {
  const { cliente, titularUserId, acesso } = await contexto();
  if (acesso.papel === "preposto") return [];

  const { data, error } = await cliente
    .from("representada_produtos")
    .select("id,codigo,nome,unidade,ativo")
    .eq("titular_user_id", titularUserId)
    .eq("representada_id", representadaId)
    .order("nome");

  if (error) throw new Error(`Falha ao carregar produtos: ${error.message}`);

  return (data ?? []).map((item) => ({
    id: item.id,
    codigo: item.codigo ?? "",
    nome: item.nome,
    unidade: item.unidade ?? "",
    ativo: Boolean(item.ativo),
  }));
}

export async function salvarProdutoRepresentada(representadaId: string, input: {
  id?: string | null;
  codigo: string;
  nome: string;
  unidade: string;
  ativo: boolean;
}) {
  const { cliente, titularUserId, acesso } = await contexto();
  if (acesso.papel === "preposto") throw new Error("Preposto não pode alterar produtos.");

  const { data, error } = await cliente.rpc("salvar_produto_representada", {
    p_titular_user_id: titularUserId,
    p_representada_id: representadaId,
    p_id: input.id ?? null,
    p_codigo: input.codigo,
    p_nome: input.nome,
    p_unidade: input.unidade,
    p_ativo: input.ativo,
  });

  if (error) throw new Error(`Falha ao salvar produto: ${error.message}`);
  return data as string;
}

export async function carregarPrepostosRepresentada(representadaId: string): Promise<PrepostoRepresentada[]> {
  const { cliente, titularUserId, acesso } = await contexto();
  if (acesso.papel === "preposto") return [];

  const { data, error } = await cliente.rpc("listar_prepostos_representada", {
    p_titular_user_id: titularUserId,
    p_representada_id: representadaId,
  });

  if (error) throw new Error(`Falha ao carregar prepostos da representada: ${error.message}`);

  return (data ?? []).map((item: any) => ({
    vinculoId: item.vinculo_id,
    prepostoUserId: item.preposto_user_id ?? null,
    nome: item.nome,
    comissaoPrepostoPercentual: Number(item.comissao_preposto_percentual ?? 0),
    diaPagamentoComissao: item.dia_pagamento_comissao === null ? null : Number(item.dia_pagamento_comissao),
  }));
}

export async function salvarRepassePreposto(input: {
  representadaId: string;
  vinculoId: string;
  comissaoPercentual: number;
  diaPagamento: number | null;
}) {
  const { cliente, titularUserId, acesso } = await contexto();
  if (acesso.papel === "preposto") throw new Error("Preposto não pode alterar comissão.");

  const { error } = await cliente.rpc("salvar_repasse_preposto_representada", {
    p_titular_user_id: titularUserId,
    p_vinculo_id: input.vinculoId,
    p_representada_id: input.representadaId,
    p_comissao_percentual: input.comissaoPercentual,
    p_dia_pagamento: input.diaPagamento,
  });

  if (error) throw new Error(`Falha ao salvar repasse do preposto: ${error.message}`);
}


export type ResumoProdutosRepresentada = {
  total: number;
  comissaoEspecifica: number;
};

export async function carregarResumoProdutosRepresentadas(): Promise<Record<string, ResumoProdutosRepresentada>> {
  const { cliente, titularUserId, acesso } = await contexto();
  if (acesso.papel === "preposto") return {};

  const { data, error } = await cliente
    .from("representada_produtos")
    .select("representada_id,comissao_percentual")
    .eq("titular_user_id", titularUserId);

  if (error) throw new Error(`Falha ao resumir produtos das representadas: ${error.message}`);

  const resumo: Record<string, ResumoProdutosRepresentada> = {};
  for (const item of data ?? []) {
    const atual = resumo[item.representada_id] ?? { total: 0, comissaoEspecifica: 0 };
    atual.total += 1;
    if (item.comissao_percentual !== null) atual.comissaoEspecifica += 1;
    resumo[item.representada_id] = atual;
  }

  return resumo;
}
