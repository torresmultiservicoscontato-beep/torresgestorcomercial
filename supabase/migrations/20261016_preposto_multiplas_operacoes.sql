alter table public.prepostos
  drop constraint if exists prepostos_user_id_key;

create unique index if not exists prepostos_titular_user_unique_idx
  on public.prepostos(titular_user_id, user_id)
  where user_id is not null;

create or replace function public.vincular_preposto_existente(
  p_titular_user_id uuid,
  p_email text,
  p_nome text,
  p_whatsapp text,
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
  v_user_id uuid;
  v_email text := lower(trim(p_email));
begin
  if not (
    public.usuario_e_admin()
    or (
      auth.uid() = p_titular_user_id
      and exists (
        select 1 from public.perfis pf
        where pf.user_id = auth.uid()
      )
    )
  ) then
    raise exception 'Acesso negado para administrar esta equipe' using errcode = '42501';
  end if;

  select pr.user_id
    into v_user_id
  from public.prepostos pr
  where lower(pr.email) = v_email
    and pr.user_id is not null
  order by pr.created_at
  limit 1;

  if v_user_id is null then
    return;
  end if;

  if exists (
    select 1 from public.perfis pf
    where pf.user_id = v_user_id
  ) then
    raise exception 'Este e-mail pertence a uma conta de representante e não pode ser vinculado como preposto';
  end if;

  if exists (
    select 1 from public.prepostos pr
    where pr.titular_user_id = p_titular_user_id
      and pr.user_id = v_user_id
  ) then
    raise exception 'Este preposto já pertence a esta equipe';
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
    v_user_id,
    trim(p_nome),
    v_email,
    trim(coalesce(p_whatsapp, '')),
    'ativo',
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

revoke all on function public.vincular_preposto_existente(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.vincular_preposto_existente(uuid, text, text, text, jsonb) to authenticated;

revoke all on function public.preposto_tem_permissao(uuid, text, text) from public, anon;
grant execute on function public.preposto_tem_permissao(uuid, text, text) to authenticated;

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
    (select count(distinct coalesce(pr.user_id::text, lower(pr.email))) from public.prepostos pr);
end;
$$;

revoke all on function public.admin_resumo() from public, anon;
grant execute on function public.admin_resumo() to authenticated;
