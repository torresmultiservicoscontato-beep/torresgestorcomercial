create or replace function public.validar_exclusividade_representada_equipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titular uuid;
begin
  if new.status not in ('pendente','ativo') then
    return new;
  end if;

  select p.titular_user_id into v_titular
  from public.prepostos p
  where p.id = new.vinculo_id;

  if v_titular is null then
    raise exception 'Vínculo do preposto não encontrado';
  end if;

  if exists (
    select 1
    from public.preposto_representadas outro
    join public.prepostos p2 on p2.id = outro.vinculo_id
    where p2.titular_user_id = v_titular
      and outro.representada_id = new.representada_id
      and outro.status in ('pendente','ativo')
      and outro.id <> new.id
  ) then
    raise exception 'Esta representada já está atribuída a outro preposto desta operação';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_preposto_representada_exclusiva_equipe on public.preposto_representadas;
create trigger trg_preposto_representada_exclusiva_equipe
before insert or update of vinculo_id, representada_id, status
on public.preposto_representadas
for each row execute function public.validar_exclusividade_representada_equipe();

create or replace function public.listar_representadas_para_preposto(
  p_titular_user_id uuid,
  p_email text,
  p_vinculo_id uuid default null
)
returns table(representada_id uuid, nome text, cnpj text, disponivel boolean)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_preposto_user_id uuid;
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

  select pp.user_id into v_preposto_user_id
  from public.preposto_perfis pp
  where lower(pp.email) = lower(trim(p_email));

  if v_preposto_user_id is null then
    raise exception 'Nenhum preposto cadastrado com este e-mail';
  end if;

  return query
  select
    rc.id,
    pr.nome,
    rc.cnpj,
    (
      not exists (
        select 1
        from public.preposto_representadas ppr
        where ppr.preposto_user_id = v_preposto_user_id
          and ppr.representada_id = rc.id
          and ppr.status in ('pendente','ativo')
          and (p_vinculo_id is null or ppr.vinculo_id <> p_vinculo_id)
      )
      and not exists (
        select 1
        from public.preposto_representadas ppr2
        join public.prepostos p2 on p2.id = ppr2.vinculo_id
        where p2.titular_user_id = p_titular_user_id
          and ppr2.representada_id = rc.id
          and ppr2.status in ('pendente','ativo')
          and (p_vinculo_id is null or ppr2.vinculo_id <> p_vinculo_id)
      )
    ) as disponivel
  from public.perfil_representadas pr
  join public.representadas_catalogo rc on rc.id = pr.representada_id
  where pr.user_id = p_titular_user_id
  order by pr.nome;
end;
$$;

create or replace function public.solicitar_vinculo_preposto(
  p_titular_user_id uuid,
  p_email text,
  p_permissoes jsonb,
  p_representadas uuid[]
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
  v_vinculo public.prepostos%rowtype;
  v_total_selecionadas integer;
  v_total_validas integer;
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

  if p_representadas is null or cardinality(p_representadas) = 0 then
    raise exception 'Selecione pelo menos uma representada para o preposto';
  end if;

  select count(distinct x) into v_total_selecionadas from unnest(p_representadas) x;
  select count(distinct pr.representada_id) into v_total_validas
  from public.perfil_representadas pr
  where pr.user_id = p_titular_user_id
    and pr.representada_id = any(p_representadas);

  if v_total_validas <> v_total_selecionadas then
    raise exception 'Uma ou mais representadas selecionadas não pertencem a este representante';
  end if;

  if exists (
    select 1 from public.prepostos p
    where p.titular_user_id = p_titular_user_id
      and p.user_id = v_perfil.user_id
      and p.status in ('pendente','ativo','inativo')
  ) then
    raise exception 'Este preposto já possui vínculo com esta operação';
  end if;

  if exists (
    select 1
    from public.preposto_representadas ppr
    where ppr.preposto_user_id = v_perfil.user_id
      and ppr.representada_id = any(p_representadas)
      and ppr.status in ('pendente','ativo')
  ) then
    raise exception 'Uma ou mais representadas já estão vinculadas a este preposto em outra operação';
  end if;

  if exists (
    select 1
    from public.preposto_representadas ppr
    join public.prepostos p on p.id = ppr.vinculo_id
    where p.titular_user_id = p_titular_user_id
      and ppr.representada_id = any(p_representadas)
      and ppr.status in ('pendente','ativo')
  ) then
    raise exception 'Uma ou mais representadas já estão atribuídas a outro preposto desta operação';
  end if;

  delete from public.prepostos
  where titular_user_id = p_titular_user_id
    and user_id = v_perfil.user_id
    and status = 'recusado';

  insert into public.prepostos (
    titular_user_id,user_id,nome,email,whatsapp,status,permissoes
  ) values (
    p_titular_user_id,v_perfil.user_id,v_perfil.nome,lower(v_perfil.email),v_perfil.whatsapp,'pendente',p_permissoes
  ) returning * into v_vinculo;

  insert into public.preposto_representadas(vinculo_id,preposto_user_id,representada_id,status)
  select v_vinculo.id,v_perfil.user_id,x,'pendente'
  from (select distinct unnest(p_representadas) as x) selecionadas;

  return query
  select v_vinculo.id,v_vinculo.titular_user_id,v_vinculo.user_id,v_vinculo.nome,v_vinculo.email,
         v_vinculo.whatsapp,v_vinculo.status,v_vinculo.permissoes,v_vinculo.created_at,v_vinculo.updated_at;
end;
$$;

create or replace function public.atualizar_vinculo_preposto(
  p_vinculo_id uuid,
  p_status text,
  p_permissoes jsonb,
  p_representadas uuid[]
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
  v_vinculo public.prepostos%rowtype;
  v_status_destino text;
  v_total_selecionadas integer;
  v_total_validas integer;
begin
  select p.* into v_vinculo from public.prepostos p where p.id = p_vinculo_id;
  if v_vinculo.id is null then raise exception 'Vínculo não encontrado'; end if;

  if not (
    public.usuario_e_admin()
    or (
      auth.uid() = v_vinculo.titular_user_id
      and exists (select 1 from public.perfis pf where pf.user_id = auth.uid())
    )
  ) then
    raise exception 'Acesso negado para administrar este vínculo' using errcode = '42501';
  end if;

  if v_vinculo.status = 'pendente' then
    v_status_destino := 'pendente';
  elsif p_status in ('ativo','inativo') then
    v_status_destino := p_status;
  else
    raise exception 'Status de vínculo inválido';
  end if;

  if p_representadas is null or cardinality(p_representadas) = 0 then
    raise exception 'Selecione pelo menos uma representada para o preposto';
  end if;

  select count(distinct x) into v_total_selecionadas from unnest(p_representadas) x;
  select count(distinct pr.representada_id) into v_total_validas
  from public.perfil_representadas pr
  where pr.user_id = v_vinculo.titular_user_id
    and pr.representada_id = any(p_representadas);

  if v_total_validas <> v_total_selecionadas then
    raise exception 'Uma ou mais representadas selecionadas não pertencem a este representante';
  end if;

  if v_status_destino in ('pendente','ativo') and exists (
    select 1
    from public.preposto_representadas ppr
    where ppr.preposto_user_id = v_vinculo.user_id
      and ppr.representada_id = any(p_representadas)
      and ppr.status in ('pendente','ativo')
      and ppr.vinculo_id <> v_vinculo.id
  ) then
    raise exception 'Uma ou mais representadas já estão vinculadas a este preposto em outra operação';
  end if;

  if v_status_destino in ('pendente','ativo') and exists (
    select 1
    from public.preposto_representadas ppr
    join public.prepostos p2 on p2.id = ppr.vinculo_id
    where p2.titular_user_id = v_vinculo.titular_user_id
      and ppr.representada_id = any(p_representadas)
      and ppr.status in ('pendente','ativo')
      and ppr.vinculo_id <> v_vinculo.id
  ) then
    raise exception 'Uma ou mais representadas já estão atribuídas a outro preposto desta operação';
  end if;

  delete from public.preposto_representadas ppr where ppr.vinculo_id = v_vinculo.id;

  insert into public.preposto_representadas(vinculo_id,preposto_user_id,representada_id,status)
  select v_vinculo.id,v_vinculo.user_id,x,v_status_destino
  from (select distinct unnest(p_representadas) as x) selecionadas;

  update public.prepostos p
  set status = v_status_destino, permissoes = p_permissoes, updated_at = now()
  where p.id = v_vinculo.id
  returning p.* into v_vinculo;

  return query
  select v_vinculo.id,v_vinculo.titular_user_id,v_vinculo.user_id,v_vinculo.nome,v_vinculo.email,
         v_vinculo.whatsapp,v_vinculo.status,v_vinculo.permissoes,v_vinculo.created_at,v_vinculo.updated_at;
end;
$$;

revoke all on function public.validar_exclusividade_representada_equipe() from public, anon;
revoke all on function public.listar_representadas_para_preposto(uuid,text,uuid) from public, anon;
revoke all on function public.solicitar_vinculo_preposto(uuid,text,jsonb,uuid[]) from public, anon;
revoke all on function public.atualizar_vinculo_preposto(uuid,text,jsonb,uuid[]) from public, anon;
grant execute on function public.listar_representadas_para_preposto(uuid,text,uuid) to authenticated;
grant execute on function public.solicitar_vinculo_preposto(uuid,text,jsonb,uuid[]) to authenticated;
grant execute on function public.atualizar_vinculo_preposto(uuid,text,jsonb,uuid[]) to authenticated;
