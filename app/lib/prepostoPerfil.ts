import { supabase } from "./supabase";

export type PerfilPreposto = {
  userId: string;
  email: string;
  nome: string;
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
};

type PerfilPrepostoRow = {
  user_id: string;
  email: string;
  nome: string;
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

function mapear(row: PerfilPrepostoRow): PerfilPreposto {
  return {
    userId: row.user_id,
    email: row.email,
    nome: row.nome,
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
  };
}

export async function carregarPerfilPrepostoAtual(): Promise<PerfilPreposto | null> {
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data, error: perfilError } = await supabase
    .from("preposto_perfis")
    .select("user_id,email,nome,documento_tipo,documento,whatsapp,cep,logradouro,numero,complemento,bairro,cidade,uf")
    .eq("user_id", user.id)
    .maybeSingle();

  if (perfilError) throw new Error(perfilError.message);
  return data ? mapear(data as PerfilPrepostoRow) : null;
}

export async function salvarPerfilPrepostoAtual(input: Omit<PerfilPreposto, "userId" | "email">) {
  if (!supabase) throw new Error("Supabase não configurado.");

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !user.email) throw new Error("Sua sessão expirou. Entre novamente.");

  const { error: salvarError } = await supabase.from("preposto_perfis").upsert({
    user_id: user.id,
    email: user.email.trim().toLowerCase(),
    nome: input.nome.trim(),
    documento_tipo: input.documentoTipo,
    documento: input.documento.trim(),
    whatsapp: input.whatsapp.trim(),
    cep: input.cep.trim(),
    logradouro: input.logradouro.trim(),
    numero: input.numero.trim(),
    complemento: input.complemento.trim(),
    bairro: input.bairro.trim(),
    cidade: input.cidade.trim(),
    uf: input.uf.trim().toUpperCase().slice(0, 2),
    updated_at: new Date().toISOString(),
  });

  if (salvarError) throw new Error(`Não foi possível salvar seu cadastro: ${salvarError.message}`);
}

export async function possuiPerfilPrepostoAtual() {
  return Boolean(await carregarPerfilPrepostoAtual());
}
