-- Torres Gestor Comercial
-- Estrutura inicial segura do banco para Clientes e Visitas.
-- O acesso remoto exige usuario autenticado no Supabase Auth.

create table if not exists public.clientes (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  cidade text not null default '',
  bairro text not null default '',
  representada text not null default 'Não informada',
  telefone text not null default '',
  status text not null default 'Ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.visitas (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id text not null,
  cliente_nome text not null,
  data date not null,
  resultado text not null default 'Sem venda',
  odometro text not null default '',
  observacao text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visitas_cliente_usuario_fk foreign key (cliente_id, user_id)
    references public.clientes(id, user_id) on delete cascade
);

create index if not exists clientes_user_id_idx on public.clientes(user_id);
create index if not exists clientes_nome_idx on public.clientes(nome);
create index if not exists visitas_user_id_idx on public.visitas(user_id);
create index if not exists visitas_cliente_id_idx on public.visitas(cliente_id);
create index if not exists visitas_cliente_usuario_idx on public.visitas(cliente_id, user_id);
create index if not exists visitas_data_idx on public.visitas(data desc);

alter table public.clientes enable row level security;
alter table public.visitas enable row level security;

revoke all on public.clientes from anon;
revoke all on public.visitas from anon;
grant select, insert, update, delete on public.clientes to authenticated;
grant select, insert, update, delete on public.visitas to authenticated;

drop policy if exists "clientes_select_own" on public.clientes;
create policy "clientes_select_own"
on public.clientes for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "clientes_insert_own" on public.clientes;
create policy "clientes_insert_own"
on public.clientes for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "clientes_update_own" on public.clientes;
create policy "clientes_update_own"
on public.clientes for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "clientes_delete_own" on public.clientes;
create policy "clientes_delete_own"
on public.clientes for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "visitas_select_own" on public.visitas;
create policy "visitas_select_own"
on public.visitas for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "visitas_insert_own" on public.visitas;
create policy "visitas_insert_own"
on public.visitas for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "visitas_update_own" on public.visitas;
create policy "visitas_update_own"
on public.visitas for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "visitas_delete_own" on public.visitas;
create policy "visitas_delete_own"
on public.visitas for delete to authenticated
using ((select auth.uid()) = user_id);
