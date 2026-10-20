-- Preços antigos permanecem desconhecidos até serem preenchidos.
alter table public.representada_produtos add column preco_venda numeric
 check (preco_venda > 0 and preco_venda <= 999999999.99 and preco_venda=round(preco_venda,2));

create function private.salvar_produto_preco_venda(
 p_titular_user_id uuid,p_representada_id uuid,p_id uuid,p_codigo text,p_nome text,p_unidade text,p_ativo boolean,p_comissao_percentual numeric,p_quantidade_minima numeric,p_preco_venda numeric
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Sessão obrigatória' using errcode='42501';end if;
 if p_preco_venda is null or p_preco_venda<=0 or p_preco_venda>999999999.99 or p_preco_venda<>round(p_preco_venda,2) then
 raise exception 'Informe um preço de venda positivo com até duas casas decimais.' using errcode='23514';end if;
 -- Reutiliza todas as verificações de operação, representada e papel existentes.
 v_id:=public.salvar_produto_representada_v3(p_titular_user_id,p_representada_id,p_id,p_codigo,p_nome,p_unidade,p_ativo,p_comissao_percentual,p_quantidade_minima);
 update public.representada_produtos set preco_venda=p_preco_venda where id=v_id and titular_user_id=p_titular_user_id;
 return v_id;
end;$$;
create function public.salvar_produto_representada_v4(
 p_titular_user_id uuid,p_representada_id uuid,p_id uuid,p_codigo text,p_nome text,p_unidade text,p_ativo boolean,p_comissao_percentual numeric,p_quantidade_minima numeric,p_preco_venda numeric
) returns uuid language sql security invoker set search_path='' as $$
 select private.salvar_produto_preco_venda(p_titular_user_id,p_representada_id,p_id,p_codigo,p_nome,p_unidade,p_ativo,p_comissao_percentual,p_quantidade_minima,p_preco_venda);
$$;
create function private.listar_produtos_preco_venda(p_titular_user_id uuid,p_representada_id uuid default null)
returns table(produto_id uuid,representada_id uuid,representada_nome text,codigo text,nome text,unidade text,ativo boolean,comissao_representante_percentual numeric,comissao_preposto_percentual numeric,comissao_preposto_especifica boolean,quantidade_minima numeric,preco_venda numeric)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sessão obrigatória' using errcode='42501';end if;
 return query select l.*,rp.quantidade_minima,rp.preco_venda
 from public.listar_produtos_modulo(p_titular_user_id,p_representada_id) l
 join public.representada_produtos rp on rp.id=l.produto_id and rp.titular_user_id=p_titular_user_id;
end;$$;
create function public.listar_produtos_modulo_v3(p_titular_user_id uuid,p_representada_id uuid default null)
returns table(produto_id uuid,representada_id uuid,representada_nome text,codigo text,nome text,unidade text,ativo boolean,comissao_representante_percentual numeric,comissao_preposto_percentual numeric,comissao_preposto_especifica boolean,quantidade_minima numeric,preco_venda numeric)
language sql stable security invoker set search_path='' as $$
 select * from private.listar_produtos_preco_venda(p_titular_user_id,p_representada_id);
$$;
revoke all on function private.salvar_produto_preco_venda(uuid,uuid,uuid,text,text,text,boolean,numeric,numeric,numeric),public.salvar_produto_representada_v4(uuid,uuid,uuid,text,text,text,boolean,numeric,numeric,numeric),private.listar_produtos_preco_venda(uuid,uuid),public.listar_produtos_modulo_v3(uuid,uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.salvar_produto_preco_venda(uuid,uuid,uuid,text,text,text,boolean,numeric,numeric,numeric),public.salvar_produto_representada_v4(uuid,uuid,uuid,text,text,text,boolean,numeric,numeric,numeric),private.listar_produtos_preco_venda(uuid,uuid),public.listar_produtos_modulo_v3(uuid,uuid) to authenticated;
