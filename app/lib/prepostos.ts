import { obterRepresentanteAdministrado } from "./adminContext";
import { carregarPerfilAtual } from "./perfil";
import { criarSupabaseIsolado, supabase } from "./supabase";

export type AcaoPermissao = "visualizar" | "cadastrar" | "editar";
export type ModuloPermissao = "clientes" | "rotas" | "visitas" | "vendas" | "agenda" | "relatorios";
export type PermissoesPreposto = Record<ModuloPermissao, Record<AcaoPermissao, boolean>>;

export type Preposto = {
  id: string;
  titularUserId: string;
  userId: string | null;
  nome: string;
  email: string;
  whatsapp: string;
  status: "ativo" | "inativo";
  permissoes: PermissoesPreposto;
  criadoEm: string;
  atualizadoEm: string;
};

type PrepostoRow = {
  id: string;
  titular_user_id: string;
  user_id: string | null;
  nome: string;
  email: string;
  whatsapp: string;
  status: "ativo" | "inativo";
  permissoes: PermissoesPreposto;
  created_at: string;
  updated_at: string;
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
  if (!perfil || perfil.papel === "preposto") {
    throw new Error("Somente o representante titular pode administrar a equipe.");
  }

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
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Falha ao carregar equipe: ${error.message}`);
  return ((data ?? []) as PrepostoRow[]).map(mapear);
}

export async function criarPreposto(input: {
  nome: string;
  email: string;
  whatsapp: string;
  senhaTemporaria: string;
  permissoes: PermissoesPreposto;
}): Promise<Preposto> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const titularUserId = await resolverTitular();
  const authIsolado = criarSupabaseIsolado();
  if (!authIsolado) throw new Error("Não foi possível iniciar o cadastro do login.");

  const email = input.email.trim().toLowerCase();
  const { data: authData, error: authError } = await authIsolado.auth.signUp({
    email,
    password: input.senhaTemporaria,
    options: {
      data: {
        must_change_password: true,
        tipo_acesso: "preposto",
      },
    },
  });

  if (authError || !authData.user) {
    const mensagem = authError?.message?.toLowerCase().includes("already")
      ? "Já existe uma conta com esse e-mail."
      : authError?.message ?? "Não foi possível criar o login do preposto.";
    throw new Error(mensagem);
  }

  const { data, error } = await supabase
    .from("prepostos")
    .insert({
      titular_user_id: titularUserId,
      user_id: authData.user.id,
      nome: input.nome.trim(),
      email,
      whatsapp: input.whatsapp.trim(),
      status: "ativo",
      permissoes: input.permissoes,
    })
    .select("id,titular_user_id,user_id,nome,email,whatsapp,status,permissoes,created_at,updated_at")
    .single();

  if (error) throw new Error(`Login criado, mas o vínculo com a equipe falhou: ${error.message}`);
  return mapear(data as PrepostoRow);
}

export async function atualizarPreposto(preposto: Preposto): Promise<Preposto> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const titularUserId = await resolverTitular();

  const { data, error } = await supabase
    .from("prepostos")
    .update({
      nome: preposto.nome.trim(),
      whatsapp: preposto.whatsapp.trim(),
      status: preposto.status,
      permissoes: preposto.permissoes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", preposto.id)
    .eq("titular_user_id", titularUserId)
    .select("id,titular_user_id,user_id,nome,email,whatsapp,status,permissoes,created_at,updated_at")
    .single();

  if (error) throw new Error(`Falha ao atualizar preposto: ${error.message}`);
  return mapear(data as PrepostoRow);
}
