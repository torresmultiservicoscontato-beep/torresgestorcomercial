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
  ultima_visita: string | null;
  proxima_visita_prevista: string | null;
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

  const detalhes = new Map<string, ClienteDetalheRow>();
  // Bounded batches avoid oversized requests and API row limits on the summary.
  for (let inicio = 0; inicio < ids.length; inicio += 200) {
    const { data, error } = await cliente.rpc("carregar_resumo_clientes", {
      p_ids: ids.slice(inicio, inicio + 200),
      p_hoje: hoje,
    });
    if (error) throw new Error(`Falha ao carregar detalhes dos clientes: ${error.message}`);
    for (const row of (data ?? []) as ClienteDetalheRow[]) detalhes.set(row.id, row);
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
      ultimaVisita: detalhe?.ultima_visita ?? null,
      proximaVisitaPrevista: detalhe?.proxima_visita_prevista ?? null,
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
