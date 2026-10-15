-- Torres Gestor Comercial
-- Estrutura inicial do banco para Clientes e Visitas.
-- ATENCAO: as politicas abaixo liberam acesso durante o desenvolvimento.
-- Quando o login for implementado, substitua-as por politicas vinculadas ao usuario/empresa.

create table if not exists public.clientes (
  id text primary key,
  nome text not null,
  cidade text not null default '',
  bairro text not null default '',
  representada text not null default 'Não informada',
  telefone text not null default '',
  status text not null default 'Ativo',
  created_at timestamptz not null default now()
);

create table if not exists public.visitas (
  id text primary key,
  cliente_id text not null references public.clientes(id) on delete cascade,
  cliente_nome text not null,
  data date not null,
  resultado text not null default 'Sem venda',
  odometro text not null default '',
  observacao text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists visitas_cliente_id_idx on public.visitas(cliente_id);
create index if not exists visitas_data_idx on public.visitas(data desc);
create index if not exists clientes_nome_idx on public.clientes(nome);

alter table public.clientes enable row level security;
alter table public.visitas enable row level security;

-- Politicas temporarias para a fase de desenvolvimento sem login.
drop policy if exists "dev_clientes_acesso" on public.clientes;
create policy "dev_clientes_acesso"
on public.clientes
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "dev_visitas_acesso" on public.visitas;
create policy "dev_visitas_acesso"
on public.visitas
for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.clientes to anon, authenticated;
grant select, insert, update, delete on public.visitas to anon, authenticated;

insert into public.clientes (id, nome, cidade, bairro, representada, telefone, status)
values
  ('vale-mc', 'Vale Materiais de Construção', 'Guapimirim', 'Curral de Zinco', 'King Ouro', '', 'Visitar hoje'),
  ('pires-mc', 'Pires Materiais de Construção', 'Magé', 'Mauá', 'Argamil', '', 'Em dia'),
  ('vila-olimpia-mc', 'Vila Olímpia MC', 'Guapimirim', 'Vila Olímpia', 'King Ouro', '', 'Próxima visita')
on conflict (id) do nothing;
