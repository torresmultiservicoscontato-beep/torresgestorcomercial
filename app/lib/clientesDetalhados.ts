import { carregarAcessoAtual, pode } from "./acesso";
import { obterRepresentanteAdministrado, limparRepresentanteAdministrado } from "./adminContext";
import { carregarClientes, type Cliente, type RepresentadaOperacional } from "./data";
import { obterPrepostoAdministrado, limparPrepostoAdministrado } from "./prepostoContext";
import { supabase } from "./supabase";

export type ClienteDetalhado = Cliente & {
  logradouro: string;
  numero: string;
  complemento: string;
  cep: string;
  rotaId: string | null;
  rotaOrdem: number | null;
  latitude: number | null;
  longitude: number | null;
  ultimaVisita: string | null;
  proximaVisitaPrevista: string | null;
};

type ClienteDetalheRow = {
  id: string;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  cep: string | null;
  rota_id: string | null;
  rota_ordem: number | null;
  latitude: number | null;
  longitude: number | null;
};

function exigirSupabase() {
  if (!supabase) throw new Error("Banco de dados não configurado.");
  return supabase;
}

async function resolverContexto(acao: "cadastrar" | "editar") {
  const cliente = exigirSupabase();
  const {
    data: { user },
    error,
  } = await cliente.auth.getUser();

  if (error || !user) throw new Error("Sua sessão expirou. Entre novamente no sistema.");

  const acesso = await carregarAcessoAtual();
  if (!acesso) throw new Error("Não foi possível identificar seu acesso.");
  if (!pode(acesso, "clientes", acao)) throw new Error("Você não possui permissão para esta ação.");

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
    : prepostoAdministrado?.userId ?? titularUserId;

  return { cliente, titularUserId, responsavelUserId };
}

export async function carregarClientesDetalhados(): Promise<ClienteDetalhado[]> {
  const base = await carregarClientes();
  if (base.length === 0) return [];

  const cliente = exigirSupabase();
  const ids = base.map((item) => item.id);
  const hoje = (() => {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, "0");
    const dia = String(agora.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  })();

  const [
    { data, error },
    { data: visitas, error: visitasError },
    { data: agenda, error: agendaError },
  ] = await Promise.all([
    cliente
      .from("clientes")
      .select("id,logradouro,numero,complemento,cep,rota_id,rota_ordem,latitude,longitude")
      .in("id", ids),
    cliente
      .from("visitas")
      .select("cliente_id,data")
      .in("cliente_id", ids)
      .order("data", { ascending: false }),
    cliente
      .from("agenda_eventos")
      .select("cliente_id,data")
      .in("cliente_id", ids)
      .eq("origem", "frequencia")
      .eq("status", "Pendente")
      .gte("data", hoje)
      .order("data", { ascending: true }),
  ]);

  if (error) throw new Error(`Falha ao carregar endereço e rota dos clientes: ${error.message}`);
  if (visitasError) throw new Error(`Falha ao carregar histórico de visitas dos clientes: ${visitasError.message}`);
  if (agendaError) throw new Error(`Falha ao carregar próximas visitas dos clientes: ${agendaError.message}`);

  const detalhes = new Map(((data ?? []) as ClienteDetalheRow[]).map((row) => [row.id, row]));
  const ultimaVisita = new Map<string, string>();
  const proximaVisita = new Map<string, string>();

  for (const visita of visitas ?? []) {
    if (!ultimaVisita.has(visita.cliente_id)) ultimaVisita.set(visita.cliente_id, visita.data);
  }

  for (const evento of agenda ?? []) {
    if (!proximaVisita.has(evento.cliente_id)) proximaVisita.set(evento.cliente_id, evento.data);
  }

  return base.map((item) => {
    const detalhe = detalhes.get(item.id);
    return {
      ...item,
      logradouro: detalhe?.logradouro ?? "",
      numero: detalhe?.numero ?? "",
      complemento: detalhe?.complemento ?? "",
      cep: detalhe?.cep ?? "",
      rotaId: detalhe?.rota_id ?? null,
      rotaOrdem: detalhe?.rota_ordem === null || detalhe?.rota_ordem === undefined ? null : Number(detalhe.rota_ordem),
      latitude: detalhe?.latitude === null || detalhe?.latitude === undefined ? null : Number(detalhe.latitude),
      longitude: detalhe?.longitude === null || detalhe?.longitude === undefined ? null : Number(detalhe.longitude),
      ultimaVisita: ultimaVisita.get(item.id) ?? null,
      proximaVisitaPrevista: proximaVisita.get(item.id) ?? null,
    };
  });
}

async function salvar(clienteParaSalvar: ClienteDetalhado, acao: "cadastrar" | "editar") {
  const { cliente, titularUserId, responsavelUserId } = await resolverContexto(acao);

  const { error } = await cliente.rpc("salvar_cliente_completo", {
    p_id: clienteParaSalvar.id,
    p_titular_user_id: titularUserId,
    p_responsavel_user_id: responsavelUserId,
    p_nome: clienteParaSalvar.nome,
    p_cidade: clienteParaSalvar.cidade,
    p_bairro: clienteParaSalvar.bairro,
    p_logradouro: clienteParaSalvar.logradouro,
    p_numero: clienteParaSalvar.numero,
    p_complemento: clienteParaSalvar.complemento,
    p_cep: clienteParaSalvar.cep,
    p_telefone: clienteParaSalvar.telefone,
    p_status: clienteParaSalvar.status,
    p_rota_id: clienteParaSalvar.rotaId,
    p_representadas: clienteParaSalvar.representadas.map((item: RepresentadaOperacional) => item.id),
    p_frequencia_visita: clienteParaSalvar.frequenciaVisita,
  });

  if (error) throw new Error(`${acao === "cadastrar" ? "Falha ao salvar" : "Falha ao atualizar"} cliente: ${error.message}`);

  const atualizados = await carregarClientesDetalhados();
  const salvo = atualizados.find((item) => item.id === clienteParaSalvar.id);
  if (!salvo) throw new Error("Cliente não encontrado após o salvamento.");
  return salvo;
}

export function criarClienteDetalhado(cliente: ClienteDetalhado) {
  return salvar(cliente, "cadastrar");
}

export function atualizarClienteDetalhado(cliente: ClienteDetalhado) {
  return salvar(cliente, "editar");
}
