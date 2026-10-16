import { carregarAcessoAtual, pode, type AcessoSistema } from "./acesso";
import { limparRepresentanteAdministrado, obterRepresentanteAdministrado } from "./adminContext";
import { limparPrepostoAdministrado, obterPrepostoAdministrado } from "./prepostoContext";
import { supabase, supabaseConfigured } from "./supabase";

export type RepresentadaOperacional = {
  id: string;
  nome: string;
};

export type Cliente = {
  id: string;
  nome: string;
  cidade: string;
  bairro: string;
  representada: string;
  representadas: RepresentadaOperacional[];
  telefone: string;
  status: string;
  responsavelUserId?: string;
  responsavelNome?: string;
  responsavelTipo?: "titular" | "preposto";
};

export type Visita = {
  id: string;
  clienteId: string;
  clienteNome: string;
  data: string;
  resultado: string;
  odometro: string;
  observacao: string;
  representadas: RepresentadaOperacional[];
};

type ClienteRow = {
  id: string;
  nome: string;
  cidade: string;
  bairro: string;
  representada: string;
  representada_id: string | null;
  telefone: string;
  status: string;
  responsavel_user_id: string | null;
};

type VisitaRow = {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  data: string;
  resultado: string;
  odometro: string;
  observacao: string;
  representada_id: string | null;
};

export const bancoRemotoAtivo = supabaseConfigured;

function exigirSupabase() {
  if (!supabase) throw new Error("Banco de dados não configurado.");
  return supabase;
}

async function exigirUsuario(modulo: "clientes" | "visitas", acao: "visualizar" | "cadastrar" | "editar") {
  const cliente = exigirSupabase();
  const {
    data: { user },
    error,
  } = await cliente.auth.getUser();

  if (error || !user) throw new Error("Sua sessão expirou. Entre novamente no sistema.");

  const acesso = await carregarAcessoAtual();
  if (!acesso) throw new Error("Não foi possível identificar seu acesso.");
  if (!pode(acesso, modulo, acao)) throw new Error("Você não possui permissão para esta ação.");

  let userIdAlvo = acesso.titularUserId;
  const representanteAdministrado = obterRepresentanteAdministrado();

  if (acesso.papel === "admin" && representanteAdministrado && representanteAdministrado.userId !== user.id) {
    userIdAlvo = representanteAdministrado.userId;
  } else if (acesso.papel !== "admin" && representanteAdministrado) {
    limparRepresentanteAdministrado();
  }

  let prepostoAdministrado = acesso.papel === "preposto" ? null : obterPrepostoAdministrado();

  if (acesso.papel === "preposto") {
    limparPrepostoAdministrado();
  } else if (prepostoAdministrado && prepostoAdministrado.titularUserId !== userIdAlvo) {
    limparPrepostoAdministrado();
    prepostoAdministrado = null;
  }

  const responsavelUserId = acesso.papel === "preposto"
    ? user.id
    : prepostoAdministrado?.userId ?? userIdAlvo;

  const filtroResponsavelUserId = acesso.papel === "preposto"
    ? user.id
    : prepostoAdministrado?.userId ?? null;

  return {
    cliente,
    user,
    acesso,
    userIdAlvo,
    responsavelUserId,
    filtroResponsavelUserId,
  };
}

async function carregarCatalogo(ids: string[]) {
  const cliente = exigirSupabase();
  const unicos = Array.from(new Set(ids.filter(Boolean)));
  const resultado = new Map<string, RepresentadaOperacional>();
  if (unicos.length === 0) return resultado;

  const { data, error } = await cliente
    .from("representadas_catalogo")
    .select("id,nome")
    .in("id", unicos);

  if (error) throw new Error(`Falha ao carregar representadas: ${error.message}`);
  for (const item of data ?? []) resultado.set(item.id, { id: item.id, nome: item.nome });
  return resultado;
}

async function carregarRepresentadasClientes(clienteIds: string[]) {
  const cliente = exigirSupabase();
  const resultado = new Map<string, RepresentadaOperacional[]>();
  if (clienteIds.length === 0) return resultado;

  const { data, error } = await cliente
    .from("cliente_representadas")
    .select("cliente_id,representada_id")
    .in("cliente_id", clienteIds);

  if (error) throw new Error(`Falha ao carregar representadas dos clientes: ${error.message}`);
  const relacoes = data ?? [];
  const catalogo = await carregarCatalogo(relacoes.map((item) => item.representada_id));

  for (const relacao of relacoes) {
    const representada = catalogo.get(relacao.representada_id);
    if (!representada) continue;
    const lista = resultado.get(relacao.cliente_id) ?? [];
    lista.push(representada);
    resultado.set(relacao.cliente_id, lista);
  }

  for (const lista of resultado.values()) lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return resultado;
}

async function carregarRepresentadasVisitas(visitaIds: string[]) {
  const cliente = exigirSupabase();
  const resultado = new Map<string, RepresentadaOperacional[]>();
  if (visitaIds.length === 0) return resultado;

  const { data, error } = await cliente
    .from("visita_representadas")
    .select("visita_id,representada_id")
    .in("visita_id", visitaIds);

  if (error) throw new Error(`Falha ao carregar representadas das visitas: ${error.message}`);
  const relacoes = data ?? [];
  const catalogo = await carregarCatalogo(relacoes.map((item) => item.representada_id));

  for (const relacao of relacoes) {
    const representada = catalogo.get(relacao.representada_id);
    if (!representada) continue;
    const lista = resultado.get(relacao.visita_id) ?? [];
    lista.push(representada);
    resultado.set(relacao.visita_id, lista);
  }

  for (const lista of resultado.values()) lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return resultado;
}

async function mapearClientes(
  rows: ClienteRow[],
  userIdAlvo: string,
  acesso: AcessoSistema,
): Promise<Cliente[]> {
  const cliente = exigirSupabase();
  const idsPrepostos = Array.from(
    new Set(
      rows
        .map((row) => row.responsavel_user_id)
        .filter((id): id is string => Boolean(id && id !== userIdAlvo)),
    ),
  );

  const nomes = new Map<string, string>();
  if (idsPrepostos.length > 0) {
    const { data } = await cliente
      .from("prepostos")
      .select("user_id,nome")
      .eq("titular_user_id", userIdAlvo)
      .in("user_id", idsPrepostos);

    for (const item of data ?? []) {
      if (item.user_id) nomes.set(item.user_id, item.nome);
    }
  }

  const representadasPorCliente = await carregarRepresentadasClientes(rows.map((row) => row.id));
  const idsFallback = rows
    .filter((row) => !(representadasPorCliente.get(row.id)?.length) && row.representada_id)
    .map((row) => row.representada_id as string);
  const catalogoFallback = await carregarCatalogo(idsFallback);

  return rows.map((row) => {
    const responsavelUserId = row.responsavel_user_id ?? userIdAlvo;
    const titular = responsavelUserId === userIdAlvo;
    const relacionadas = representadasPorCliente.get(row.id) ?? [];
    const fallback = row.representada_id ? catalogoFallback.get(row.representada_id) : null;
    const representadas = relacionadas.length > 0
      ? relacionadas
      : fallback
        ? [fallback]
        : row.representada
          ? [{ id: row.representada_id ?? row.representada, nome: row.representada }]
          : [];

    return {
      id: row.id,
      nome: row.nome,
      cidade: row.cidade,
      bairro: row.bairro,
      representada: representadas.map((item) => item.nome).join(" • ") || row.representada,
      representadas,
      telefone: row.telefone,
      status: row.status,
      responsavelUserId,
      responsavelTipo: titular ? "titular" : "preposto",
      responsavelNome: titular
        ? "Titular"
        : nomes.get(responsavelUserId) ?? (acesso.papel === "preposto" ? acesso.nome : "Preposto"),
    };
  });
}

export async function carregarRepresentadasOperacionais(): Promise<RepresentadaOperacional[]> {
  const { cliente, userIdAlvo, responsavelUserId } = await exigirUsuario("clientes", "visualizar");

  const { data, error } = await cliente.rpc("listar_representadas_operacionais", {
    p_titular_user_id: userIdAlvo,
    p_responsavel_user_id: responsavelUserId,
  });

  if (error) throw new Error(`Falha ao carregar representadas disponíveis: ${error.message}`);
  return (data ?? []).map((item: { representada_id: string; nome: string }) => ({
    id: item.representada_id,
    nome: item.nome,
  }));
}

export async function carregarClientes(): Promise<Cliente[]> {
  const { cliente, acesso, userIdAlvo, filtroResponsavelUserId } = await exigirUsuario("clientes", "visualizar");

  let consulta = cliente
    .from("clientes")
    .select("id,nome,cidade,bairro,representada,representada_id,telefone,status,responsavel_user_id")
    .eq("user_id", userIdAlvo);

  if (filtroResponsavelUserId) consulta = consulta.eq("responsavel_user_id", filtroResponsavelUserId);

  const { data, error } = await consulta.order("created_at", { ascending: false });
  if (error) throw new Error(`Falha ao carregar clientes: ${error.message}`);
  return mapearClientes((data ?? []) as ClienteRow[], userIdAlvo, acesso);
}

export async function criarCliente(novoCliente: Cliente): Promise<Cliente> {
  const { cliente, acesso, userIdAlvo, responsavelUserId } = await exigirUsuario("clientes", "cadastrar");
  const representadaIds = novoCliente.representadas.map((item) => item.id);

  const { data, error } = await cliente.rpc("salvar_cliente_multirepresentada", {
    p_id: novoCliente.id,
    p_titular_user_id: userIdAlvo,
    p_responsavel_user_id: responsavelUserId,
    p_nome: novoCliente.nome,
    p_cidade: novoCliente.cidade,
    p_bairro: novoCliente.bairro,
    p_telefone: novoCliente.telefone,
    p_status: novoCliente.status,
    p_representadas: representadaIds,
  });

  if (error) throw new Error(`Falha ao salvar cliente: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Cliente não encontrado após o cadastro.");
  const [salvo] = await mapearClientes([row as ClienteRow], userIdAlvo, acesso);
  return salvo;
}

export async function atualizarCliente(clienteAtualizado: Cliente): Promise<Cliente> {
  const { cliente, acesso, userIdAlvo, responsavelUserId } = await exigirUsuario("clientes", "editar");
  const representadaIds = clienteAtualizado.representadas.map((item) => item.id);

  const { data, error } = await cliente.rpc("salvar_cliente_multirepresentada", {
    p_id: clienteAtualizado.id,
    p_titular_user_id: userIdAlvo,
    p_responsavel_user_id: responsavelUserId,
    p_nome: clienteAtualizado.nome,
    p_cidade: clienteAtualizado.cidade,
    p_bairro: clienteAtualizado.bairro,
    p_telefone: clienteAtualizado.telefone,
    p_status: clienteAtualizado.status,
    p_representadas: representadaIds,
  });

  if (error) throw new Error(`Falha ao atualizar cliente: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Cliente não encontrado após a atualização.");
  const [salvo] = await mapearClientes([row as ClienteRow], userIdAlvo, acesso);
  return salvo;
}

export async function carregarVisitas(): Promise<Visita[]> {
  const { cliente, userIdAlvo, filtroResponsavelUserId } = await exigirUsuario("visitas", "visualizar");

  let consulta = cliente
    .from("visitas")
    .select("id,cliente_id,cliente_nome,data,resultado,odometro,observacao,representada_id")
    .eq("user_id", userIdAlvo);

  if (filtroResponsavelUserId) consulta = consulta.eq("responsavel_user_id", filtroResponsavelUserId);

  const { data, error } = await consulta
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Falha ao carregar visitas: ${error.message}`);

  const rows = (data ?? []) as VisitaRow[];
  const representadasPorVisita = await carregarRepresentadasVisitas(rows.map((row) => row.id));
  const idsFallback = rows
    .filter((row) => !(representadasPorVisita.get(row.id)?.length) && row.representada_id)
    .map((row) => row.representada_id as string);
  const catalogoFallback = await carregarCatalogo(idsFallback);

  return rows.map((visita) => {
    const relacionadas = representadasPorVisita.get(visita.id) ?? [];
    const fallback = visita.representada_id ? catalogoFallback.get(visita.representada_id) : null;
    return {
      id: visita.id,
      clienteId: visita.cliente_id,
      clienteNome: visita.cliente_nome,
      data: visita.data,
      resultado: visita.resultado,
      odometro: visita.odometro,
      observacao: visita.observacao,
      representadas: relacionadas.length > 0 ? relacionadas : fallback ? [fallback] : [],
    };
  });
}

export async function criarVisita(novaVisita: Visita): Promise<Visita> {
  const { cliente, userIdAlvo, responsavelUserId } = await exigirUsuario("visitas", "cadastrar");

  const { data, error } = await cliente.rpc("salvar_visita_multirepresentada", {
    p_id: novaVisita.id,
    p_titular_user_id: userIdAlvo,
    p_responsavel_user_id: responsavelUserId,
    p_cliente_id: novaVisita.clienteId,
    p_data: novaVisita.data,
    p_resultado: novaVisita.resultado,
    p_odometro: novaVisita.odometro,
    p_observacao: novaVisita.observacao,
    p_representadas: novaVisita.representadas.map((item) => item.id),
  });

  if (error) throw new Error(`Falha ao salvar visita: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as VisitaRow | null;
  if (!row) throw new Error("Visita não encontrada após o cadastro.");
  const representadas = await carregarRepresentadasVisitas([row.id]);

  return {
    id: row.id,
    clienteId: row.cliente_id,
    clienteNome: row.cliente_nome,
    data: row.data,
    resultado: row.resultado,
    odometro: row.odometro,
    observacao: row.observacao,
    representadas: representadas.get(row.id) ?? novaVisita.representadas,
  };
}

export async function atualizarVisita(visitaAtualizada: Visita): Promise<Visita> {
  const { cliente, userIdAlvo, responsavelUserId } = await exigirUsuario("visitas", "editar");

  const { data, error } = await cliente.rpc("salvar_visita_multirepresentada", {
    p_id: visitaAtualizada.id,
    p_titular_user_id: userIdAlvo,
    p_responsavel_user_id: responsavelUserId,
    p_cliente_id: visitaAtualizada.clienteId,
    p_data: visitaAtualizada.data,
    p_resultado: visitaAtualizada.resultado,
    p_odometro: visitaAtualizada.odometro,
    p_observacao: visitaAtualizada.observacao,
    p_representadas: visitaAtualizada.representadas.map((item) => item.id),
  });

  if (error) throw new Error(`Falha ao atualizar visita: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as VisitaRow | null;
  if (!row) throw new Error("Visita não encontrada após a atualização.");
  const representadas = await carregarRepresentadasVisitas([row.id]);

  return {
    id: row.id,
    clienteId: row.cliente_id,
    clienteNome: row.cliente_nome,
    data: row.data,
    resultado: row.resultado,
    odometro: row.odometro,
    observacao: row.observacao,
    representadas: representadas.get(row.id) ?? visitaAtualizada.representadas,
  };
}
