import { supabase } from "./supabase";

export type ResumoAdmin = {
  usuarios: number;
  clientes: number;
  visitas: number;
  representadas: number;
};

export type UsuarioAdmin = {
  userId: string;
  email: string;
  nome: string;
  nomeRepresentacao: string;
  papel: "usuario" | "admin";
  criadoEm: string;
  clientes: number;
  visitas: number;
  representadas: number;
};

type UsuarioAdminRow = {
  user_id: string;
  email: string | null;
  nome: string | null;
  nome_representacao: string | null;
  papel: "usuario" | "admin";
  criado_em: string;
  clientes: number;
  visitas: number;
  representadas: number;
};

export async function carregarResumoAdmin(): Promise<ResumoAdmin> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data, error } = await supabase.rpc("admin_resumo");
  if (error) throw new Error(`Falha ao carregar painel administrativo: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Resumo administrativo indisponível.");

  return {
    usuarios: Number(row.usuarios ?? 0),
    clientes: Number(row.clientes ?? 0),
    visitas: Number(row.visitas ?? 0),
    representadas: Number(row.representadas ?? 0),
  };
}

export async function listarUsuariosAdmin(): Promise<UsuarioAdmin[]> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data, error } = await supabase.rpc("admin_listar_usuarios");
  if (error) throw new Error(`Falha ao carregar usuários: ${error.message}`);

  return ((data ?? []) as UsuarioAdminRow[]).map((row) => ({
    userId: row.user_id,
    email: row.email ?? "",
    nome: row.nome ?? "Cadastro pendente",
    nomeRepresentacao: row.nome_representacao ?? "Não informado",
    papel: row.papel,
    criadoEm: row.criado_em,
    clientes: Number(row.clientes ?? 0),
    visitas: Number(row.visitas ?? 0),
    representadas: Number(row.representadas ?? 0),
  }));
}
