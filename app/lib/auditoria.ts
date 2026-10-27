import { carregarAcessoAtual } from './acesso';
import { obterRepresentanteAdministrado } from './adminContext';
import { supabase } from './supabase';

export type RegistroAuditoria = {
 id: number; ocorrido_em: string; ator_user_id: string | null; ator_nome: string;
 origem: string; tabela: string; registro_id: string; acao: string;
 dados_antes: Record<string, unknown> | null; dados_depois: Record<string, unknown> | null;
};
export async function listarAuditoria(pagina: number, acao: string) {
 if (!supabase) throw new Error('Banco não configurado.');
 const acesso = await carregarAcessoAtual();
 if (!acesso) throw new Error('Sua sessão expirou.');
 if (acesso.papel === 'preposto') throw new Error('Histórico disponível apenas para o titular e administrador.');
 const administrado = acesso.papel === 'admin' ? obterRepresentanteAdministrado() : null;
 let consulta = supabase.from('auditoria')
  .select('id,ocorrido_em,ator_user_id,ator_nome,origem,tabela,registro_id,acao,dados_antes,dados_depois')
  .order('ocorrido_em', { ascending: false }).order('id', { ascending: false });
 if (administrado || acesso.papel !== 'admin') consulta = consulta.eq('titular_user_id', administrado?.userId ?? acesso.titularUserId);
 if (acao) consulta = consulta.eq('acao', acao);
 const { data, error } = await consulta.range(pagina * 50, pagina * 50 + 49);
 if (error) throw new Error(`Falha ao carregar histórico: ${error.message}`);
 return (data ?? []) as RegistroAuditoria[];
}
