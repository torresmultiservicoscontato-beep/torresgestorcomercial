import { carregarAcessoAtual, pode, type AcessoSistema } from "./acesso";
import { limparRepresentanteAdministrado, obterRepresentanteAdministrado } from "./adminContext";
import { limparPrepostoAdministrado, obterPrepostoAdministrado } from "./prepostoContext";
import { supabase, supabaseConfigured } from "./supabase";

export type Cliente = {
  id: string;
  nome: string;
  cidade: string;
  bairro: string;
  representada: string;
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
};

type ClienteRow = {
  id: string;
  nome: string;
  cidade: string;
  bairro: string;
  representada: string;
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

  return rows.map((row) => {
    const responsavelUserId = row.responsavel_user_id ?? userIdAlvo;
    const titular = responsavelUserId === userIdAlvo;

    return {
      id: row.id,
      nome: row.nome,
      cidade: row.cidade,
      bairro: row.bairro,
      representada: row.representada,
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

export async function carregarClientes(): Promise<Cliente[]> {
  const { cliente, acesso, userIdAlvo, filtroResponsavelUserId } = await exigirUsuario("clientes", "visualizar");

  let consulta = cliente
    .from("clientes")
    .select("id,nome,cidade,bairro,representada,telefone,status,responsavel_user_id")
    .eq("user_id", userIdAlvo);

  if (filtroResponsavelUserId) {
    consulta = consulta.eq("responsavel_user_id", filtroResponsavelUserId);
  }

  const { data, error } = await consulta.order("created_at", { ascending: false });

  if (error) throw new Error(`Falha ao carregar clientes: ${error.message}`);
  return mapearClientes((data ?? []) as ClienteRow[], userIdAlvo, acesso);
}

export async function criarCliente(novoCliente: Cliente): Promise<Cliente> {
  const { cliente, user, acesso, userIdAlvo, responsavelUserId } = await exigirUsuario("clientes", "cadastrar");
  const { data, error } = await cliente
    .from("clientes")
    .insert({
      id: novoCliente.id,
      user_id: userIdAlvo,
      criado_por_user_id: user.id,
      responsavel_user_id: responsavelUserId,
      nome: novoCliente.nome,
      cidade: novoCliente.cidade,
      bairro: novoCliente.bairro,
      representada: novoCliente.representada,
      telefone: novoCliente.telefone,
      status: novoCliente.status,
    })
    .select("id,nome,cidade,bairro,representada,telefone,status,responsavel_user_id")
    .single();

  if (error) throw new Error(`Falha ao salvar cliente: ${error.message}`);
  const [salvo] = await mapearClientes([data as ClienteRow], userIdAlvo, acesso);
  return salvo;
}

export async function atualizarCliente(clienteAtualizado: Cliente): Promise<Cliente> {
  const { cliente, acesso, userIdAlvo, filtroResponsavelUserId } = await exigirUsuario("clientes", "editar");

  let consulta = cliente
    .from("clientes")
    .update({
      nome: clienteAtualizado.nome,
      cidade: clienteAtualizado.cidade,
      bairro: clienteAtualizado.bairro,
      representada: clienteAtualizado.representada,
      telefone: clienteAtualizado.telefone,
      status: clienteAtualizado.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clienteAtualizado.id)
    .eq("user_id", userIdAlvo);

  if (filtroResponsavelUserId) {
    consulta = consulta.eq("responsavel_user_id", filtroResponsavelUserId);
  }

  const { data, error } = await consulta
    .select("id,nome,cidade,bairro,representada,telefone,status,responsavel_user_id")
    .single();

  if (error) throw new Error(`Falha ao atualizar cliente: ${error.message}`);
  const [salvo] = await mapearClientes([data as ClienteRow], userIdAlvo, acesso);
  return salvo;
}

export async function carregarVisitas(): Promise<Visita[]> {
  const { cliente, userIdAlvo, filtroResponsavelUserId } = await exigirUsuario("visitas", "visualizar");

  let consulta = cliente
    .from("visitas")
    .select("id,cliente_id,cliente_nome,data,resultado,odometro,observacao")
    .eq("user_id", userIdAlvo);

  if (filtroResponsavelUserId) {
    consulta = consulta.eq("responsavel_user_id", filtroResponsavelUserId);
  }

  const { data, error } = await consulta
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Falha ao carregar visitas: ${error.message}`);

  return ((data ?? []) as VisitaRow[]).map((visita) => ({
    id: visita.id,
    clienteId: visita.cliente_id,
    clienteNome: visita.cliente_nome,
    data: visita.data,
    resultado: visita.resultado,
    odometro: visita.odometro,
    observacao: visita.observacao,
  }));
}

export async function criarVisita(novaVisita: Visita): Promise<Visita> {
  const { cliente, user, userIdAlvo, responsavelUserId } = await exigirUsuario("visitas", "cadastrar");
  const { data, error } = await cliente
    .from("visitas")
    .insert({
      id: novaVisita.id,
      user_id: userIdAlvo,
      criado_por_user_id: user.id,
      responsavel_user_id: responsavelUserId,
      cliente_id: novaVisita.clienteId,
      cliente_nome: novaVisita.clienteNome,
      data: novaVisita.data,
      resultado: novaVisita.resultado,
      odometro: novaVisita.odometro,
      observacao: novaVisita.observacao,
    })
    .select("id,cliente_id,cliente_nome,data,resultado,odometro,observacao")
    .single();

  if (error) throw new Error(`Falha ao salvar visita: ${error.message}`);

  const salva = data as VisitaRow;
  return {
    id: salva.id,
    clienteId: salva.cliente_id,
    clienteNome: salva.cliente_nome,
    data: salva.data,
    resultado: salva.resultado,
    odometro: salva.odometro,
    observacao: salva.observacao,
  };
}

export async function atualizarVisita(visitaAtualizada: Visita): Promise<Visita> {
  const { cliente, userIdAlvo, filtroResponsavelUserId } = await exigirUsuario("visitas", "editar");

  let consulta = cliente
    .from("visitas")
    .update({
      cliente_id: visitaAtualizada.clienteId,
      cliente_nome: visitaAtualizada.clienteNome,
      data: visitaAtualizada.data,
      resultado: visitaAtualizada.resultado,
      odometro: visitaAtualizada.odometro,
      observacao: visitaAtualizada.observacao,
      updated_at: new Date().toISOString(),
    })
    .eq("id", visitaAtualizada.id)
    .eq("user_id", userIdAlvo);

  if (filtroResponsavelUserId) {
    consulta = consulta.eq("responsavel_user_id", filtroResponsavelUserId);
  }

  const { data, error } = await consulta
    .select("id,cliente_id,cliente_nome,data,resultado,odometro,observacao")
    .single();

  if (error) throw new Error(`Falha ao atualizar visita: ${error.message}`);

  const salva = data as VisitaRow;
  return {
    id: salva.id,
    clienteId: salva.cliente_id,
    clienteNome: salva.cliente_nome,
    data: salva.data,
    resultado: salva.resultado,
    odometro: salva.odometro,
    observacao: salva.observacao,
  };
}
