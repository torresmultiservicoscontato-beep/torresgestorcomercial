import { carregarAcessoAtual, pode } from "./acesso";
import { limparRepresentanteAdministrado, obterRepresentanteAdministrado } from "./adminContext";
import { limparPrepostoAdministrado, obterPrepostoAdministrado } from "./prepostoContext";
import { supabase } from "./supabase";
import type { RepresentadaOperacional } from "./data";

export type ItemVendaInput = {
  produtoId?: string;
  produto: string;
  codigo?: string;
  quantidade?: string;
  unidade?: string;
  valorUnitario?: string;
  valorTotal?: string;
  representadaId?: string;
};

export type ItemVenda = {
  id: string;
  produtoId: string | null;
  produto: string;
  codigo: string;
  quantidade: number | null;
  unidade: string;
  valorUnitario: number | null;
  valorTotal: number | null;
  origem: string;
  confirmado: boolean;
  representadaId: string | null;
};

export type AnexoVenda = {
  id: string;
  nomeArquivo: string;
  caminhoStorage: string;
  tipoMime: string;
  tamanhoBytes: number | null;
  statusExtracao: string;
};

export type Venda = {
  id: string;
  titularUserId: string;
  responsavelUserId: string;
  responsavelNome: string;
  visitaId: string;
  clienteId: string;
  clienteNome: string;
  data: string;
  valor: number;
  formasPagamento: string[];
  condicoesPrazo: string[];
  situacao: string;
  representadas: RepresentadaOperacional[];
  itens: ItemVenda[];
  anexos: AnexoVenda[];
};

function exigirSupabase() {
  if (!supabase) throw new Error("Banco de dados não configurado.");
  return supabase;
}

async function resolverContexto(acao: "visualizar" | "cadastrar" | "editar") {
  const cliente = exigirSupabase();
  const {
    data: { user },
    error,
  } = await cliente.auth.getUser();

  if (error || !user) throw new Error("Sua sessão expirou. Entre novamente no sistema.");

  const acesso = await carregarAcessoAtual();
  if (!acesso) throw new Error("Não foi possível identificar seu acesso.");
  if (!pode(acesso, "vendas", acao)) throw new Error("Você não possui permissão para esta ação em Vendas.");

  let titularUserId = acesso.titularUserId;
  const representanteAdministrado = obterRepresentanteAdministrado();

  if (acesso.papel === "admin" && representanteAdministrado && representanteAdministrado.userId !== user.id) {
    titularUserId = representanteAdministrado.userId;
  } else if (acesso.papel !== "admin" && representanteAdministrado) {
    limparRepresentanteAdministrado();
  }

  let prepostoAdministrado = acesso.papel === "preposto" ? null : obterPrepostoAdministrado();
  if (acesso.papel === "preposto") {
    limparPrepostoAdministrado();
  } else if (prepostoAdministrado && prepostoAdministrado.titularUserId !== titularUserId) {
    limparPrepostoAdministrado();
    prepostoAdministrado = null;
  }

  const responsavelUserId = acesso.papel === "preposto"
    ? user.id
    : prepostoAdministrado?.userId ?? null;

  return { cliente, acesso, titularUserId, responsavelUserId };
}

function numero(valor: unknown) {
  if (valor === null || valor === undefined || valor === "") return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

async function nomesResponsaveis(ids: string[]) {
  const cliente = exigirSupabase();
  const mapa = new Map<string, string>();
  const unicos = Array.from(new Set(ids.filter(Boolean)));
  if (unicos.length === 0) return mapa;

  const [{ data: perfis }, { data: prepostos }] = await Promise.all([
    cliente.from("perfis").select("user_id,nome").in("user_id", unicos),
    cliente.from("preposto_perfis").select("user_id,nome").in("user_id", unicos),
  ]);

  for (const item of perfis ?? []) mapa.set(item.user_id, item.nome);
  for (const item of prepostos ?? []) mapa.set(item.user_id, item.nome);
  return mapa;
}


export type ClienteBuscaVenda = {
  id: string;
  nome: string;
  cidade: string;
  bairro: string;
};

export async function buscarClientesVenda(termo: string): Promise<ClienteBuscaVenda[]> {
  const texto = termo.trim();
  if (texto.length < 2) return [];

  const { cliente, titularUserId, responsavelUserId } = await resolverContexto("visualizar");
  let consulta = cliente
    .from("clientes")
    .select("id,nome,cidade,bairro")
    .eq("user_id", titularUserId)
    .ilike("nome", `%${texto.replace(/[%_]/g, "")}%`)
    .order("nome")
    .limit(10);

  if (responsavelUserId) consulta = consulta.eq("responsavel_user_id", responsavelUserId);

  const { data, error } = await consulta;
  if (error) throw new Error(`Falha ao buscar clientes: ${error.message}`);

  return (data ?? []).map((item) => ({
    id: item.id,
    nome: item.nome,
    cidade: item.cidade ?? "",
    bairro: item.bairro ?? "",
  }));
}

export async function carregarRepresentadasFiltroVendas(): Promise<RepresentadaOperacional[]> {
  const { cliente, titularUserId, responsavelUserId } = await resolverContexto("visualizar");
  const responsavel = responsavelUserId ?? titularUserId;

  const { data, error } = await cliente.rpc("listar_representadas_operacionais", {
    p_titular_user_id: titularUserId,
    p_responsavel_user_id: responsavel,
  });

  if (error) throw new Error(`Falha ao carregar representadas para o filtro: ${error.message}`);
  return (data ?? []).map((item: { representada_id: string; nome: string }) => ({
    id: item.representada_id,
    nome: item.nome,
  }));
}

export async function carregarVendas(): Promise<Venda[]> {
  const { cliente, titularUserId, responsavelUserId } = await resolverContexto("visualizar");

  let consulta = cliente
    .from("vendas")
    .select("id,titular_user_id,responsavel_user_id,visita_id,cliente_id,cliente_nome,data,valor,formas_pagamento,condicoes_prazo,situacao")
    .eq("titular_user_id", titularUserId)
    .eq("ativa", true);

  if (responsavelUserId) consulta = consulta.eq("responsavel_user_id", responsavelUserId);

  const { data, error } = await consulta
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Falha ao carregar vendas: ${error.message}`);

  const rows = data ?? [];
  const vendaIds = rows.map((row) => row.id);
  if (vendaIds.length === 0) return [];

  const [{ data: relRep, error: repError }, { data: itens, error: itensError }, { data: anexos, error: anexosError }] = await Promise.all([
    cliente.from("venda_representadas").select("venda_id,representada_id").in("venda_id", vendaIds),
    cliente.from("venda_itens").select("id,venda_id,representada_id,produto_id,produto,codigo,quantidade,unidade,valor_unitario,valor_total,origem,confirmado").in("venda_id", vendaIds).order("created_at"),
    cliente.from("venda_anexos").select("id,venda_id,nome_arquivo,caminho_storage,tipo_mime,tamanho_bytes,status_extracao").in("venda_id", vendaIds).order("created_at"),
  ]);

  if (repError) throw new Error(`Falha ao carregar representadas das vendas: ${repError.message}`);
  if (itensError) throw new Error(`Falha ao carregar itens das vendas: ${itensError.message}`);
  if (anexosError) throw new Error(`Falha ao carregar anexos das vendas: ${anexosError.message}`);

  const representadaIds = Array.from(new Set((relRep ?? []).map((item) => item.representada_id)));
  const catalogo = new Map<string, RepresentadaOperacional>();
  if (representadaIds.length > 0) {
    const { data: reps, error: repsError } = await cliente
      .from("representadas_catalogo")
      .select("id,nome")
      .in("id", representadaIds);
    if (repsError) throw new Error(`Falha ao carregar representadas: ${repsError.message}`);
    for (const item of reps ?? []) catalogo.set(item.id, { id: item.id, nome: item.nome });
  }

  const repsPorVenda = new Map<string, RepresentadaOperacional[]>();
  for (const item of relRep ?? []) {
    const rep = catalogo.get(item.representada_id);
    if (!rep) continue;
    const lista = repsPorVenda.get(item.venda_id) ?? [];
    lista.push(rep);
    repsPorVenda.set(item.venda_id, lista);
  }

  const itensPorVenda = new Map<string, ItemVenda[]>();
  for (const item of itens ?? []) {
    const lista = itensPorVenda.get(item.venda_id) ?? [];
    lista.push({
      id: item.id,
      produtoId: item.produto_id ?? null,
      produto: item.produto,
      codigo: item.codigo ?? "",
      quantidade: numero(item.quantidade),
      unidade: item.unidade ?? "",
      valorUnitario: numero(item.valor_unitario),
      valorTotal: numero(item.valor_total),
      origem: item.origem ?? "manual",
      confirmado: Boolean(item.confirmado),
      representadaId: item.representada_id ?? null,
    });
    itensPorVenda.set(item.venda_id, lista);
  }

  const anexosPorVenda = new Map<string, AnexoVenda[]>();
  for (const item of anexos ?? []) {
    const lista = anexosPorVenda.get(item.venda_id) ?? [];
    lista.push({
      id: item.id,
      nomeArquivo: item.nome_arquivo,
      caminhoStorage: item.caminho_storage,
      tipoMime: item.tipo_mime ?? "",
      tamanhoBytes: item.tamanho_bytes === null ? null : Number(item.tamanho_bytes),
      statusExtracao: item.status_extracao ?? "pendente",
    });
    anexosPorVenda.set(item.venda_id, lista);
  }

  const nomes = await nomesResponsaveis(rows.map((row) => row.responsavel_user_id));

  return rows.map((row) => ({
    id: row.id,
    titularUserId: row.titular_user_id,
    responsavelUserId: row.responsavel_user_id,
    responsavelNome: nomes.get(row.responsavel_user_id) ?? "Responsável",
    visitaId: row.visita_id,
    clienteId: row.cliente_id,
    clienteNome: row.cliente_nome,
    data: row.data,
    valor: Number(row.valor ?? 0),
    formasPagamento: row.formas_pagamento ?? [],
    condicoesPrazo: row.condicoes_prazo ?? [],
    situacao: row.situacao ?? "Pedido lançado",
    representadas: (repsPorVenda.get(row.id) ?? []).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    itens: itensPorVenda.get(row.id) ?? [],
    anexos: anexosPorVenda.get(row.id) ?? [],
  }));
}

export async function sincronizarDetalhesVendaVisita(input: {
  visitaId: string;
  formasPagamento: string[];
  condicoesPrazo: string[];
  situacao: string;
  itens: ItemVendaInput[];
}) {
  const cliente = exigirSupabase();
  const { data: sessao, error: sessaoError } = await cliente.auth.getUser();
  if (sessaoError || !sessao.user) throw new Error("Sua sessão expirou. Entre novamente no sistema.");
  const { data, error } = await cliente.rpc("salvar_detalhes_venda_visita", {
    p_visita_id: input.visitaId,
    p_formas_pagamento: input.formasPagamento,
    p_condicoes_prazo: input.condicoesPrazo,
    p_situacao: input.situacao,
    p_itens: input.itens,
  });

  if (error) throw new Error(`Falha ao sincronizar a venda da visita: ${error.message}`);
  return data as string | null;
}

export async function salvarComplementoVenda(venda: Venda, input: {
  formasPagamento: string[];
  condicoesPrazo: string[];
  situacao: string;
  itens: ItemVendaInput[];
}) {
  const { cliente } = await resolverContexto("editar");

  const { error } = await cliente
    .from("vendas")
    .update({
      formas_pagamento: input.formasPagamento,
      condicoes_prazo: input.condicoesPrazo,
      situacao: input.situacao,
      updated_at: new Date().toISOString(),
    })
    .eq("id", venda.id);

  if (error) throw new Error(`Falha ao atualizar venda: ${error.message}`);

  const { error: deleteError } = await cliente
    .from("venda_itens")
    .delete()
    .eq("venda_id", venda.id);

  if (deleteError) throw new Error(`Falha ao atualizar itens: ${deleteError.message}`);

  const linhas = input.itens
    .filter((item) => item.produto.trim())
    .map((item) => ({
      venda_id: venda.id,
      representada_id: item.representadaId || null,
      produto_id: item.produtoId || null,
      produto: item.produto.trim(),
      codigo: item.codigo?.trim() ?? "",
      quantidade: item.quantidade ? Number(item.quantidade.replace(",", ".")) : null,
      unidade: item.unidade?.trim() ?? "",
      valor_unitario: item.valorUnitario ? Number(item.valorUnitario.replace(",", ".")) : null,
      valor_total: item.valorTotal ? Number(item.valorTotal.replace(",", ".")) : null,
      origem: "manual",
      confirmado: true,
    }));

  if (linhas.length > 0) {
    const { error: insertError } = await cliente.from("venda_itens").insert(linhas);
    if (insertError) throw new Error(`Falha ao salvar itens da venda: ${insertError.message}`);
  }
}

function nomeSeguro(nome: string) {
  return nome.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-120);
}

export async function anexarDocumentoVendaPorVisita(visitaId: string, arquivo: File) {
  const cliente = exigirSupabase();
  const {
    data: { user },
    error: authError,
  } = await cliente.auth.getUser();

  if (authError || !user) throw new Error("Sua sessão expirou. Entre novamente no sistema.");

  const { data: venda, error: vendaError } = await cliente
    .from("vendas")
    .select("id,titular_user_id")
    .eq("visita_id", visitaId)
    .eq("ativa", true)
    .maybeSingle();

  if (vendaError) throw new Error(`Falha ao localizar a venda da visita: ${vendaError.message}`);
  if (!venda) throw new Error("A venda vinculada à visita ainda não foi criada.");

  if (arquivo.size > 15 * 1024 * 1024) throw new Error("O arquivo deve ter no máximo 15 MB.");

  const caminho = `${venda.titular_user_id}/${venda.id}/${crypto.randomUUID()}-${nomeSeguro(arquivo.name)}`;
  const { error: uploadError } = await cliente.storage
    .from("vendas-documentos")
    .upload(caminho, arquivo, { contentType: arquivo.type || undefined, upsert: false });

  if (uploadError) throw new Error(`Falha ao enviar documento: ${uploadError.message}`);

  const { data: registro, error: registroError } = await cliente
    .from("venda_anexos")
    .insert({
      venda_id: venda.id,
      nome_arquivo: arquivo.name,
      caminho_storage: caminho,
      tipo_mime: arquivo.type || "",
      tamanho_bytes: arquivo.size,
      status_extracao: "pendente",
    })
    .select("id")
    .single();

  if (registroError || !registro) {
    await cliente.storage.from("vendas-documentos").remove([caminho]);
    throw new Error(`Falha ao registrar documento: ${registroError?.message ?? "registro não criado"}`);
  }

  return registro.id as string;
}

export async function anexarDocumentoVenda(venda: Venda, arquivo: File) {
  const { cliente } = await resolverContexto("editar");
  if (arquivo.size > 15 * 1024 * 1024) throw new Error("O arquivo deve ter no máximo 15 MB.");

  const caminho = `${venda.titularUserId}/${venda.id}/${crypto.randomUUID()}-${nomeSeguro(arquivo.name)}`;
  const { error: uploadError } = await cliente.storage
    .from("vendas-documentos")
    .upload(caminho, arquivo, { contentType: arquivo.type || undefined, upsert: false });

  if (uploadError) throw new Error(`Falha ao enviar documento: ${uploadError.message}`);

  const { error: registroError } = await cliente.from("venda_anexos").insert({
    venda_id: venda.id,
    nome_arquivo: arquivo.name,
    caminho_storage: caminho,
    tipo_mime: arquivo.type || "",
    tamanho_bytes: arquivo.size,
    status_extracao: "pendente",
  });

  if (registroError) {
    await cliente.storage.from("vendas-documentos").remove([caminho]);
    throw new Error(`Falha ao registrar documento: ${registroError.message}`);
  }
}

export async function abrirDocumentoVenda(caminho: string) {
  const { cliente } = await resolverContexto("visualizar");
  const { data, error } = await cliente.storage
    .from("vendas-documentos")
    .createSignedUrl(caminho, 120);

  if (error || !data?.signedUrl) throw new Error(`Falha ao abrir documento: ${error?.message ?? "link indisponível"}`);
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}
