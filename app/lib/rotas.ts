import { carregarAcessoAtual, pode } from "./acesso";
import { limparRepresentanteAdministrado, obterRepresentanteAdministrado } from "./adminContext";
import { limparPrepostoAdministrado, obterPrepostoAdministrado } from "./prepostoContext";
import { supabase } from "./supabase";

export type RepresentadaRota = {
  id: string;
  nome: string;
};

export type RotaSemanal = {
  id: string;
  diaSemana: number;
  municipio: string;
  bairros: string[];
  observacao: string;
  representadas: RepresentadaRota[];
  atualizadoEm: string;
};

export type ClienteMapaRota = {
  id: string;
  nome: string;
  cidade: string;
  bairro: string;
  logradouro: string;
  numero: string;
  complemento: string;
  cep: string;
  latitude: number | null;
  longitude: number | null;
  ordem: number | null;
  representadas: RepresentadaRota[];
};

type RotaRow = {
  id: string;
  dia_semana: number;
  municipio: string;
  bairros: string[] | null;
  observacao: string;
  representada_ids: string[] | null;
  representada_nomes: string[] | null;
  updated_at: string;
};

type ClienteMapaRow = {
  id: string;
  nome: string;
  cidade: string;
  bairro: string;
  logradouro: string;
  numero: string;
  complemento: string;
  cep: string;
  latitude: number | null;
  longitude: number | null;
  rota_ordem: number | null;
  representada_ids: string[] | null;
  representada_nomes: string[] | null;
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
  if (!pode(acesso, "rotas", acao)) throw new Error("Você não possui permissão para esta ação em Rotas.");

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

  return { cliente, acesso, titularUserId, responsavelUserId, userIdLogado: user.id };
}

function mapearRota(row: RotaRow): RotaSemanal {
  const ids = row.representada_ids ?? [];
  const nomes = row.representada_nomes ?? [];
  return {
    id: row.id,
    diaSemana: Number(row.dia_semana),
    municipio: row.municipio ?? "",
    bairros: row.bairros ?? [],
    observacao: row.observacao ?? "",
    representadas: ids.map((id, indice) => ({ id, nome: nomes[indice] ?? "Representada" })),
    atualizadoEm: row.updated_at,
  };
}

export async function listarRotasSemanais(responsavelUserIdOverride?: string): Promise<RotaSemanal[]> {
  const contexto = await resolverContexto("visualizar");
  const responsavelUserId = responsavelUserIdOverride || contexto.responsavelUserId;

  if (contexto.acesso.papel === "preposto" && responsavelUserId !== contexto.userIdLogado) {
    throw new Error("O preposto só pode consultar as próprias rotas.");
  }

  const { data, error } = await contexto.cliente.rpc("listar_rotas_semanais", {
    p_titular_user_id: contexto.titularUserId,
    p_responsavel_user_id: responsavelUserId,
  });

  if (error) throw new Error(`Falha ao carregar rotas: ${error.message}`);
  return ((data ?? []) as RotaRow[]).map(mapearRota);
}

export async function listarRepresentadasParaRotas(): Promise<RepresentadaRota[]> {
  const { cliente, titularUserId, responsavelUserId } = await resolverContexto("visualizar");

  const { data, error } = await cliente.rpc("listar_representadas_operacionais", {
    p_titular_user_id: titularUserId,
    p_responsavel_user_id: responsavelUserId,
  });

  if (error) throw new Error(`Falha ao carregar representadas: ${error.message}`);
  return (data ?? []).map((item: { representada_id: string; nome: string }) => ({
    id: item.representada_id,
    nome: item.nome,
  }));
}

export async function salvarRotaSemanal(input: {
  diaSemana: number;
  municipio: string;
  bairros: string[];
  observacao: string;
  representadaIds: string[];
  editando: boolean;
}): Promise<RotaSemanal[]> {
  const acao = input.editando ? "editar" : "cadastrar";
  const { cliente, titularUserId, responsavelUserId } = await resolverContexto(acao);

  const { error } = await cliente.rpc("salvar_rota_semanal", {
    p_titular_user_id: titularUserId,
    p_responsavel_user_id: responsavelUserId,
    p_dia_semana: input.diaSemana,
    p_municipio: input.municipio.trim(),
    p_bairros: input.bairros,
    p_observacao: input.observacao.trim(),
    p_representadas: input.representadaIds,
  });

  if (error) throw new Error(`Falha ao salvar rota: ${error.message}`);
  return listarRotasSemanais();
}

export async function listarClientesMapaRota(rotaId: string): Promise<ClienteMapaRota[]> {
  const { cliente } = await resolverContexto("visualizar");
  const { data, error } = await cliente.rpc("listar_clientes_mapa_rota", {
    p_rota_id: rotaId,
  });

  if (error) throw new Error(`Falha ao carregar clientes da rota: ${error.message}`);

  return ((data ?? []) as ClienteMapaRow[]).map((row) => {
    const ids = row.representada_ids ?? [];
    const nomes = row.representada_nomes ?? [];
    return {
      id: row.id,
      nome: row.nome,
      cidade: row.cidade ?? "",
      bairro: row.bairro ?? "",
      logradouro: row.logradouro ?? "",
      numero: row.numero ?? "",
      complemento: row.complemento ?? "",
      cep: row.cep ?? "",
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      ordem: row.rota_ordem === null ? null : Number(row.rota_ordem),
      representadas: ids.map((id, indice) => ({ id, nome: nomes[indice] ?? "Representada" })),
    };
  });
}

export async function atualizarCoordenadasClienteRota(clienteId: string, latitude: number, longitude: number) {
  const { cliente } = await resolverContexto("visualizar");
  const { error } = await cliente.rpc("atualizar_coordenadas_cliente_rota", {
    p_cliente_id: clienteId,
    p_latitude: latitude,
    p_longitude: longitude,
  });

  if (error) throw new Error(`Falha ao salvar localização do cliente: ${error.message}`);
}
