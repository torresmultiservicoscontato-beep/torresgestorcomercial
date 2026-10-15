alter table public.perfis
add column if not exists papel text not null default 'usuario';

alter table public.perfis
drop constraint if exists perfis_papel_check;

alter table public.perfis
add constraint perfis_papel_check check (papel in ('usuario','admin'));

update public.perfis
set papel = 'admin'
where user_id = (select user_id from public.perfis order by created_at asc limit 1)
  and (select count(*) from public.perfis) = 1;

create or replace function public.usuario_e_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.perfis
    where user_id = auth.uid()
      and papel = 'admin'
  );
$$;

revoke all on function public.usuario_e_admin() from public;
grant execute on function public.usuario_e_admin() to authenticated;

create or replace function public.admin_resumo()
returns table (
  usuarios bigint,
  clientes bigint,
  visitas bigint,
  representadas bigint
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
    (select count(*) from auth.users),
    (select count(*) from public.clientes),
    (select count(*) from public.visitas),
    (select count(*) from public.perfil_representadas);
end;
$$;

revoke all on function public.admin_resumo() from public;
grant execute on function public.admin_resumo() to authenticated;

create or replace function public.admin_listar_usuarios()
returns table (
  user_id uuid,
  email text,
  nome text,
  nome_representacao text,
  papel text,
  criado_em timestamptz,
  clientes bigint,
  visitas bigint,
  representadas bigint
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
    coalesce(p.papel, 'usuario'::text),
    u.created_at,
    (select count(*) from public.clientes c where c.user_id = u.id),
    (select count(*) from public.visitas v where v.user_id = u.id),
    (select count(*) from public.perfil_representadas r where r.user_id = u.id)
  from auth.users u
  left join public.perfis p on p.user_id = u.id
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_listar_usuarios() from public;
grant execute on function public.admin_listar_usuarios() to authenticated;
