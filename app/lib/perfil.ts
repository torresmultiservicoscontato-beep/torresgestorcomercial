import { limparRepresentanteAdministrado, obterRepresentanteAdministrado } from "./adminContext";
import { supabase } from "./supabase";

export type PapelUsuario = "usuario" | "admin";

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
  papel: PapelUsuario;
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
  papel: PapelUsuario;
};

function chaveRepresentada(valor: string) {
  return valor
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function normalizarListaRepresentadas(itens: string[]) {
  const unicas = new Map<string, string>();
  for (const item of itens) {
    const nome = item.trim();
    const chave = chaveRepresentada(nome);
    if (nome && chave && !unicas.has(chave)) unicas.set(chave, nome);
  }
  return Array.from(unicas.values());
}

async function buscarPerfil(userId: string): Promise<PerfilComercial | null> {
  if (!supabase) return null;

  const [{ data: perfil, error: perfilError }, { data: representadas, error: representadasError }] =
    await Promise.all([
      supabase
        .from("perfis")
        .select(
          "user_id,nome,nome_representacao,documento_tipo,documento,whatsapp,cep,logradouro,numero,complemento,bairro,cidade,uf,papel",
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
    papel: row.papel ?? "usuario",
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

export async function carregarPerfilOperacional(): Promise<PerfilComercial | null> {
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const perfilAtual = await buscarPerfil(user.id);
  if (!perfilAtual) return null;

  const representanteAdministrado = obterRepresentanteAdministrado();
  if (!representanteAdministrado || representanteAdministrado.userId === user.id) {
    return perfilAtual;
  }

  if (perfilAtual.papel !== "admin") {
    limparRepresentanteAdministrado();
    return perfilAtual;
  }

  const perfilAdministrado = await buscarPerfil(representanteAdministrado.userId);
  if (!perfilAdministrado) {
    limparRepresentanteAdministrado();
    return perfilAtual;
  }

  return perfilAdministrado;
}

export async function salvarPerfilAtual(
  perfil: Omit<PerfilComercial, "userId" | "papel">,
): Promise<PerfilComercial> {
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

  const desejadas = normalizarListaRepresentadas(perfil.representadas);
  const { data: atuais, error: atuaisError } = await supabase
    .from("perfil_representadas")
    .select("nome")
    .eq("user_id", user.id);

  if (atuaisError) throw new Error(`Falha ao carregar representadas atuais: ${atuaisError.message}`);

  const atuaisPorChave = new Map((atuais ?? []).map((item) => [chaveRepresentada(item.nome), item.nome]));
  const desejadasPorChave = new Map(desejadas.map((nome) => [chaveRepresentada(nome), nome]));

  const removidas = Array.from(atuaisPorChave.entries())
    .filter(([chave]) => !desejadasPorChave.has(chave))
    .map(([, nome]) => nome);

  const adicionadas = Array.from(desejadasPorChave.entries())
    .filter(([chave]) => !atuaisPorChave.has(chave))
    .map(([, nome]) => nome);

  if (removidas.length > 0) {
    const { error: deleteError } = await supabase
      .from("perfil_representadas")
      .delete()
      .eq("user_id", user.id)
      .in("nome", removidas);

    if (deleteError) {
      throw new Error(`Falha ao remover representada: ${deleteError.message}`);
    }
  }

  if (adicionadas.length > 0) {
    const { error: insertError } = await supabase.from("perfil_representadas").insert(
      adicionadas.map((nome) => ({ user_id: user.id, nome })),
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
