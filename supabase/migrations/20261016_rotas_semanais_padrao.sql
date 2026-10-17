create table if not exists public.rotas_semanais (
  id uuid primary key default gen_random_uuid(),
  titular_user_id uuid not null references auth.users(id) on delete cascade,
  responsavel_user_id uuid not null references auth.users(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 1 and 7),
  municipio text not null default '',
  bairros text[] not null default '{}',
  observacao text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (titular_user_id, responsavel_user_id, dia_semana)
);

create table if not exists public.rota_representadas (
  rota_id uuid not null references public.rotas_semanais(id) on delete cascade,
  representada_id uuid not null references public.representadas_catalogo(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (rota_id, representada_id)
);

create index if not exists rotas_semanais_responsavel_idx
  on public.rotas_semanais(titular_user_id, responsavel_user_id, dia_semana);

alter table public.rotas_semanais enable row level security;
alter table public.rota_representadas enable row level security;

revoke all on public.rotas_semanais from anon;
revoke all on public.rota_representadas from anon;
revoke insert, update, delete on public.rotas_semanais from authenticated;
revoke insert, update, delete on public.rota_representadas from authenticated;

create or replace function public.pode_acessar_rota_operacional(
  p_titular_user_id uuid,
  p_responsavel_user_id uuid,
  p_acao text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then return false; end if;
  if public.usuario_e_admin() then return true; end if;

  if auth.uid() = p_titular_user_id
     and exists (select 1 from public.perfis p where p.user_id = auth.uid()) then
    return true;
  end if;

  if auth.uid() = p_responsavel_user_id
     and exists (
       select 1
       from public.prepostos p
       where p.titular_user_id = p_titular_user_id
         and p.user_id = auth.uid()
         and p.status = 'ativo'
     )
     and public.preposto_tem_permissao(p_titular_user_id, 'rotas', p_acao) then
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.pode_acessar_rota_operacional(uuid,uuid,text) from public, anon;
grant execute on function public.pode_acessar_rota_operacional(uuid,uuid,text) to authenticated;

create or replace function public.listar_rotas_semanais(
  p_titular_user_id uuid,
  p_responsavel_user_id uuid
)
returns table(
  id uuid,
  dia_semana smallint,
  municipio text,
  bairros text[],
  observacao text,
  representada_ids uuid[],
  representada_nomes text[],
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.pode_acessar_rota_operacional(p_titular_user_id, p_responsavel_user_id, 'visualizar') then
    raise exception 'Você não possui permissão para visualizar estas rotas' using errcode = '42501';
  end if;

  return query
  select
    r.id,
    r.dia_semana,
    r.municipio,
    r.bairros,
    r.observacao,
    coalesce(array_agg(rr.representada_id order by rc.nome) filter (where rr.representada_id is not null), '{}'::uuid[]) as representada_ids,
    coalesce(array_agg(rc.nome order by rc.nome) filter (where rr.representada_id is not null), '{}'::text[]) as representada_nomes,
    r.updated_at
  from public.rotas_semanais r
  left join public.rota_representadas rr on rr.rota_id = r.id
  left join public.representadas_catalogo rc on rc.id = rr.representada_id
  where r.titular_user_id = p_titular_user_id
    and r.responsavel_user_id = p_responsavel_user_id
  group by r.id, r.dia_semana, r.municipio, r.bairros, r.observacao, r.updated_at
  order by r.dia_semana;
end;
$$;

revoke all on function public.listar_rotas_semanais(uuid,uuid) from public, anon;
grant execute on function public.listar_rotas_semanais(uuid,uuid) to authenticated;

create or replace function public.salvar_rota_semanal(
  p_titular_user_id uuid,
  p_responsavel_user_id uuid,
  p_dia_semana smallint,
  p_municipio text,
  p_bairros text[],
  p_observacao text,
  p_representadas uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_rota_id uuid;
  v_existe boolean;
  v_acao text;
begin
  if p_dia_semana < 1 or p_dia_semana > 7 then
    raise exception 'Dia da semana inválido';
  end if;

  select exists(
    select 1 from public.rotas_semanais r
    where r.titular_user_id = p_titular_user_id
      and r.responsavel_user_id = p_responsavel_user_id
      and r.dia_semana = p_dia_semana
  ) into v_existe;

  v_acao := case when v_existe then 'editar' else 'cadastrar' end;

  if not public.pode_acessar_rota_operacional(p_titular_user_id, p_responsavel_user_id, v_acao) then
    raise exception 'Você não possui permissão para salvar esta rota' using errcode = '42501';
  end if;

  if coalesce(trim(p_municipio), '') = ''
     and coalesce(cardinality(p_bairros), 0) = 0 then
    raise exception 'Informe pelo menos um município ou bairro/região para a rota';
  end if;

  if p_representadas is null or cardinality(p_representadas) = 0 then
    raise exception 'Selecione pelo menos uma representada para a rota';
  end if;

  if not public.representadas_validas_para_responsavel(p_titular_user_id, p_responsavel_user_id, p_representadas) then
    raise exception 'Uma ou mais representadas não estão disponíveis para este responsável';
  end if;

  insert into public.rotas_semanais(
    titular_user_id, responsavel_user_id, dia_semana, municipio, bairros, observacao
  ) values (
    p_titular_user_id,
    p_responsavel_user_id,
    p_dia_semana,
    trim(coalesce(p_municipio, '')),
    coalesce((select array_agg(distinct trim(x)) filter (where trim(x) <> '') from unnest(coalesce(p_bairros, '{}'::text[])) x), '{}'::text[]),
    trim(coalesce(p_observacao, ''))
  )
  on conflict (titular_user_id, responsavel_user_id, dia_semana)
  do update set
    municipio = excluded.municipio,
    bairros = excluded.bairros,
    observacao = excluded.observacao,
    updated_at = now()
  returning id into v_rota_id;

  delete from public.rota_representadas rr where rr.rota_id = v_rota_id;
  insert into public.rota_representadas(rota_id, representada_id)
  select v_rota_id, x
  from (select distinct unnest(p_representadas) as x) selecionadas;

  return v_rota_id;
end;
$$;

revoke all on function public.salvar_rota_semanal(uuid,uuid,smallint,text,text[],text,uuid[]) from public, anon;
grant execute on function public.salvar_rota_semanal(uuid,uuid,smallint,text,text[],text,uuid[]) to authenticated;

create policy rotas_semanais_select
on public.rotas_semanais
for select
to authenticated
using (public.pode_acessar_rota_operacional(titular_user_id, responsavel_user_id, 'visualizar'));

create policy rota_representadas_select
on public.rota_representadas
for select
to authenticated
using (
  exists (
    select 1 from public.rotas_semanais r
    where r.id = rota_representadas.rota_id
      and public.pode_acessar_rota_operacional(r.titular_user_id, r.responsavel_user_id, 'visualizar')
  )
);
