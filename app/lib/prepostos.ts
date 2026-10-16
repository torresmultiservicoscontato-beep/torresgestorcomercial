import { obterRepresentanteAdministrado } from "./adminContext";
import { carregarPerfilAtual } from "./perfil";
import { supabase } from "./supabase";

export type AcaoPermissao = "visualizar" | "cadastrar" | "editar";
export type ModuloPermissao = "clientes" | "rotas" | "visitas" | "vendas" | "agenda" | "relatorios";
export type PermissoesPreposto = Record<ModuloPermissao, Record<AcaoPermissao, boolean>>;
export type StatusVinculoPreposto = "pendente" | "ativo" | "inativo" | "recusado";

export type RepresentadaVinculo = {
  id: string;
  nome: string;
  cnpj: string | null;
  disponivel?: boolean;
};

export type Preposto = {
  id: string;
  titularUserId: string;
  userId: string | null;
  nome: string;
  email: string;
  whatsapp: string;
  status: StatusVinculoPreposto;
  permissoes: PermissoesPreposto;
  representadas: RepresentadaVinculo[];
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
  representadas: string[];
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
  representadas: string[] | null;
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

function mapear(row: PrepostoRow, representadas: RepresentadaVinculo[] = []): Preposto {
  return {
    id: row.id,
    titularUserId: row.titular_user_id,
    userId: row.user_id,
    nome: row.nome,
    email: row.email,
    whatsapp: row.whatsapp,
    status: row.status,
    permissoes: row.permissoes,
    representadas,
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

async function carregarRepresentadasDosVinculos(vinculoIds: string[]) {
  const resultado = new Map<string, RepresentadaVinculo[]>();
  if (!supabase || vinculoIds.length === 0) return resultado;

  const { data: ligacoes, error: ligacoesError } = await supabase
    .from("preposto_representadas")
    .select("vinculo_id,representada_id")
    .in("vinculo_id", vinculoIds);

  if (ligacoesError) throw new Error(`Falha ao carregar representadas da equipe: ${ligacoesError.message}`);

  const idsRepresentadas = Array.from(new Set((ligacoes ?? []).map((item) => item.representada_id)));
  if (idsRepresentadas.length === 0) return resultado;

  const { data: catalogo, error: catalogoError } = await supabase
    .from("representadas_catalogo")
    .select("id,nome,cnpj")
    .in("id", idsRepresentadas);

  if (catalogoError) throw new Error(`Falha ao carregar catálogo de representadas: ${catalogoError.message}`);
  const porId = new Map((catalogo ?? []).map((item) => [item.id, item]));

  for (const ligacao of ligacoes ?? []) {
    const item = porId.get(ligacao.representada_id);
    if (!item) continue;
    const lista = resultado.get(ligacao.vinculo_id) ?? [];
    lista.push({ id: item.id, nome: item.nome, cnpj: item.cnpj ?? null });
    resultado.set(ligacao.vinculo_id, lista);
  }

  for (const lista of resultado.values()) lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return resultado;
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
  const rows = (data ?? []) as PrepostoRow[];
  const representadas = await carregarRepresentadasDosVinculos(rows.map((row) => row.id));
  return rows.map((row) => mapear(row, representadas.get(row.id) ?? []));
}

export async function listarRepresentadasParaPreposto(
  email: string,
  vinculoId?: string | null,
): Promise<RepresentadaVinculo[]> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const titularUserId = await resolverTitular();

  const { data, error } = await supabase.rpc("listar_representadas_para_preposto", {
    p_titular_user_id: titularUserId,
    p_email: email.trim().toLowerCase(),
    p_vinculo_id: vinculoId ?? null,
  });

  if (error) throw new Error(error.message);
  return (data ?? []).map((item: { representada_id: string; nome: string; cnpj: string | null; disponivel: boolean }) => ({
    id: item.representada_id,
    nome: item.nome,
    cnpj: item.cnpj ?? null,
    disponivel: item.disponivel,
  }));
}

export async function solicitarVinculoPreposto(input: {
  email: string;
  permissoes: PermissoesPreposto;
  representadaIds: string[];
}): Promise<Preposto> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const titularUserId = await resolverTitular();

  const { data, error } = await supabase.rpc("solicitar_vinculo_preposto", {
    p_titular_user_id: titularUserId,
    p_email: input.email.trim().toLowerCase(),
    p_permissoes: input.permissoes,
    p_representadas: input.representadaIds,
  });

  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Não foi possível criar a solicitação de vínculo.");

  const representadas = await carregarRepresentadasDosVinculos([(row as PrepostoRow).id]);
  return mapear(row as PrepostoRow, representadas.get((row as PrepostoRow).id) ?? []);
}

export async function atualizarPreposto(
  preposto: Preposto,
  representadaIds: string[],
): Promise<Preposto> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data, error } = await supabase.rpc("atualizar_vinculo_preposto", {
    p_vinculo_id: preposto.id,
    p_status: preposto.status,
    p_permissoes: preposto.permissoes,
    p_representadas: representadaIds,
  });

  if (error) throw new Error(`Falha ao atualizar vínculo: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Vínculo não encontrado após a atualização.");

  const representadas = await carregarRepresentadasDosVinculos([(row as PrepostoRow).id]);
  return mapear(row as PrepostoRow, representadas.get((row as PrepostoRow).id) ?? []);
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
    representadas: row.representadas ?? [],
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
