import { obterRepresentanteAdministrado } from "./adminContext";
import { carregarPerfilAtual } from "./perfil";
import { supabase } from "./supabase";

export type AcaoPermissao = "visualizar" | "cadastrar" | "editar";
export type ModuloPermissao = "clientes" | "rotas" | "visitas" | "vendas" | "agenda" | "relatorios";
export type PermissoesPreposto = Record<ModuloPermissao, Record<AcaoPermissao, boolean>>;
export type StatusVinculoPreposto = "pendente" | "ativo" | "inativo" | "recusado";

export type Preposto = {
  id: string;
  titularUserId: string;
  userId: string | null;
  nome: string;
  email: string;
  whatsapp: string;
  status: StatusVinculoPreposto;
  permissoes: PermissoesPreposto;
  criadoEm: string;
  atualizadoEm: string;
};

export type VinculoPreposto = {
  id: string;
  titularUserId: string;
  nomeRepresentante: string;
  nomeRepresentacao: string;
  status: StatusVinculoPreposto;
  permissoes: PermissoesPreposto;
  criadoEm: string;
};

type PrepostoRow = {
  id: string;
  titular_user_id: string;
  user_id: string | null;
  nome: string;
  email: string;
  whatsapp: string;
  status: StatusVinculoPreposto;
  permissoes: PermissoesPreposto;
  created_at: string;
  updated_at: string;
};

type VinculoRow = {
  id: string;
  titular_user_id: string;
  nome_representante: string;
  nome_representacao: string;
  status: StatusVinculoPreposto;
  permissoes: PermissoesPreposto;
  created_at: string;
};

export const permissoesPadrao: PermissoesPreposto = {
  clientes: { visualizar: true, cadastrar: true, editar: true },
  rotas: { visualizar: true, cadastrar: true, editar: true },
  visitas: { visualizar: true, cadastrar: true, editar: true },
  vendas: { visualizar: true, cadastrar: true, editar: true },
  agenda: { visualizar: true, cadastrar: true, editar: true },
  relatorios: { visualizar: true, cadastrar: false, editar: false },
};

function mapear(row: PrepostoRow): Preposto {
  return {
    id: row.id,
    titularUserId: row.titular_user_id,
    userId: row.user_id,
    nome: row.nome,
    email: row.email,
    whatsapp: row.whatsapp,
    status: row.status,
    permissoes: row.permissoes,
    criadoEm: row.created_at,
    atualizadoEm: row.updated_at,
  };
}

async function resolverTitular() {
  if (!supabase) throw new Error("Supabase não configurado.");

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Sua sessão expirou. Entre novamente.");

  const perfil = await carregarPerfilAtual();
  if (!perfil) throw new Error("Somente o representante titular pode administrar a equipe.");

  const administrado = perfil.papel === "admin" ? obterRepresentanteAdministrado() : null;
  return administrado?.userId ?? user.id;
}

export async function listarPrepostos(): Promise<Preposto[]> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const titularUserId = await resolverTitular();

  const { data, error } = await supabase
    .from("prepostos")
    .select("id,titular_user_id,user_id,nome,email,whatsapp,status,permissoes,created_at,updated_at")
    .eq("titular_user_id", titularUserId)
    .neq("status", "recusado")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Falha ao carregar equipe: ${error.message}`);
  return ((data ?? []) as PrepostoRow[]).map(mapear);
}

export async function solicitarVinculoPreposto(input: {
  email: string;
  permissoes: PermissoesPreposto;
}): Promise<Preposto> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const titularUserId = await resolverTitular();

  const { data, error } = await supabase.rpc("solicitar_vinculo_preposto", {
    p_titular_user_id: titularUserId,
    p_email: input.email.trim().toLowerCase(),
    p_permissoes: input.permissoes,
  });

  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Não foi possível criar a solicitação de vínculo.");
  return mapear(row as PrepostoRow);
}

export async function atualizarPreposto(preposto: Preposto): Promise<Preposto> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const titularUserId = await resolverTitular();

  const novoStatus = preposto.status === "pendente" ? "pendente" : preposto.status;
  const { data, error } = await supabase
    .from("prepostos")
    .update({
      status: novoStatus,
      permissoes: preposto.permissoes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", preposto.id)
    .eq("titular_user_id", titularUserId)
    .select("id,titular_user_id,user_id,nome,email,whatsapp,status,permissoes,created_at,updated_at")
    .single();

  if (error) throw new Error(`Falha ao atualizar vínculo: ${error.message}`);
  return mapear(data as PrepostoRow);
}

export async function listarVinculosPrepostoAtual(): Promise<VinculoPreposto[]> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data, error } = await supabase.rpc("listar_vinculos_preposto_atual");
  if (error) throw new Error(`Falha ao carregar seus vínculos: ${error.message}`);

  return ((data ?? []) as VinculoRow[]).map((row) => ({
    id: row.id,
    titularUserId: row.titular_user_id,
    nomeRepresentante: row.nome_representante,
    nomeRepresentacao: row.nome_representacao,
    status: row.status,
    permissoes: row.permissoes,
    criadoEm: row.created_at,
  }));
}

export async function responderVinculoPreposto(vinculoId: string, aceitar: boolean) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { error } = await supabase.rpc("responder_vinculo_preposto", {
    p_vinculo_id: vinculoId,
    p_aceitar: aceitar,
  });
  if (error) throw new Error(error.message);
}
