create function private.excluir_produto(p_titular_user_id uuid,p_produto_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sessão obrigatória' using errcode='42501';end if;
 if not (public.usuario_e_admin() or (auth.uid()=p_titular_user_id and exists(select 1 from public.perfis where user_id=auth.uid()))) then
 raise exception 'Você não possui permissão para excluir produtos.' using errcode='42501';end if;
 delete from public.representada_produtos where id=p_produto_id and titular_user_id=p_titular_user_id;
 if not found then raise exception 'Produto não encontrado nesta operação.';end if;
 -- As FKs SET NULL mantêm itens de vendas e comissões históricos.
end;$$;
create function public.excluir_produto(p_titular_user_id uuid,p_produto_id uuid)
returns void language sql security invoker set search_path='' as $$
 select private.excluir_produto(p_titular_user_id,p_produto_id);
$$;
revoke all on function private.excluir_produto(uuid,uuid),public.excluir_produto(uuid,uuid) from public,anon;
grant execute on function private.excluir_produto(uuid,uuid),public.excluir_produto(uuid,uuid) to authenticated;
