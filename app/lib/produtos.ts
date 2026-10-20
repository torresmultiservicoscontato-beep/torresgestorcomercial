import { validarQuantidadeMinima } from "./produtoQuantidade";
import { carregarAcessoAtual } from "./acesso";
import { obterRepresentanteAdministrado } from "./adminContext";
import { supabase } from "./supabase";

export type ProdutoModulo = {
  id: string;
  representadaId: string;
  representadaNome: string;
  codigo: string;
  nome: string;
  unidade: string;
  quantidadeMinima: number;
  ativo: boolean;
  comissaoRepresentantePercentual: number | null;
  comissaoPrepostoPercentual: number | null;
  comissaoPrepostoEspecifica: boolean;
};

export type RepresentadaProdutoFiltro = {
  id: string;
  nome: string;
  comissaoGeral: number;
};

export type PrepostoProduto = {
  vinculoId: string;
  nome: string;
  comissaoGeral: number;
  diaPagamento: number | null;
};

export type ComissaoProdutoPreposto = {
  produtoId: string;
  produtoNome: string;
  codigo: string;
  comissaoRepresentantePercentual: number;
  comissaoPrepostoPercentual: number;
  especifica: boolean;
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

export async function carregarRepresentadasProdutos(): Promise<{
  modo: "gestao" | "preposto";
  representadas: RepresentadaProdutoFiltro[];
}> {
  const { cliente, acesso, titularUserId } = await contexto();

  const { data, error } = await cliente.rpc("listar_representadas_modulo", {
    p_titular_user_id: titularUserId,
  });

  if (error) throw new Error(`Falha ao carregar representadas: ${error.message}`);

  return {
    modo: acesso.papel === "preposto" ? "preposto" : "gestao",
    representadas: (data ?? []).map((item: any) => ({
      id: item.representada_id,
      nome: item.nome,
      comissaoGeral: Number(item.comissao_percentual ?? 0),
    })),
  };
}

export async function carregarProdutosModulo(representadaId?: string): Promise<ProdutoModulo[]> {
  const { cliente, titularUserId } = await contexto();

  const { data, error } = await cliente.rpc("listar_produtos_modulo_v2", {
    p_titular_user_id: titularUserId,
    p_representada_id: representadaId || null,
  });

  if (error) throw new Error(`Falha ao carregar produtos: ${error.message}`);

  return (data ?? []).map((item: any) => ({
    id: item.produto_id,
    representadaId: item.representada_id,
    representadaNome: item.representada_nome,
    codigo: item.codigo ?? "",
    nome: item.nome,
    unidade: item.unidade ?? "",
    quantidadeMinima: Number(item.quantidade_minima ?? 1),
    ativo: Boolean(item.ativo),
    comissaoRepresentantePercentual: item.comissao_representante_percentual === null
      ? null
      : Number(item.comissao_representante_percentual),
    comissaoPrepostoPercentual: item.comissao_preposto_percentual === null
      ? null
      : Number(item.comissao_preposto_percentual),
    comissaoPrepostoEspecifica: Boolean(item.comissao_preposto_especifica),
  }));
}

export async function salvarProduto(input: {
  id?: string | null;
  representadaId: string;
  codigo: string;
  nome: string;
  unidade: string;
  quantidadeMinima: number;
  ativo: boolean;
  comissaoPercentual: number | null;
}) {
  validarQuantidadeMinima(input.quantidadeMinima);
  const { cliente, titularUserId, acesso } = await contexto();
  if (acesso.papel === "preposto") throw new Error("Preposto não pode alterar produtos.");

  const { data, error } = await cliente.rpc("salvar_produto_representada_v3", {
    p_titular_user_id: titularUserId,
    p_representada_id: input.representadaId,
    p_id: input.id ?? null,
    p_codigo: input.codigo,
    p_nome: input.nome,
    p_unidade: input.unidade,
    p_quantidade_minima: input.quantidadeMinima,
    p_ativo: input.ativo,
    p_comissao_percentual: input.comissaoPercentual,
  });

  if (error) throw new Error(`Falha ao salvar produto: ${error.message}`);
  return data as string;
}

export async function carregarPrepostosProduto(representadaId: string): Promise<PrepostoProduto[]> {
  const { cliente, titularUserId, acesso } = await contexto();
  if (acesso.papel === "preposto") return [];

  const { data, error } = await cliente.rpc("listar_prepostos_representada", {
    p_titular_user_id: titularUserId,
    p_representada_id: representadaId,
  });

  if (error) throw new Error(`Falha ao carregar prepostos: ${error.message}`);

  return (data ?? []).map((item: any) => ({
    vinculoId: item.vinculo_id,
    nome: item.nome,
    comissaoGeral: Number(item.comissao_preposto_percentual ?? 0),
    diaPagamento: item.dia_pagamento_comissao === null ? null : Number(item.dia_pagamento_comissao),
  }));
}

export async function carregarComissoesProdutosPreposto(
  representadaId: string,
  vinculoId: string,
): Promise<ComissaoProdutoPreposto[]> {
  const { cliente, titularUserId, acesso } = await contexto();
  if (acesso.papel === "preposto") return [];

  const { data, error } = await cliente.rpc("listar_comissoes_produto_preposto", {
    p_titular_user_id: titularUserId,
    p_representada_id: representadaId,
    p_vinculo_id: vinculoId,
  });

  if (error) throw new Error(`Falha ao carregar comissões por produto: ${error.message}`);

  return (data ?? []).map((item: any) => ({
    produtoId: item.produto_id,
    produtoNome: item.produto_nome,
    codigo: item.codigo ?? "",
    comissaoRepresentantePercentual: Number(item.comissao_representante_percentual ?? 0),
    comissaoPrepostoPercentual: Number(item.comissao_preposto_percentual ?? 0),
    especifica: Boolean(item.especifica),
  }));
}

export async function salvarComissaoProdutoPreposto(input: {
  vinculoId: string;
  produtoId: string;
  comissaoPercentual: number | null;
}) {
  const { cliente, titularUserId, acesso } = await contexto();
  if (acesso.papel === "preposto") throw new Error("Preposto não pode alterar comissão.");

  const { error } = await cliente.rpc("salvar_comissao_produto_preposto", {
    p_titular_user_id: titularUserId,
    p_vinculo_id: input.vinculoId,
    p_produto_id: input.produtoId,
    p_comissao_percentual: input.comissaoPercentual,
  });

  if (error) throw new Error(`Falha ao salvar comissão do produto: ${error.message}`);
}
