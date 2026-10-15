import { supabase, supabaseConfigured } from "./supabase";

export type Cliente = {
  id: string;
  nome: string;
  cidade: string;
  bairro: string;
  representada: string;
  telefone: string;
  status: string;
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
  if (!supabase) {
    throw new Error("Banco de dados não configurado.");
  }

  return supabase;
}

async function exigirUsuario() {
  const cliente = exigirSupabase();
  const {
    data: { user },
    error,
  } = await cliente.auth.getUser();

  if (error || !user) {
    throw new Error("Sua sessão expirou. Entre novamente no sistema.");
  }

  return { cliente, user };
}

export async function carregarClientes(): Promise<Cliente[]> {
  const { cliente } = await exigirUsuario();

  const { data, error } = await cliente
    .from("clientes")
    .select("id,nome,cidade,bairro,representada,telefone,status")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Falha ao carregar clientes: ${error.message}`);
  return (data ?? []) as Cliente[];
}

export async function criarCliente(novoCliente: Cliente): Promise<Cliente> {
  const { cliente, user } = await exigirUsuario();

  const { data, error } = await cliente
    .from("clientes")
    .insert({
      id: novoCliente.id,
      user_id: user.id,
      nome: novoCliente.nome,
      cidade: novoCliente.cidade,
      bairro: novoCliente.bairro,
      representada: novoCliente.representada,
      telefone: novoCliente.telefone,
      status: novoCliente.status,
    })
    .select("id,nome,cidade,bairro,representada,telefone,status")
    .single();

  if (error) throw new Error(`Falha ao salvar cliente: ${error.message}`);
  return data as Cliente;
}

export async function carregarVisitas(): Promise<Visita[]> {
  const { cliente } = await exigirUsuario();

  const { data, error } = await cliente
    .from("visitas")
    .select("id,cliente_id,cliente_nome,data,resultado,odometro,observacao")
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
  const { cliente, user } = await exigirUsuario();

  const { data, error } = await cliente
    .from("visitas")
    .insert({
      id: novaVisita.id,
      user_id: user.id,
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
