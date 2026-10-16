create table if not exists public.preposto_perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nome text not null,
  documento_tipo text not null default 'CPF' check (documento_tipo in ('CPF','CNPJ')),
  documento text not null default '',
  whatsapp text not null default '',
  cep text not null default '',
  logradouro text not null default '',
  numero text not null default '',
  complemento text not null default '',
  bairro text not null default '',
  cidade text not null default '',
  uf text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.preposto_perfis enable row level security;
grant select, insert, update on public.preposto_perfis to authenticated;

create policy preposto_perfis_select_self_linked_admin on public.preposto_perfis
for select to authenticated
using (
  user_id = auth.uid()
  or public.usuario_e_admin()
  or exists (
    select 1 from public.prepostos p
    where p.user_id = preposto_perfis.user_id
      and p.titular_user_id = auth.uid()
  )
);

create policy preposto_perfis_insert_self on public.preposto_perfis
for insert to authenticated
with check (user_id = auth.uid());

create policy preposto_perfis_update_self on public.preposto_perfis
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

alter table public.prepostos drop constraint if exists prepostos_status_check;
alter table public.prepostos add constraint prepostos_status_check
  check (status in ('pendente','ativo','inativo','recusado'));

create or replace function public.solicitar_vinculo_preposto(
  p_titular_user_id uuid,
  p_email text,
  p_permissoes jsonb
)
returns table(
  id uuid,
  titular_user_id uuid,
  user_id uuid,
  nome text,
  email text,
  whatsapp text,
  status text,
  permissoes jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_perfil public.preposto_perfis%rowtype;
begin
  if not (
    public.usuario_e_admin()
    or (
      auth.uid() = p_titular_user_id
      and exists (select 1 from public.perfis pf where pf.user_id = auth.uid())
    )
  ) then
    raise exception 'Acesso negado para administrar esta equipe' using errcode = '42501';
  end if;

  select * into v_perfil
  from public.preposto_perfis pp
  where lower(pp.email) = lower(trim(p_email));

  if v_perfil.user_id is null then
    raise exception 'Nenhum preposto cadastrado com este e-mail';
  end if;

  if exists (
    select 1 from public.prepostos p
    where p.titular_user_id = p_titular_user_id
      and p.user_id = v_perfil.user_id
      and p.status in ('pendente','ativo','inativo')
  ) then
    raise exception 'Este preposto já possui vínculo com esta operação';
  end if;

  return query
  insert into public.prepostos (
    titular_user_id,
    user_id,
    nome,
    email,
    whatsapp,
    status,
    permissoes
  ) values (
    p_titular_user_id,
    v_perfil.user_id,
    v_perfil.nome,
    lower(v_perfil.email),
    v_perfil.whatsapp,
    'pendente',
    p_permissoes
  )
  returning
    prepostos.id,
    prepostos.titular_user_id,
    prepostos.user_id,
    prepostos.nome,
    prepostos.email,
    prepostos.whatsapp,
    prepostos.status,
    prepostos.permissoes,
    prepostos.created_at,
    prepostos.updated_at;
end;
$$;

revoke all on function public.solicitar_vinculo_preposto(uuid,text,jsonb) from public, anon;
grant execute on function public.solicitar_vinculo_preposto(uuid,text,jsonb) to authenticated;

create or replace function public.responder_vinculo_preposto(p_vinculo_id uuid, p_aceitar boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.prepostos
  set status = case when p_aceitar then 'ativo' else 'recusado' end,
      updated_at = now()
  where id = p_vinculo_id
    and user_id = auth.uid()
    and status = 'pendente';

  if not found then
    raise exception 'Convite pendente não encontrado';
  end if;
end;
$$;

revoke all on function public.responder_vinculo_preposto(uuid,boolean) from public, anon;
grant execute on function public.responder_vinculo_preposto(uuid,boolean) to authenticated;

drop policy if exists perfis_sem_promocao_de_preposto on public.perfis;
create policy perfis_sem_promocao_de_preposto
on public.perfis
as restrictive
for insert
to authenticated
with check (
  not exists (select 1 from public.preposto_perfis pp where pp.user_id = auth.uid())
);

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

revoke all on function public.preposto_tem_permissao(uuid,text,text) from public, anon;
grant execute on function public.preposto_tem_permissao(uuid,text,text) to authenticated;

create or replace function public.listar_vinculos_preposto_atual()
returns table(
  id uuid,
  titular_user_id uuid,
  nome_representante text,
  nome_representacao text,
  status text,
  permissoes jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.id, p.titular_user_id, pf.nome, pf.nome_representacao, p.status, p.permissoes, p.created_at
  from public.prepostos p
  join public.perfis pf on pf.user_id = p.titular_user_id
  where p.user_id = auth.uid()
  order by p.created_at desc;
$$;

revoke all on function public.listar_vinculos_preposto_atual() from public, anon;
grant execute on function public.listar_vinculos_preposto_atual() to authenticated;
