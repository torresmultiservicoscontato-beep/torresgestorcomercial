import { supabase } from "./supabase";

export type PerfilComercial = {
  userId: string;
  nome: string;
  nomeRepresentacao: string;
  documentoTipo: "CPF" | "CNPJ";
  documento: string;
  whatsapp: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  representadas: string[];
};

type PerfilRow = {
  user_id: string;
  nome: string;
  nome_representacao: string;
  documento_tipo: "CPF" | "CNPJ";
  documento: string;
  whatsapp: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

async function buscarPerfil(userId: string): Promise<PerfilComercial | null> {
  if (!supabase) return null;

  const [{ data: perfil, error: perfilError }, { data: representadas, error: representadasError }] =
    await Promise.all([
      supabase
        .from("perfis")
        .select(
          "user_id,nome,nome_representacao,documento_tipo,documento,whatsapp,cep,logradouro,numero,complemento,bairro,cidade,uf",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("perfil_representadas")
        .select("nome")
        .eq("user_id", userId)
        .order("nome"),
    ]);

  if (perfilError) throw new Error(`Falha ao carregar perfil: ${perfilError.message}`);
  if (representadasError) {
    throw new Error(`Falha ao carregar representadas: ${representadasError.message}`);
  }
  if (!perfil) return null;

  const row = perfil as PerfilRow;
  return {
    userId: row.user_id,
    nome: row.nome,
    nomeRepresentacao: row.nome_representacao,
    documentoTipo: row.documento_tipo,
    documento: row.documento,
    whatsapp: row.whatsapp,
    cep: row.cep,
    logradouro: row.logradouro,
    numero: row.numero,
    complemento: row.complemento,
    bairro: row.bairro,
    cidade: row.cidade,
    uf: row.uf,
    representadas: (representadas ?? []).map((item) => item.nome),
  };
}

export async function carregarPerfilAtual(): Promise<PerfilComercial | null> {
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return buscarPerfil(user.id);
}

export async function salvarPerfilAtual(perfil: Omit<PerfilComercial, "userId">): Promise<PerfilComercial> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Usuário não autenticado.");

  const { error: perfilError } = await supabase.from("perfis").upsert(
    {
      user_id: user.id,
      nome: perfil.nome.trim(),
      nome_representacao: perfil.nomeRepresentacao.trim(),
      documento_tipo: perfil.documentoTipo,
      documento: perfil.documento.trim(),
      whatsapp: perfil.whatsapp.trim(),
      cep: perfil.cep.trim(),
      logradouro: perfil.logradouro.trim(),
      numero: perfil.numero.trim(),
      complemento: perfil.complemento.trim(),
      bairro: perfil.bairro.trim(),
      cidade: perfil.cidade.trim(),
      uf: perfil.uf.trim().toUpperCase().slice(0, 2),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (perfilError) throw new Error(`Falha ao salvar perfil: ${perfilError.message}`);

  const representadas = Array.from(
    new Set(perfil.representadas.map((item) => item.trim()).filter(Boolean)),
  );

  const { error: deleteError } = await supabase
    .from("perfil_representadas")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) {
    throw new Error(`Falha ao atualizar representadas: ${deleteError.message}`);
  }

  if (representadas.length > 0) {
    const { error: insertError } = await supabase.from("perfil_representadas").insert(
      representadas.map((nome) => ({ user_id: user.id, nome })),
    );

    if (insertError) {
      throw new Error(`Falha ao salvar representadas: ${insertError.message}`);
    }
  }

  const salvo = await buscarPerfil(user.id);
  if (!salvo) throw new Error("Perfil não encontrado após a gravação.");
  return salvo;
}

export async function sincronizarPerfilDoUsuario(): Promise<PerfilComercial | null> {
  return carregarPerfilAtual();
}
