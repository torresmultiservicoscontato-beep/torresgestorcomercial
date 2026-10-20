create function private.excluir_visita(p_titular_user_id uuid,p_visita_id text,p_responsavel_user_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare v public.visitas;
begin
 if auth.uid() is null then raise exception 'Sessão obrigatória' using errcode='42501';end if;
 select * into v from public.visitas where id=p_visita_id and user_id=p_titular_user_id for update;
 if v.id is null then raise exception 'Visita não encontrada nesta operação.';end if;
 if p_responsavel_user_id is not null and coalesce(v.responsavel_user_id,v.user_id)<>p_responsavel_user_id then
 raise exception 'Visita fora da carteira selecionada.' using errcode='42501';end if;
 if public.usuario_e_admin() or (auth.uid()=v.user_id and exists(select 1 from public.perfis where user_id=auth.uid())) then null;
 elsif auth.uid()=coalesce(v.responsavel_user_id,v.user_id) and public.preposto_tem_permissao(v.user_id,'visitas','editar') then null;
 else raise exception 'Você não possui permissão para excluir esta visita.' using errcode='42501';end if;
 -- Serializa a exclusão com alterações na venda e pagamentos de suas ordens.
 perform 1 from public.vendas where visita_id=v.id for update;
 perform 1 from public.venda_ordens o join public.vendas ve on ve.id=o.venda_id where ve.visita_id=v.id for update of o;
 if exists(select 1 from public.venda_comissao_pagamentos p join public.venda_ordens o on o.id=p.ordem_id join public.vendas ve on ve.id=o.venda_id where ve.visita_id=v.id) then
 raise exception 'Esta visita possui comissão paga ou recebida. Regularize os pagamentos no financeiro antes de excluir.';end if;
 -- As FKs removem venda, itens, ordens, vínculos e eventos ligados à visita.
 delete from public.visitas where id=v.id and user_id=p_titular_user_id;
end;$$;
create function public.excluir_visita(p_titular_user_id uuid,p_visita_id text,p_responsavel_user_id uuid default null)
returns void language sql security invoker set search_path='' as $$
 select private.excluir_visita(p_titular_user_id,p_visita_id,p_responsavel_user_id);
$$;
revoke all on function private.excluir_visita(uuid,text,uuid),public.excluir_visita(uuid,text,uuid) from public,anon;
grant execute on function private.excluir_visita(uuid,text,uuid),public.excluir_visita(uuid,text,uuid) to authenticated;
