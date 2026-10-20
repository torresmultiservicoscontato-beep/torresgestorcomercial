import { carregarAcessoAtual, pode } from "./acesso";
import { obterRepresentanteAdministrado } from "./adminContext";
import { obterPrepostoAdministrado } from "./prepostoContext";
import { supabase } from "./supabase";
import { dataValida, validarDespesa, type Despesa, type FormDespesa } from "./despesasModelo";

export type ContextoDespesas = {
  titularId: string;
  usuarioId: string;
  responsavelForcadoId: string | null;
  podeCadastrar: boolean;
  podeEditar: boolean;
};
export type ResponsavelDespesa = { user_id: string; nome: string; tipo: string };
export type ClienteDespesa = { id: string; nome: string; cidade: string; bairro: string };
export type RotaDespesa = { id: string; responsavel_user_id: string; dia_semana: number; municipio: string; bairros: string[] };

async function contexto(acao: "visualizar" | "cadastrar" | "editar" = "visualizar") {
  const cliente = supabase;
  if (!cliente) throw new Error("Banco de dados não configurado.");
  const acesso = await carregarAcessoAtual();
  if (!acesso) throw new Error("Sua sessão expirou. Entre novamente.");
  if (!pode(acesso, "despesas", "visualizar") || !pode(acesso, "despesas", acao)) throw new Error("Você não possui permissão para esta ação em Despesas.");
  const administrado = acesso.papel === "admin" ? obterRepresentanteAdministrado() : null;
  const titularId = administrado?.userId ?? acesso.titularUserId;
  const preposto = acesso.papel === "preposto" ? null : obterPrepostoAdministrado();
  const ctx: ContextoDespesas = {
    titularId,
    usuarioId: acesso.userId,
    responsavelForcadoId: acesso.papel === "preposto" ? acesso.userId : preposto?.titularUserId === titularId ? preposto.userId : null,
    podeCadastrar: pode(acesso, "despesas", "cadastrar"),
    podeEditar: pode(acesso, "despesas", "editar"),
  };
  return { cliente, ctx };
}

export async function carregarOpcoesDespesas() {
  const { cliente, ctx } = await contexto();
  const { data, error } = await cliente.rpc("listar_responsaveis_agenda", { p_titular_user_id: ctx.titularId });
  if (error) throw new Error(`Falha ao carregar responsáveis: ${error.message}`);
  const responsaveis = ((data ?? []) as ResponsavelDespesa[]).filter((r) => !ctx.responsavelForcadoId || r.user_id === ctx.responsavelForcadoId);
  return { contexto: ctx, responsaveis };
}

export async function carregarRotasDespesas(responsavelId: string): Promise<RotaDespesa[]> {
  const { cliente, ctx } = await contexto();
  if (ctx.responsavelForcadoId && ctx.responsavelForcadoId !== responsavelId) throw new Error("Responsável fora do contexto atual.");
  const { data, error } = await cliente.from("rotas_semanais")
    .select("id,responsavel_user_id,dia_semana,municipio,bairros")
    .eq("titular_user_id", ctx.titularId).eq("responsavel_user_id", responsavelId).order("dia_semana");
  if (error) throw new Error(`Não foi possível carregar as rotas: ${error.message}`);
  return (data ?? []) as RotaDespesa[];
}

export async function carregarClientesDespesas(responsavelId: string): Promise<ClienteDespesa[]> {
  const { cliente, ctx } = await contexto();
  if (ctx.responsavelForcadoId && ctx.responsavelForcadoId !== responsavelId) throw new Error("Responsável fora do contexto atual.");
  const clientes: ClienteDespesa[] = [];
  for (let offset = 0; ; offset += 500) {
    let consulta = cliente.from("clientes").select("id,nome,cidade,bairro").eq("user_id", ctx.titularId);
    consulta = responsavelId === ctx.titularId
      ? consulta.or(`responsavel_user_id.eq.${responsavelId},responsavel_user_id.is.null`)
      : consulta.eq("responsavel_user_id", responsavelId);
    const { data, error } = await consulta.order("nome").order("id").range(offset, offset + 499);
    if (error) throw new Error(`Não foi possível carregar os clientes: ${error.message}`);
    const pagina = (data ?? []) as ClienteDespesa[];
    clientes.push(...pagina);
    if (pagina.length < 500) break;
  }
  return clientes;
}

export async function listarDespesas(inicio: string, fim: string): Promise<Despesa[]> {
  if (!dataValida(inicio) || !dataValida(fim) || inicio > fim) throw new Error("Informe um período válido: o início deve ser anterior ou igual ao fim.");
  const { cliente, ctx } = await contexto();
  const despesas: Despesa[] = [];
  // Paginação explícita: os totais nunca se limitam silenciosamente às primeiras mil linhas.
  for (let offset = 0; ; offset += 500) {
    let consulta = cliente.from("despesas").select("*")
      .eq("titular_user_id", ctx.titularId).gte("data", inicio).lte("data", fim)
      .order("data", { ascending: false }).order("id").range(offset, offset + 499);
    if (ctx.responsavelForcadoId) consulta = consulta.eq("responsavel_user_id", ctx.responsavelForcadoId);
    const { data, error } = await consulta;
    if (error) throw new Error(`Falha ao carregar despesas: ${error.message}`);
    const pagina = (data ?? []) as Despesa[];
    despesas.push(...pagina.map((d) => ({ ...d, valor_centavos: Number(d.valor_centavos) })));
    if (pagina.length < 500) break;
  }
  return despesas;
}

export async function salvarDespesa(form: FormDespesa, existente?: Despesa | null) {
  const valor = validarDespesa(form);
  const { cliente, ctx } = await contexto(existente ? "editar" : "cadastrar");
  if (ctx.responsavelForcadoId && ctx.responsavelForcadoId !== form.responsavel_user_id) throw new Error("Você só pode lançar despesas do responsável selecionado na operação.");
  const campos = {
    grupo: form.grupo, categoria: form.categoria, descricao: form.descricao.trim(),
    valor_centavos: valor, data: form.data, vencimento: form.vencimento || null, status: form.status,
    pago_em: form.status === "Pago" ? form.pago_em : null,
    forma_pagamento: form.status === "Pago" ? form.forma_pagamento : null,
    fornecedor: form.fornecedor.trim(), documento: form.documento.trim(), observacao: form.observacao.trim(),
    rota_id: form.rota_id || null, cliente_id: form.cliente_id || null,
  };
  const consulta = existente
    ? cliente.from("despesas").update(campos).eq("id", existente.id).eq("titular_user_id", ctx.titularId).eq("updated_at", existente.updated_at)
    : cliente.from("despesas").insert({ ...campos, titular_user_id: ctx.titularId, responsavel_user_id: form.responsavel_user_id });
  const { data, error } = await consulta.select("*").maybeSingle();
  if (error) throw new Error(`Falha ao salvar despesa: ${error.message}`);
  if (!data) throw new Error("Esta despesa foi alterada por outro usuário ou seu acesso mudou. Atualize a lista e tente novamente.");
  return { ...data, valor_centavos: Number(data.valor_centavos) } as Despesa;
}
