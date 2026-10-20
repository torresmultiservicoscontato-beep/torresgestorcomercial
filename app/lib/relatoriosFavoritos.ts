import { supabase } from './supabase';
import { configuracaoValida, type ConfiguracaoRelatorio, type FavoritoRelatorio } from './relatoriosFavoritosModelo';
export type ContextoFavoritos = { usuarioId:string; titularId:string; responsavelForcado:string|null };
function banco() { if (!supabase) throw new Error('Banco não configurado.'); return supabase; }
function consulta(ctx:ContextoFavoritos) {
  return banco().from('relatorios_favoritos').select('id,nome,configuracao').eq('usuario_id',ctx.usuarioId).eq('titular_user_id',ctx.titularId).eq('contexto_responsavel',ctx.responsavelForcado||'');
}
export async function listarFavoritos(ctx:ContextoFavoritos):Promise<FavoritoRelatorio[]> {
  const lista:FavoritoRelatorio[]=[];
  for(let de=0;;de+=500) {
    const {data,error}=await consulta(ctx).order('nome').order('id').range(de,de+499);
    if(error)throw new Error(`Não foi possível carregar os favoritos: ${error.message}`);
    for(const item of data??[]) {
      if(!configuracaoValida(item.configuracao))throw new Error('Um favorito possui formato incompatível. Os relatórios prontos continuam disponíveis.');
      lista.push(item as FavoritoRelatorio);
    }
    if(!data||data.length<500)return lista;
  }
}
export async function salvarFavorito(ctx:ContextoFavoritos,nome:string,configuracao:ConfiguracaoRelatorio,id?:string):Promise<FavoritoRelatorio> {
  if(!nome.trim()||nome.trim().length>100)throw new Error('Dê um nome ao relatório, com até 100 caracteres.');
  if(!configuracaoValida(configuracao))throw new Error('Escolha pelo menos uma coluna e confira a configuração.');
  const campos={nome:nome.trim(),configuracao,updated_at:new Date().toISOString()};
  const q=id?banco().from('relatorios_favoritos').update(campos).eq('id',id).eq('usuario_id',ctx.usuarioId).eq('titular_user_id',ctx.titularId).eq('contexto_responsavel',ctx.responsavelForcado||'')
    :banco().from('relatorios_favoritos').insert({...campos,usuario_id:ctx.usuarioId,titular_user_id:ctx.titularId,contexto_responsavel:ctx.responsavelForcado||''});
  const {data,error}=await q.select('id,nome,configuracao').single();
  if(error)throw new Error(`Não foi possível salvar o favorito: ${error.message}`);
  return data as FavoritoRelatorio;
}
export async function excluirFavorito(ctx:ContextoFavoritos,id:string) {
  const {data,error}=await banco().from('relatorios_favoritos').delete().eq('id',id).eq('usuario_id',ctx.usuarioId).eq('titular_user_id',ctx.titularId).eq('contexto_responsavel',ctx.responsavelForcado||'').select('id').single();
  if(error||!data)throw new Error('Não foi possível remover o favorito. Atualize a lista e tente novamente.');
}
