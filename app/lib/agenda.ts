import { carregarAcessoAtual, pode } from "./acesso";
import { obterRepresentanteAdministrado } from "./adminContext";
import { obterPrepostoAdministrado } from "./prepostoContext";
import { supabase } from "./supabase";

export type TipoAgenda = "Retorno" | "Visita" | "Ligação" | "WhatsApp" | "Reunião" | "Cobrança" | "Outro";
export type PrioridadeAgenda = "Baixa" | "Normal" | "Alta";
export type StatusAgenda = "Pendente" | "Concluído" | "Cancelado";

export type ResponsavelAgenda = {
  userId: string;
  nome: string;
  tipo: "representante" | "preposto";
};

export type ClienteAgenda = {
  id: string;
  nome: string;
};

export type RepresentadaAgenda = {
  id: string;
  nome: string;
};

export type EventoAgenda = {
  id: string;
  responsavelUserId: string;
  responsavelNome: string;
  responsavelTipo: "representante" | "preposto";
  clienteId: string | null;
  clienteNome: string;
  representadaIds: string[];
  representadaNomes: string[];
  visitaId: string | null;
  origem: "manual" | "visita" | "frequencia";
  tipo: TipoAgenda;
  titulo: string;
  data: string;
  hora: string;
  prioridade: PrioridadeAgenda;
  status: StatusAgenda;
  observacao: string;
  concluidoEm: string | null;
  criadoEm: string;
  serieId: string | null;
  frequenciaCliente: string;
  ultimaVisita: string | null;
  proximaVisitaPrevista: string | null;
};

export type ContextoAgenda = {
  titularUserId: string;
  modo: "gestao" | "preposto";
  podeCadastrar: boolean;
  podeEditar: boolean;
  responsavelForcadoId: string | null;
};

function exigirSupabase() {
  if (!supabase) throw new Error("Banco de dados não configurado.");
  return supabase;
}

async function contexto(): Promise<ContextoAgenda & { cliente: NonNullable<typeof supabase> }> {
  const cliente = exigirSupabase();
  const {
    data: { user },
    error,
  } = await cliente.auth.getUser();

  if (error || !user) throw new Error("Sua sessão expirou. Entre novamente.");

  const acesso = await carregarAcessoAtual();
  if (!acesso) throw new Error("Não foi possível identificar seu acesso.");

  const administrado = acesso.papel === "admin" ? obterRepresentanteAdministrado() : null;
  const titularUserId = administrado?.userId ?? acesso.titularUserId;

  const prepostoAdministrado = acesso.papel === "preposto" ? null : obterPrepostoAdministrado();
  const responsavelForcadoId =
    prepostoAdministrado?.titularUserId === titularUserId ? prepostoAdministrado.userId : null;

  return {
    cliente,
    titularUserId,
    modo: acesso.papel === "preposto" ? "preposto" : "gestao",
    podeCadastrar: pode(acesso, "agenda", "cadastrar"),
    podeEditar: pode(acesso, "agenda", "editar"),
    responsavelForcadoId,
  };
}

export async function carregarAgenda(): Promise<{
  contexto: ContextoAgenda;
  eventos: EventoAgenda[];
  responsaveis: ResponsavelAgenda[];
  clientes: ClienteAgenda[];
  representadas: RepresentadaAgenda[];
}> {
  const ctx = await contexto();

  const [
    { data: eventos, error: eventosError },
    { data: responsaveis, error: responsaveisError },
    { data: clientes, error: clientesError },
    { data: representadas, error: representadasError },
  ] = await Promise.all([
    ctx.cliente.rpc("listar_agenda_eventos", { p_titular_user_id: ctx.titularUserId }),
    ctx.cliente.rpc("listar_responsaveis_agenda", { p_titular_user_id: ctx.titularUserId }),
    ctx.cliente.rpc("listar_clientes_agenda", { p_titular_user_id: ctx.titularUserId }),
    ctx.cliente.rpc("listar_representadas_agenda", { p_titular_user_id: ctx.titularUserId }),
  ]);

  if (eventosError) throw new Error(`Falha ao carregar agenda: ${eventosError.message}`);
  if (responsaveisError) throw new Error(`Falha ao carregar responsáveis: ${responsaveisError.message}`);
  if (clientesError) throw new Error(`Falha ao carregar clientes da agenda: ${clientesError.message}`);
  if (representadasError) throw new Error(`Falha ao carregar representadas da agenda: ${representadasError.message}`);

  return {
    contexto: {
      titularUserId: ctx.titularUserId,
      modo: ctx.modo,
      podeCadastrar: ctx.podeCadastrar,
      podeEditar: ctx.podeEditar,
      responsavelForcadoId: ctx.responsavelForcadoId,
    },
    eventos: (eventos ?? []).map((item: any) => ({
      id: item.evento_id,
      responsavelUserId: item.responsavel_user_id,
      responsavelNome: item.responsavel_nome,
      responsavelTipo: item.responsavel_tipo === "preposto" ? "preposto" : "representante",
      clienteId: item.cliente_id,
      clienteNome: item.cliente_nome ?? "Sem cliente",
      representadaIds: item.representada_ids ?? [],
      representadaNomes: item.representada_nomes ?? [],
      visitaId: item.visita_id,
      origem: item.origem === "visita" ? "visita" : item.origem === "frequencia" ? "frequencia" : "manual",
      tipo: item.tipo as TipoAgenda,
      titulo: item.titulo,
      data: item.data,
      hora: item.hora ? String(item.hora).slice(0, 5) : "",
      prioridade: item.prioridade as PrioridadeAgenda,
      status: item.status as StatusAgenda,
      observacao: item.observacao ?? "",
      concluidoEm: item.concluido_em,
      criadoEm: item.created_at,
      serieId: item.serie_id ?? null,
      frequenciaCliente: item.frequencia_cliente ?? "",
      ultimaVisita: item.ultima_visita ?? null,
      proximaVisitaPrevista: item.proxima_visita_prevista ?? null,
    })),
    responsaveis: (responsaveis ?? []).map((item: any) => ({
      userId: item.user_id,
      nome: item.nome,
      tipo: item.tipo === "preposto" ? "preposto" : "representante",
    })),
    clientes: (clientes ?? []).map((item: any) => ({
      id: item.cliente_id,
      nome: item.nome,
    })),
    representadas: (representadas ?? []).map((item: any) => ({
      id: item.representada_id,
      nome: item.nome,
    })),
  };
}

export async function salvarEventoAgenda(input: {
  id?: string | null;
  responsavelUserId?: string | null;
  clienteId?: string | null;
  representadaId?: string | null;
  tipo: TipoAgenda;
  titulo: string;
  data: string;
  hora?: string | null;
  prioridade: PrioridadeAgenda;
  observacao?: string;
}) {
  const ctx = await contexto();

  if (input.id && !ctx.podeEditar) throw new Error("Você não possui permissão para editar a Agenda.");
  if (!input.id && !ctx.podeCadastrar) throw new Error("Você não possui permissão para cadastrar na Agenda.");

  const { data, error } = await ctx.cliente.rpc("salvar_evento_agenda", {
    p_titular_user_id: ctx.titularUserId,
    p_evento_id: input.id ?? null,
    p_responsavel_user_id: input.responsavelUserId ?? null,
    p_cliente_id: input.clienteId ?? null,
    p_representada_id: input.representadaId ?? null,
    p_tipo: input.tipo,
    p_titulo: input.titulo,
    p_data: input.data,
    p_hora: input.hora || null,
    p_prioridade: input.prioridade,
    p_observacao: input.observacao ?? "",
  });

  if (error) throw new Error(`Falha ao salvar atividade: ${error.message}`);
  return data as string;
}

export async function atualizarStatusAgenda(eventoId: string, status: StatusAgenda) {
  const ctx = await contexto();
  if (!ctx.podeEditar) throw new Error("Você não possui permissão para alterar a Agenda.");

  const { error } = await ctx.cliente.rpc("atualizar_status_agenda", {
    p_titular_user_id: ctx.titularUserId,
    p_evento_id: eventoId,
    p_status: status,
  });

  if (error) throw new Error(`Falha ao atualizar atividade: ${error.message}`);
}


export async function cancelarFuturosFrequenciaAgenda(eventoId: string) {
  const ctx = await contexto();
  if (!ctx.podeEditar) throw new Error("Você não possui permissão para alterar a Agenda.");

  const { data, error } = await ctx.cliente.rpc("cancelar_futuros_frequencia_agenda", {
    p_titular_user_id: ctx.titularUserId,
    p_evento_id: eventoId,
  });

  if (error) throw new Error(`Falha ao cancelar a programação futura: ${error.message}`);
  return Number(data ?? 0);
}
