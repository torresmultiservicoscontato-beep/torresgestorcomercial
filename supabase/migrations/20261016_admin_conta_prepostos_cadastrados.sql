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
    (select count(*) from public.preposto_perfis);
end;
$$;

revoke all on function public.admin_resumo() from public, anon;
grant execute on function public.admin_resumo() to authenticated;
