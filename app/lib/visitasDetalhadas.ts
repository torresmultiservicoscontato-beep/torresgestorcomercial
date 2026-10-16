import { carregarAcessoAtual, pode } from "./acesso";
import { limparRepresentanteAdministrado, obterRepresentanteAdministrado } from "./adminContext";
import { limparPrepostoAdministrado, obterPrepostoAdministrado } from "./prepostoContext";
import { supabase } from "./supabase";
import type { RepresentadaOperacional } from "./data";

export type TipoContato = "Presencial" | "Telefone" | "WhatsApp" | "Outro";

export type VisitaDetalhada = {
  id: string;
  clienteId: string;
  clienteNome: string;
  data: string;
  resultado: string;
  representadas: RepresentadaOperacional[];
  horaEntrada: string;
  horaSaida: string;
  duracaoMinutos: number | null;
  odometroInicial: string;
  odometroFinal: string;
  kmTrecho: number | null;
  origem: string;
  destino: string;
  tipoContato: TipoContato;
  houveVenda: boolean;
  valorVenda: number;
  origemVenda: string;
  proximaAcao: string;
  proximaData: string;
  frequencia: string;
  statusCliente: string;
  observacao: string;
};

type VisitaRow = {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  data: string;
  resultado: string;
  odometro: string | null;
  observacao: string;
  representada_id: string | null;
  hora_entrada: string | null;
  hora_saida: string | null;
  duracao_minutos: number | null;
  odometro_inicial: number | string | null;
  odometro_final: number | string | null;
  km_trecho: number | string | null;
  origem: string | null;
  destino: string | null;
  tipo_contato: string | null;
  houve_venda: boolean | null;
  valor_venda: number | string | null;
  origem_venda: string | null;
  proxima_acao: string | null;
  proxima_data: string | null;
  frequencia: string | null;
  status_cliente: string | null;
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
  if (!pode(acesso, "visitas", acao)) throw new Error("Você não possui permissão para esta ação.");

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

  return { cliente, userIdAlvo, responsavelUserId, filtroResponsavelUserId };
}

async function carregarRepresentadas(visitaIds: string[]) {
  const cliente = exigirSupabase();
  const resultado = new Map<string, RepresentadaOperacional[]>();
  if (visitaIds.length === 0) return resultado;

  const { data: relacoes, error } = await cliente
    .from("visita_representadas")
    .select("visita_id,representada_id")
    .in("visita_id", visitaIds);

  if (error) throw new Error(`Falha ao carregar representadas das visitas: ${error.message}`);

  const ids = Array.from(new Set((relacoes ?? []).map((item) => item.representada_id)));
  const catalogo = new Map<string, RepresentadaOperacional>();

  if (ids.length > 0) {
    const { data, error: catalogoError } = await cliente
      .from("representadas_catalogo")
      .select("id,nome")
      .in("id", ids);

    if (catalogoError) throw new Error(`Falha ao carregar representadas: ${catalogoError.message}`);
    for (const item of data ?? []) catalogo.set(item.id, { id: item.id, nome: item.nome });
  }

  for (const relacao of relacoes ?? []) {
    const representada = catalogo.get(relacao.representada_id);
    if (!representada) continue;
    const lista = resultado.get(relacao.visita_id) ?? [];
    lista.push(representada);
    resultado.set(relacao.visita_id, lista);
  }

  for (const lista of resultado.values()) lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return resultado;
}

function horaCurta(valor: string | null) {
  return valor ? valor.slice(0, 5) : "";
}

function numeroTexto(valor: number | string | null | undefined) {
  if (valor === null || valor === undefined || valor === "") return "";
  const texto = String(valor).replace(/\s*km\s*/gi, "").trim().replace(",", ".");
  const numero = Number(texto);
  return Number.isFinite(numero) ? String(numero) : "";
}

function numero(valor: number | string | null | undefined) {
  const convertido = Number(valor ?? 0);
  return Number.isFinite(convertido) ? convertido : 0;
}

function mapear(row: VisitaRow, representadas: RepresentadaOperacional[]): VisitaDetalhada {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    clienteNome: row.cliente_nome,
    data: row.data,
    resultado: row.resultado,
    representadas,
    horaEntrada: horaCurta(row.hora_entrada),
    horaSaida: horaCurta(row.hora_saida),
    duracaoMinutos: row.duracao_minutos === null ? null : Number(row.duracao_minutos),
    odometroInicial: numeroTexto(row.odometro_inicial),
    odometroFinal: numeroTexto(row.odometro_final) || numeroTexto(row.odometro),
    kmTrecho: row.km_trecho === null ? null : Number(row.km_trecho),
    origem: row.origem ?? "",
    destino: row.destino || row.cliente_nome,
    tipoContato: (row.tipo_contato || "Presencial") as TipoContato,
    houveVenda: Boolean(row.houve_venda),
    valorVenda: numero(row.valor_venda),
    origemVenda: row.origem_venda ?? "",
    proximaAcao: row.proxima_acao || "Retorno",
    proximaData: row.proxima_data ?? "",
    frequencia: row.frequencia ?? "",
    statusCliente: row.status_cliente ?? "",
    observacao: row.observacao ?? "",
  };
}

export async function carregarVisitasDetalhadas(): Promise<VisitaDetalhada[]> {
  const { cliente, userIdAlvo, filtroResponsavelUserId } = await resolverContexto("visualizar");

  let consulta = cliente
    .from("visitas")
    .select("id,cliente_id,cliente_nome,data,resultado,odometro,observacao,representada_id,hora_entrada,hora_saida,duracao_minutos,odometro_inicial,odometro_final,km_trecho,origem,destino,tipo_contato,houve_venda,valor_venda,origem_venda,proxima_acao,proxima_data,frequencia,status_cliente")
    .eq("user_id", userIdAlvo);

  if (filtroResponsavelUserId) consulta = consulta.eq("responsavel_user_id", filtroResponsavelUserId);

  const { data, error } = await consulta
    .order("data", { ascending: false })
    .order("hora_entrada", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Falha ao carregar visitas: ${error.message}`);

  const rows = (data ?? []) as VisitaRow[];
  const representadas = await carregarRepresentadas(rows.map((row) => row.id));
  return rows.map((row) => mapear(row, representadas.get(row.id) ?? []));
}

function decimalOuNull(valor: string) {
  const limpo = valor.trim().replace(",", ".");
  if (!limpo) return null;
  const convertido = Number(limpo);
  return Number.isFinite(convertido) ? convertido : null;
}

async function salvar(visita: VisitaDetalhada, acao: "cadastrar" | "editar") {
  const { cliente, userIdAlvo, responsavelUserId } = await resolverContexto(acao);

  const { data, error } = await cliente.rpc("salvar_visita_completa", {
    p_id: visita.id,
    p_titular_user_id: userIdAlvo,
    p_responsavel_user_id: responsavelUserId,
    p_cliente_id: visita.clienteId,
    p_data: visita.data,
    p_resultado: visita.resultado,
    p_representadas: visita.representadas.map((item) => item.id),
    p_hora_entrada: visita.horaEntrada || null,
    p_hora_saida: visita.horaSaida || null,
    p_odometro_inicial: decimalOuNull(visita.odometroInicial),
    p_odometro_final: decimalOuNull(visita.odometroFinal),
    p_origem: visita.origem,
    p_destino: visita.destino,
    p_tipo_contato: visita.tipoContato,
    p_houve_venda: visita.houveVenda,
    p_valor_venda: visita.houveVenda ? visita.valorVenda : 0,
    p_origem_venda: visita.houveVenda ? visita.origemVenda : "",
    p_proxima_acao: visita.proximaAcao,
    p_proxima_data: visita.proximaData || null,
    p_frequencia: visita.frequencia,
    p_status_cliente: visita.statusCliente,
    p_observacao: visita.observacao,
  });

  if (error) throw new Error(`${acao === "cadastrar" ? "Falha ao salvar" : "Falha ao atualizar"} visita: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as VisitaRow | null;
  if (!row) throw new Error("Visita não encontrada após o salvamento.");

  const representadas = await carregarRepresentadas([row.id]);
  return mapear(row, representadas.get(row.id) ?? visita.representadas);
}

export function criarVisitaDetalhada(visita: VisitaDetalhada) {
  return salvar(visita, "cadastrar");
}

export function atualizarVisitaDetalhada(visita: VisitaDetalhada) {
  return salvar(visita, "editar");
}
