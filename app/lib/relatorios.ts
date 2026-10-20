import { carregarAcessoAtual, pode } from './acesso';
import { obterRepresentanteAdministrado } from './adminContext';
import { obterPrepostoAdministrado } from './prepostoContext';
import { supabase } from './supabase';
import { dataValida, type Despesa } from './despesasModelo';
import type { VisitaRelatorio, VendaRelatorio, FinanceiroRelatorio, AgendaRelatorio } from './relatoriosModelo';

export type DadosRelatorio = {
  operacao: string; preposto: boolean; responsavelForcado: string | null;
  permissoes: { visitas: boolean; vendas: boolean; despesas: boolean; agenda: boolean };
  responsaveis: { user_id: string; nome: string }[];
  clientes: { id: string; nome: string }[];
  visitas: VisitaRelatorio[]; vendas: VendaRelatorio[]; financeiro: FinanceiroRelatorio[]; despesas: Despesa[]; agenda: AgendaRelatorio[];
};
type RespostaPagina<T> = { data: T[] | null; error: { message: string } | null };
async function todas<T>(consulta: (inicio: number, fim: number) => PromiseLike<RespostaPagina<T>>, nome: string): Promise<T[]> {
  const lista: T[] = [];
  for (let inicio = 0; ; inicio += 500) {
    const { data, error } = await consulta(inicio, inicio + 499);
    if (error) throw new Error(`Falha ao consultar ${nome}: ${error.message}`);
    lista.push(...(data ?? []));
    if (!data || data.length < 500) return lista;
  }
}
export async function carregarRelatorio(inicio: string, fim: string): Promise<DadosRelatorio> {
  if (!dataValida(inicio) || !dataValida(fim) || inicio > fim) throw new Error('Informe um período válido.');
  const banco = supabase;
  if (!banco) throw new Error('Banco de dados não configurado.');
  const acesso = await carregarAcessoAtual();
  if (!acesso || !pode(acesso, 'relatorios', 'visualizar')) throw new Error('Você não possui acesso aos relatórios desta operação.');
  const administrado = acesso.papel === 'admin' ? obterRepresentanteAdministrado() : null;
  const titular = administrado?.userId ?? acesso.titularUserId;
  const contextoPreposto = acesso.papel === 'preposto' ? null : obterPrepostoAdministrado();
  const responsavelForcado = acesso.papel === 'preposto' ? acesso.userId : contextoPreposto?.titularUserId === titular ? contextoPreposto.userId : null;
  const permissoes = { visitas: pode(acesso,'visitas','visualizar'), vendas: pode(acesso,'vendas','visualizar'), despesas: pode(acesso,'despesas','visualizar'), agenda: pode(acesso,'agenda','visualizar') };
  function tabela<T>(nome: string, campos: string, colunaTitular = 'titular_user_id', periodo = true, ativa = false) {
    return todas<T>((de, ate) => {
      let q = banco!.from(nome).select(campos).eq(colunaTitular, titular);
      if (periodo) q = q.gte('data', inicio).lte('data', fim);
      if (ativa) q = q.eq('ativa', true);
      if (responsavelForcado) q = colunaTitular === 'user_id' && responsavelForcado === titular
        ? q.or(`responsavel_user_id.eq.${titular},responsavel_user_id.is.null`) : q.eq('responsavel_user_id', responsavelForcado);
      return q.order('id').range(de, ate) as unknown as PromiseLike<RespostaPagina<T>>;
    }, nome);
  }
  const [visitas, vendas, financeiro, despesas, agenda, responsaveis, clientes] = await Promise.all([
    permissoes.visitas ? tabela<VisitaRelatorio>('visitas','id,user_id,responsavel_user_id,cliente_id,cliente_nome,data,resultado,tipo_contato,origem_venda,houve_venda,km_trecho,duracao_minutos,hora_entrada,hora_saida,proxima_acao,proxima_data','user_id') : [],
    permissoes.vendas ? tabela<VendaRelatorio>('vendas','id,responsavel_user_id,cliente_id,cliente_nome,visita_id,data,valor,situacao','titular_user_id',true,true) : [],
    todas<FinanceiroRelatorio>((de, ate) => {
      let q = banco.rpc('listar_comissoes_modulo',{p_titular_user_id: titular}).gte('data_venda',inicio).lte('data_venda',fim);
      if (responsavelForcado) q = q.eq('responsavel_user_id',responsavelForcado);
      return q.order('ordem_id').range(de,ate);
    },'faturamento e comissões'),
    permissoes.despesas ? tabela<Despesa>('despesas','*') : [],
    permissoes.agenda ? tabela<AgendaRelatorio>('agenda_eventos','id,responsavel_user_id,cliente_id,titulo,data,hora,tipo,status') : [],
    todas<{user_id: string; nome: string}>((de,ate) => banco.rpc('listar_responsaveis_agenda',{p_titular_user_id: titular}).order('user_id').range(de,ate),'responsáveis'),
    pode(acesso,'clientes','visualizar') ? tabela<{id:string; nome:string}>('clientes','id,nome','user_id',false) : [],
  ]);
  return { operacao: administrado?.nomeRepresentacao || administrado?.nome || acesso.nomeRepresentacao || acesso.nome, preposto: acesso.papel === 'preposto', responsavelForcado, permissoes,
    visitas, vendas, financeiro, despesas, agenda, clientes, responsaveis: responsaveis.filter(r => !responsavelForcado || r.user_id === responsavelForcado) };
}
