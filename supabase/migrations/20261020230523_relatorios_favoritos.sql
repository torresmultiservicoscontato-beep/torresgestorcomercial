create table public.relatorios_favoritos (
 id uuid primary key default gen_random_uuid(),
 usuario_id uuid not null references auth.users(id) on delete cascade,
 titular_user_id uuid not null references auth.users(id) on delete cascade,
 contexto_responsavel text not null default '' check(length(contexto_responsavel)<=36),
 nome text not null check(length(btrim(nome)) between 1 and 100),
 configuracao jsonb not null check(jsonb_typeof(configuracao)='object' and configuracao @> '{"versao":1}'::jsonb and octet_length(configuracao::text)<=20000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index relatorios_favoritos_usuario_contexto_idx on public.relatorios_favoritos(usuario_id,titular_user_id,contexto_responsavel);
create index relatorios_favoritos_titular_idx on public.relatorios_favoritos(titular_user_id);
alter table public.relatorios_favoritos enable row level security;
-- Preferências pessoais, nunca resultados ou linhas do relatório. A permissão
-- visualizar permite salvar modelos próprios; não concede acesso a novos dados.
create policy favoritos_proprios on public.relatorios_favoritos for all to authenticated
 using (
 usuario_id=(select auth.uid()) and
 (titular_user_id=(select auth.uid()) or public.usuario_e_admin() or public.preposto_tem_permissao(titular_user_id,'relatorios','visualizar'))
 ) with check (
 usuario_id=(select auth.uid()) and
 (titular_user_id=(select auth.uid()) or public.usuario_e_admin() or public.preposto_tem_permissao(titular_user_id,'relatorios','visualizar'))
 );
revoke all on public.relatorios_favoritos from anon;
grant select,insert,update,delete on public.relatorios_favoritos to authenticated;
