import { supabase } from "./supabase";

export type AcessoSistema = {
  userId: string;
  papel: "usuario" | "admin" | "preposto";
  nome: string;
  nomeRepresentacao: string;
  titularUserId: string;
  representadas: string[];
  permissoes: Record<string, Record<string, boolean>>;
};

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
    };
  }

  const { data: preposto, error: prepostoError } = await supabase
    .from("prepostos")
    .select("user_id,titular_user_id,nome,status,permissoes")
    .eq("user_id", user.id)
    .maybeSingle();

  if (prepostoError) throw new Error(prepostoError.message);
  if (!preposto) return null;
  if (preposto.status !== "ativo") throw new Error("Seu acesso está desativado pelo representante titular.");

  const [{ data: titular }, { data: representadas }] = await Promise.all([
    supabase
      .from("perfis")
      .select("nome_representacao")
      .eq("user_id", preposto.titular_user_id)
      .maybeSingle(),
    supabase
      .from("perfil_representadas")
      .select("nome")
      .eq("user_id", preposto.titular_user_id)
      .order("nome"),
  ]);

  if (!titular) throw new Error("Representante titular não encontrado.");

  return {
    userId: user.id,
    papel: "preposto",
    nome: preposto.nome,
    nomeRepresentacao: titular.nome_representacao,
    titularUserId: preposto.titular_user_id,
    representadas: (representadas ?? []).map((item) => item.nome),
    permissoes: preposto.permissoes ?? {},
  };
}

export function pode(acesso: AcessoSistema | null, modulo: string, acao: string) {
  if (!acesso) return false;
  if (acesso.papel !== "preposto") return true;
  return Boolean(acesso.permissoes?.[modulo]?.[acao]);
}
