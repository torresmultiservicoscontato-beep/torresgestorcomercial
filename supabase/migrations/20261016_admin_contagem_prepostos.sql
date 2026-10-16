drop function if exists public.admin_resumo();
create function public.admin_resumo()
returns table(usuarios bigint, clientes bigint, visitas bigint, representadas bigint, prepostos bigint)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.usuario_e_admin() then
    raise exception 'Acesso administrativo negado' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.perfis),
    (select count(*) from public.clientes),
    (select count(*) from public.visitas),
    (select count(*) from public.perfil_representadas),
    (select count(*) from public.prepostos);
end;
$$;

revoke all on function public.admin_resumo() from public, anon;
grant execute on function public.admin_resumo() to authenticated;

drop function if exists public.admin_listar_usuarios();
create function public.admin_listar_usuarios()
returns table(
  user_id uuid,
  email text,
  nome text,
  nome_representacao text,
  papel text,
  criado_em timestamptz,
  clientes bigint,
  visitas bigint,
  representadas bigint,
  prepostos bigint
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.usuario_e_admin() then
    raise exception 'Acesso administrativo negado' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    u.email::text,
    p.nome,
    p.nome_representacao,
    p.papel,
    u.created_at,
    (select count(*) from public.clientes c where c.user_id = u.id),
    (select count(*) from public.visitas v where v.user_id = u.id),
    (select count(*) from public.perfil_representadas r where r.user_id = u.id),
    (select count(*) from public.prepostos pr where pr.titular_user_id = u.id)
  from public.perfis p
  join auth.users u on u.id = p.user_id
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_listar_usuarios() from public, anon;
grant execute on function public.admin_listar_usuarios() to authenticated;
