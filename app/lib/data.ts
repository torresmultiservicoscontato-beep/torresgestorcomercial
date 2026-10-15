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

export const CLIENTES_KEY = "torres-gestor-clientes";
export const VISITAS_KEY = "torres-gestor-visitas";
export const bancoRemotoAtivo = supabaseConfigured;

export const clientesIniciais: Cliente[] = [
  {
    id: "vale-mc",
    nome: "Vale Materiais de Construção",
    cidade: "Guapimirim",
    bairro: "Curral de Zinco",
    representada: "King Ouro",
    telefone: "",
    status: "Visitar hoje",
  },
  {
    id: "pires-mc",
    nome: "Pires Materiais de Construção",
    cidade: "Magé",
    bairro: "Mauá",
    representada: "Argamil",
    telefone: "",
    status: "Em dia",
  },
  {
    id: "vila-olimpia-mc",
    nome: "Vila Olímpia MC",
    cidade: "Guapimirim",
    bairro: "Vila Olímpia",
    representada: "King Ouro",
    telefone: "",
    status: "Próxima visita",
  },
];

function carregarClientesLocal(): Cliente[] {
  if (typeof window === "undefined") return clientesIniciais;

  const salvo = window.localStorage.getItem(CLIENTES_KEY);
  if (!salvo) {
    window.localStorage.setItem(CLIENTES_KEY, JSON.stringify(clientesIniciais));
    return clientesIniciais;
  }

  try {
    return JSON.parse(salvo) as Cliente[];
  } catch {
    return clientesIniciais;
  }
}

function carregarVisitasLocal(): Visita[] {
  if (typeof window === "undefined") return [];

  const salvo = window.localStorage.getItem(VISITAS_KEY);
  if (!salvo) return [];

  try {
    return JSON.parse(salvo) as Visita[];
  } catch {
    return [];
  }
}

export async function carregarClientes(): Promise<Cliente[]> {
  if (!supabase) return carregarClientesLocal();

  const { data, error } = await supabase
    .from("clientes")
    .select("id,nome,cidade,bairro,representada,telefone,status")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Falha ao carregar clientes: ${error.message}`);
  return (data ?? []) as Cliente[];
}

export async function criarCliente(cliente: Cliente): Promise<Cliente> {
  if (!supabase) {
    const clientes = carregarClientesLocal();
    const novaLista = [cliente, ...clientes.filter((item) => item.id !== cliente.id)];
    window.localStorage.setItem(CLIENTES_KEY, JSON.stringify(novaLista));
    return cliente;
  }

  const { data, error } = await supabase
    .from("clientes")
    .insert({
      id: cliente.id,
      nome: cliente.nome,
      cidade: cliente.cidade,
      bairro: cliente.bairro,
      representada: cliente.representada,
      telefone: cliente.telefone,
      status: cliente.status,
    })
    .select("id,nome,cidade,bairro,representada,telefone,status")
    .single();

  if (error) throw new Error(`Falha ao salvar cliente: ${error.message}`);
  return data as Cliente;
}

export async function carregarVisitas(): Promise<Visita[]> {
  if (!supabase) return carregarVisitasLocal();

  const { data, error } = await supabase
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

export async function criarVisita(visita: Visita): Promise<Visita> {
  if (!supabase) {
    const visitas = carregarVisitasLocal();
    const novaLista = [visita, ...visitas.filter((item) => item.id !== visita.id)];
    window.localStorage.setItem(VISITAS_KEY, JSON.stringify(novaLista));
    return visita;
  }

  const { data, error } = await supabase
    .from("visitas")
    .insert({
      id: visita.id,
      cliente_id: visita.clienteId,
      cliente_nome: visita.clienteNome,
      data: visita.data,
      resultado: visita.resultado,
      odometro: visita.odometro,
      observacao: visita.observacao,
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
