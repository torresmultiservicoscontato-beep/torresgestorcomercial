create table if not exists public.prepostos (
  id uuid primary key default gen_random_uuid(),
  titular_user_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  whatsapp text not null default '',
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  permissoes jsonb not null default jsonb_build_object(
    'clientes', jsonb_build_object('visualizar', true, 'cadastrar', true, 'editar', true),
    'rotas', jsonb_build_object('visualizar', true, 'cadastrar', true, 'editar', true),
    'visitas', jsonb_build_object('visualizar', true, 'cadastrar', true, 'editar', true),
    'vendas', jsonb_build_object('visualizar', true, 'cadastrar', true, 'editar', true),
    'agenda', jsonb_build_object('visualizar', true, 'cadastrar', true, 'editar', true),
    'relatorios', jsonb_build_object('visualizar', true, 'cadastrar', false, 'editar', false)
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (titular_user_id, email)
);

alter table public.prepostos enable row level security;
grant select, insert, update, delete on public.prepostos to authenticated;

create or replace function public.preposto_tem_permissao(p_titular_user_id uuid, p_modulo text, p_acao text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.prepostos p
    where p.user_id = auth.uid()
      and p.titular_user_id = p_titular_user_id
      and p.status = 'ativo'
      and coalesce((p.permissoes -> p_modulo ->> p_acao)::boolean, false)
  );
$$;

grant execute on function public.preposto_tem_permissao(uuid, text, text) to authenticated;

create policy prepostos_select_owner_self_admin on public.prepostos
for select to authenticated
using (titular_user_id = auth.uid() or user_id = auth.uid() or public.usuario_e_admin());

create policy prepostos_insert_owner_admin on public.prepostos
for insert to authenticated
with check (titular_user_id = auth.uid() or public.usuario_e_admin());

create policy prepostos_update_owner_admin on public.prepostos
for update to authenticated
using (titular_user_id = auth.uid() or public.usuario_e_admin())
with check (titular_user_id = auth.uid() or public.usuario_e_admin());

create policy prepostos_delete_owner_admin on public.prepostos
for delete to authenticated
using (titular_user_id = auth.uid() or public.usuario_e_admin());

create policy perfis_select_preposto_titular on public.perfis
for select to authenticated
using (
  exists (
    select 1 from public.prepostos p
    where p.user_id = auth.uid()
      and p.titular_user_id = perfis.user_id
      and p.status = 'ativo'
  )
);

create policy perfil_representadas_select_preposto_titular on public.perfil_representadas
for select to authenticated
using (
  exists (
    select 1 from public.prepostos p
    where p.user_id = auth.uid()
      and p.titular_user_id = perfil_representadas.user_id
      and p.status = 'ativo'
  )
);

alter table public.clientes
  add column if not exists criado_por_user_id uuid references auth.users(id) on delete set null,
  add column if not exists responsavel_user_id uuid references auth.users(id) on delete set null;

update public.clientes
set criado_por_user_id = user_id,
    responsavel_user_id = user_id
where criado_por_user_id is null or responsavel_user_id is null;

alter table public.visitas
  add column if not exists criado_por_user_id uuid references auth.users(id) on delete set null,
  add column if not exists responsavel_user_id uuid references auth.users(id) on delete set null;

update public.visitas
set criado_por_user_id = user_id,
    responsavel_user_id = user_id
where criado_por_user_id is null or responsavel_user_id is null;

create policy clientes_preposto_select on public.clientes
for select to authenticated
using (public.preposto_tem_permissao(user_id, 'clientes', 'visualizar'));

create policy clientes_preposto_insert on public.clientes
for insert to authenticated
with check (public.preposto_tem_permissao(user_id, 'clientes', 'cadastrar'));

create policy clientes_preposto_update on public.clientes
for update to authenticated
using (public.preposto_tem_permissao(user_id, 'clientes', 'editar'))
with check (public.preposto_tem_permissao(user_id, 'clientes', 'editar'));

create policy visitas_preposto_select on public.visitas
for select to authenticated
using (public.preposto_tem_permissao(user_id, 'visitas', 'visualizar'));

create policy visitas_preposto_insert on public.visitas
for insert to authenticated
with check (public.preposto_tem_permissao(user_id, 'visitas', 'cadastrar'));

create policy visitas_preposto_update on public.visitas
for update to authenticated
using (public.preposto_tem_permissao(user_id, 'visitas', 'editar'))
with check (public.preposto_tem_permissao(user_id, 'visitas', 'editar'));

create index if not exists prepostos_titular_idx on public.prepostos(titular_user_id);
create index if not exists prepostos_user_idx on public.prepostos(user_id);
create index if not exists clientes_responsavel_idx on public.clientes(responsavel_user_id);
create index if not exists visitas_responsavel_idx on public.visitas(responsavel_user_id);

create or replace function public.admin_resumo()
returns table(usuarios bigint, clientes bigint, visitas bigint, representadas bigint)
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
    (select count(*) from public.perfil_representadas);
end;
$$;

create or replace function public.admin_listar_usuarios()
returns table(
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
    p.papel,
    u.created_at,
    (select count(*) from public.clientes c where c.user_id = u.id),
    (select count(*) from public.visitas v where v.user_id = u.id),
    (select count(*) from public.perfil_representadas r where r.user_id = u.id)
  from public.perfis p
  join auth.users u on u.id = p.user_id
  order by u.created_at desc;
end;
$$;
