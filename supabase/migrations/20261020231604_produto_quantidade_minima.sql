-- Preserva produtos existentes e clientes antigos dos RPCs anteriores.
alter table public.representada_produtos add column quantidade_minima numeric not null default 1
 check (quantidade_minima > 0 and quantidade_minima <= 999999999.999 and quantidade_minima=round(quantidade_minima,3));

create function private.salvar_produto_quantidade_minima(
 p_titular_user_id uuid,p_representada_id uuid,p_id uuid,p_codigo text,p_nome text,p_unidade text,p_ativo boolean,p_comissao_percentual numeric,p_quantidade_minima numeric
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Sessão obrigatória' using errcode='42501';end if;
 if p_quantidade_minima is null or p_quantidade_minima<=0 or p_quantidade_minima>999999999.999 or p_quantidade_minima<>round(p_quantidade_minima,3) then
 raise exception 'Informe uma quantidade mínima positiva com até três casas decimais.' using errcode='23514';end if;
 -- Reutiliza todas as verificações de operação, representada e papel existentes.
 v_id:=public.salvar_produto_representada_v2(p_titular_user_id,p_representada_id,p_id,p_codigo,p_nome,p_unidade,p_ativo,p_comissao_percentual);
 update public.representada_produtos set quantidade_minima=p_quantidade_minima where id=v_id and titular_user_id=p_titular_user_id;
 return v_id;
end;$$;
create function public.salvar_produto_representada_v3(
 p_titular_user_id uuid,p_representada_id uuid,p_id uuid,p_codigo text,p_nome text,p_unidade text,p_ativo boolean,p_comissao_percentual numeric,p_quantidade_minima numeric
) returns uuid language sql security invoker set search_path='' as $$
 select private.salvar_produto_quantidade_minima(p_titular_user_id,p_representada_id,p_id,p_codigo,p_nome,p_unidade,p_ativo,p_comissao_percentual,p_quantidade_minima);
$$;
create function private.listar_produtos_quantidade_minima(p_titular_user_id uuid,p_representada_id uuid default null)
returns table(produto_id uuid,representada_id uuid,representada_nome text,codigo text,nome text,unidade text,ativo boolean,comissao_representante_percentual numeric,comissao_preposto_percentual numeric,comissao_preposto_especifica boolean,quantidade_minima numeric)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sessão obrigatória' using errcode='42501';end if;
 return query select l.*,rp.quantidade_minima
 from public.listar_produtos_modulo(p_titular_user_id,p_representada_id) l
 join public.representada_produtos rp on rp.id=l.produto_id and rp.titular_user_id=p_titular_user_id;
end;$$;
create function public.listar_produtos_modulo_v2(p_titular_user_id uuid,p_representada_id uuid default null)
returns table(produto_id uuid,representada_id uuid,representada_nome text,codigo text,nome text,unidade text,ativo boolean,comissao_representante_percentual numeric,comissao_preposto_percentual numeric,comissao_preposto_especifica boolean,quantidade_minima numeric)
language sql stable security invoker set search_path='' as $$
 select * from private.listar_produtos_quantidade_minima(p_titular_user_id,p_representada_id);
$$;
revoke all on function private.salvar_produto_quantidade_minima(uuid,uuid,uuid,text,text,text,boolean,numeric,numeric),public.salvar_produto_representada_v3(uuid,uuid,uuid,text,text,text,boolean,numeric,numeric),private.listar_produtos_quantidade_minima(uuid,uuid),public.listar_produtos_modulo_v2(uuid,uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.salvar_produto_quantidade_minima(uuid,uuid,uuid,text,text,text,boolean,numeric,numeric),public.salvar_produto_representada_v3(uuid,uuid,uuid,text,text,text,boolean,numeric,numeric),private.listar_produtos_quantidade_minima(uuid,uuid),public.listar_produtos_modulo_v2(uuid,uuid) to authenticated;
