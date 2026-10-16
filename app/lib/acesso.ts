import { supabase } from "./supabase";

const CHAVE_OPERACAO_PREPOSTO = "torres_preposto_operacao";

export type OperacaoPreposto = {
  vinculoId: string;
  titularUserId: string;
  nomeTitular: string;
  nomeRepresentacao: string;
};

export type AcessoSistema = {
  userId: string;
  papel: "usuario" | "admin" | "preposto";
  nome: string;
  nomeRepresentacao: string;
  titularUserId: string;
  representadas: string[];
  permissoes: Record<string, Record<string, boolean>>;
  operacoes: OperacaoPreposto[];
  vinculoId?: string;
};

function obterOperacaoPreferida() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CHAVE_OPERACAO_PREPOSTO);
}

export function definirOperacaoPreposto(titularUserId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHAVE_OPERACAO_PREPOSTO, titularUserId);
}

export function limparOperacaoPreposto() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CHAVE_OPERACAO_PREPOSTO);
}

export async function carregarAcessoAtual(): Promise<AcessoSistema | null> {
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: perfil, error: perfilError } = await supabase
    .from("perfis")
    .select("user_id,nome,nome_representacao,papel")
    .eq("user_id", user.id)
    .maybeSingle();

  if (perfilError) throw new Error(perfilError.message);

  if (perfil) {
    const { data: representadas } = await supabase
      .from("perfil_representadas")
      .select("nome")
      .eq("user_id", user.id)
      .order("nome");

    return {
      userId: user.id,
      papel: perfil.papel === "admin" ? "admin" : "usuario",
      nome: perfil.nome,
      nomeRepresentacao: perfil.nome_representacao,
      titularUserId: user.id,
      representadas: (representadas ?? []).map((item) => item.nome),
      permissoes: {},
      operacoes: [],
    };
  }

  const { data: vinculos, error: prepostoError } = await supabase
    .from("prepostos")
    .select("id,user_id,titular_user_id,nome,status,permissoes,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (prepostoError) throw new Error(prepostoError.message);
  if (!vinculos || vinculos.length === 0) return null;

  const ativos = vinculos.filter((vinculo) => vinculo.status === "ativo");
  if (ativos.length === 0) {
    throw new Error("Seu acesso está desativado em todas as operações vinculadas.");
  }

  const titularesIds = ativos.map((vinculo) => vinculo.titular_user_id);
  const { data: titulares, error: titularesError } = await supabase
    .from("perfis")
    .select("user_id,nome,nome_representacao")
    .in("user_id", titularesIds);

  if (titularesError) throw new Error(titularesError.message);

  const titularPorId = new Map((titulares ?? []).map((item) => [item.user_id, item]));
  const operacoes: OperacaoPreposto[] = ativos
    .map((vinculo) => {
      const titular = titularPorId.get(vinculo.titular_user_id);
      if (!titular) return null;
      return {
        vinculoId: vinculo.id,
        titularUserId: vinculo.titular_user_id,
        nomeTitular: titular.nome,
        nomeRepresentacao: titular.nome_representacao,
      };
    })
    .filter((item): item is OperacaoPreposto => Boolean(item));

  if (operacoes.length === 0) throw new Error("Nenhuma operação ativa foi encontrada para este preposto.");

  const preferida = obterOperacaoPreferida();
  const operacaoAtiva = operacoes.find((operacao) => operacao.titularUserId === preferida) ?? operacoes[0];
  definirOperacaoPreposto(operacaoAtiva.titularUserId);

  const vinculoAtivo = ativos.find((vinculo) => vinculo.id === operacaoAtiva.vinculoId);
  if (!vinculoAtivo) throw new Error("Vínculo operacional não encontrado.");

  const { data: representadas, error: representadasError } = await supabase.rpc("listar_representadas_do_vinculo", {
    p_vinculo_id: vinculoAtivo.id,
  });

  if (representadasError) throw new Error(`Falha ao carregar representadas do vínculo: ${representadasError.message}`);

  return {
    userId: user.id,
    papel: "preposto",
    nome: vinculoAtivo.nome,
    nomeRepresentacao: operacaoAtiva.nomeRepresentacao,
    titularUserId: operacaoAtiva.titularUserId,
    representadas: (representadas ?? []).map((item: { nome: string }) => item.nome),
    permissoes: vinculoAtivo.permissoes ?? {},
    operacoes,
    vinculoId: vinculoAtivo.id,
  };
}

export function pode(acesso: AcessoSistema | null, modulo: string, acao: string) {
  if (!acesso) return false;
  if (acesso.papel !== "preposto") return true;
  return Boolean(acesso.permissoes?.[modulo]?.[acao]);
}
