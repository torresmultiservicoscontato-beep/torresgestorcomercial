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
  const { data, error } = await cliente
    .from("clientes")
    .select("id,logradouro,numero,complemento,cep,rota_id,rota_ordem,latitude,longitude")
    .in("id", base.map((item) => item.id));

  if (error) throw new Error(`Falha ao carregar endereço e rota dos clientes: ${error.message}`);
  const detalhes = new Map(((data ?? []) as ClienteDetalheRow[]).map((row) => [row.id, row]));

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
