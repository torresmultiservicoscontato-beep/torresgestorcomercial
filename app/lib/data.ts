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

export const CLIENTES_KEY = "torres-gestor-clientes";
export const VISITAS_KEY = "torres-gestor-visitas";

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

export function carregarClientes(): Cliente[] {
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

export function salvarClientes(clientes: Cliente[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CLIENTES_KEY, JSON.stringify(clientes));
  }
}

export function carregarVisitas(): Visita[] {
  if (typeof window === "undefined") return [];

  const salvo = window.localStorage.getItem(VISITAS_KEY);
  if (!salvo) return [];

  try {
    return JSON.parse(salvo) as Visita[];
  } catch {
    return [];
  }
}

export function salvarVisitas(visitas: Visita[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(VISITAS_KEY, JSON.stringify(visitas));
  }
}
