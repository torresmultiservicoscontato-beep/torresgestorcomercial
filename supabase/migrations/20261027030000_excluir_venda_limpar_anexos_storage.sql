drop function if exists public.excluir_visita(uuid,text,uuid);
drop function if exists private.excluir_visita(uuid,text,uuid);

create function private.excluir_visita(
 p_titular_user_id uuid,
 p_visita_id text,
 p_responsavel_user_id uuid default null
) returns text[]
language plpgsql
security definer
set search_path=''
as $$
declare
 v public.visitas;
 v_caminhos text[];
begin
 if auth.uid() is null then
  raise exception 'Sessão obrigatória' using errcode='42501';
 end if;

 select * into v
 from public.visitas
 where id=p_visita_id and user_id=p_titular_user_id
 for update;

 if v.id is null then
  raise exception 'Visita não encontrada nesta operação.';
 end if;

 if p_responsavel_user_id is not null
    and coalesce(v.responsavel_user_id,v.user_id)<>p_responsavel_user_id then
  raise exception 'Visita fora da carteira selecionada.' using errcode='42501';
 end if;

 if public.usuario_e_admin()
    or (auth.uid()=v.user_id and exists(select 1 from public.perfis where user_id=auth.uid())) then
  null;
 elsif auth.uid()=coalesce(v.responsavel_user_id,v.user_id)
       and public.preposto_tem_permissao(v.user_id,'visitas','excluir') then
  null;
 else
  raise exception 'Você não possui permissão para excluir esta visita.' using errcode='42501';
 end if;

 -- Serializa a exclusão com alterações na venda e pagamentos de suas ordens.
 perform 1 from public.vendas where visita_id=v.id for update;
 perform 1
 from public.venda_ordens o
 join public.vendas ve on ve.id=o.venda_id
 where ve.visita_id=v.id
 for update of o;

 if exists(
  select 1
  from public.venda_comissao_pagamentos p
  join public.venda_ordens o on o.id=p.ordem_id
  join public.vendas ve on ve.id=o.venda_id
  where ve.visita_id=v.id
 ) then
  raise exception 'Esta visita possui comissão paga ou recebida. Regularize os pagamentos no financeiro antes de excluir.';
 end if;

 -- Captura os objetos físicos antes de a cascata remover venda_anexos.
 select coalesce(
  array_agg(va.caminho_storage order by va.id)
   filter (where nullif(btrim(va.caminho_storage),'') is not null),
  '{}'::text[]
 )
 into v_caminhos
 from public.vendas ve
 join public.venda_anexos va on va.venda_id=ve.id
 where ve.visita_id=v.id;

 -- As FKs removem venda, itens, ordens, vínculos, anexos e eventos ligados à visita.
 delete from public.visitas
 where id=v.id and user_id=p_titular_user_id;

 return v_caminhos;
end;
$$;

create function public.excluir_visita(
 p_titular_user_id uuid,
 p_visita_id text,
 p_responsavel_user_id uuid default null
) returns text[]
language sql
security invoker
set search_path=''
as $$
 select private.excluir_visita(p_titular_user_id,p_visita_id,p_responsavel_user_id);
$$;

revoke all on function private.excluir_visita(uuid,text,uuid),public.excluir_visita(uuid,text,uuid)
from public,anon;
grant execute on function private.excluir_visita(uuid,text,uuid),public.excluir_visita(uuid,text,uuid)
to authenticated;


create or replace function private.pode_excluir_documento_venda_storage(p_nome text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select
  auth.uid() is not null
  and cardinality(storage.foldername(p_nome)) >= 2
  and (
   public.usuario_e_admin()
   or (storage.foldername(p_nome))[1] = auth.uid()::text
   or exists (
    select 1
    from public.auditoria a
    where a.ator_user_id = auth.uid()
      and a.tabela = 'vendas'
      and a.acao = 'DELETE'
      and a.registro_id = (storage.foldername(p_nome))[2]
      and a.titular_user_id::text = (storage.foldername(p_nome))[1]
      and a.ocorrido_em >= now() - interval '1 hour'
   )
  );
$$;

revoke all on function private.pode_excluir_documento_venda_storage(text)
from public,anon;
grant execute on function private.pode_excluir_documento_venda_storage(text)
to authenticated;

drop policy if exists vendas_documentos_delete on storage.objects;
create policy vendas_documentos_delete
on storage.objects
for delete
to authenticated
using (
 bucket_id = 'vendas-documentos'
 and private.pode_excluir_documento_venda_storage(name)
);
