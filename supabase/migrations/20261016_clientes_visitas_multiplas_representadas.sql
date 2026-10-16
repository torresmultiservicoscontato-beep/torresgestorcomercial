create table if not exists public.cliente_representadas (
  cliente_id text not null references public.clientes(id) on delete cascade,
  representada_id uuid not null references public.representadas_catalogo(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (cliente_id, representada_id)
);

create index if not exists cliente_representadas_representada_idx
  on public.cliente_representadas(representada_id);

create table if not exists public.visita_representadas (
  visita_id text not null references public.visitas(id) on delete cascade,
  representada_id uuid not null references public.representadas_catalogo(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (visita_id, representada_id)
);

create index if not exists visita_representadas_representada_idx
  on public.visita_representadas(representada_id);

insert into public.cliente_representadas(cliente_id, representada_id)
select c.id, c.representada_id
from public.clientes c
where c.representada_id is not null
on conflict do nothing;

insert into public.visita_representadas(visita_id, representada_id)
select v.id, v.representada_id
from public.visitas v
where v.representada_id is not null
on conflict do nothing;

alter table public.cliente_representadas enable row level security;
alter table public.visita_representadas enable row level security;

revoke all on public.cliente_representadas from anon;
revoke all on public.visita_representadas from anon;
revoke insert, update, delete on public.cliente_representadas from authenticated;
revoke insert, update, delete on public.visita_representadas from authenticated;
grant select on public.cliente_representadas to authenticated;
grant select on public.visita_representadas to authenticated;

drop policy if exists cliente_representadas_select on public.cliente_representadas;
create policy cliente_representadas_select
on public.cliente_representadas
for select
to authenticated
using (
  public.usuario_e_admin()
  or exists (
    select 1 from public.clientes c
    where c.id = cliente_representadas.cliente_id
      and c.user_id = auth.uid()
  )
  or exists (
    select 1 from public.clientes c
    where c.id = cliente_representadas.cliente_id
      and c.responsavel_user_id = auth.uid()
      and public.preposto_tem_permissao(c.user_id, 'clientes', 'visualizar')
      and public.preposto_tem_representada(c.user_id, cliente_representadas.representada_id)
  )
);

drop policy if exists visita_representadas_select on public.visita_representadas;
create policy visita_representadas_select
on public.visita_representadas
for select
to authenticated
using (
  public.usuario_e_admin()
  or exists (
    select 1 from public.visitas v
    where v.id = visita_representadas.visita_id
      and v.user_id = auth.uid()
  )
  or exists (
    select 1 from public.visitas v
    where v.id = visita_representadas.visita_id
      and v.responsavel_user_id = auth.uid()
      and public.preposto_tem_permissao(v.user_id, 'visitas', 'visualizar')
      and public.preposto_tem_representada(v.user_id, visita_representadas.representada_id)
  )
);

create or replace function public.representadas_validas_para_responsavel(
  p_titular_user_id uuid,
  p_responsavel_user_id uuid,
  p_representadas uuid[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_total integer;
  v_validas integer;
begin
  if p_titular_user_id is null
     or p_responsavel_user_id is null
     or p_representadas is null
     or cardinality(p_representadas) = 0 then
    return false;
  end if;

  select count(distinct x) into v_total from unnest(p_representadas) x;

  select count(distinct pr.representada_id) into v_validas
  from public.perfil_representadas pr
  where pr.user_id = p_titular_user_id
    and pr.representada_id = any(p_representadas);

  if v_validas <> v_total then return false; end if;
  if p_responsavel_user_id = p_titular_user_id then return true; end if;

  select count(distinct ppr.representada_id) into v_validas
  from public.prepostos p
  join public.preposto_representadas ppr on ppr.vinculo_id = p.id
  where p.titular_user_id = p_titular_user_id
    and p.user_id = p_responsavel_user_id
    and p.status = 'ativo'
    and ppr.status = 'ativo'
    and ppr.representada_id = any(p_representadas);

  return v_validas = v_total;
end;
$$;

revoke all on function public.representadas_validas_para_responsavel(uuid,uuid,uuid[]) from public, anon, authenticated;

create or replace function public.listar_representadas_operacionais(
  p_titular_user_id uuid,
  p_responsavel_user_id uuid
)
returns table(representada_id uuid, nome text)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if public.usuario_e_admin() then
    null;
  elsif auth.uid() = p_titular_user_id
        and exists (select 1 from public.perfis pf where pf.user_id = auth.uid()) then
    null;
  elsif auth.uid() = p_responsavel_user_id
        and exists (
          select 1 from public.prepostos p
          where p.titular_user_id = p_titular_user_id
            and p.user_id = auth.uid()
            and p.status = 'ativo'
        ) then
    null;
  else
    raise exception 'Acesso negado às representadas desta operação' using errcode = '42501';
  end if;

  if p_responsavel_user_id = p_titular_user_id then
    return query
    select pr.representada_id, pr.nome
    from public.perfil_representadas pr
    where pr.user_id = p_titular_user_id
      and pr.representada_id is not null
    order by pr.nome;
  else
    return query
    select distinct pr.representada_id, pr.nome
    from public.prepostos p
    join public.preposto_representadas ppr on ppr.vinculo_id = p.id
    join public.perfil_representadas pr
      on pr.user_id = p.titular_user_id
     and pr.representada_id = ppr.representada_id
    where p.titular_user_id = p_titular_user_id
      and p.user_id = p_responsavel_user_id
      and p.status = 'ativo'
      and ppr.status = 'ativo'
    order by pr.nome;
  end if;
end;
$$;

revoke all on function public.listar_representadas_operacionais(uuid,uuid) from public, anon;
grant execute on function public.listar_representadas_operacionais(uuid,uuid) to authenticated;

create or replace function public.salvar_cliente_multirepresentada(
  p_id text,
  p_titular_user_id uuid,
  p_responsavel_user_id uuid,
  p_nome text,
  p_cidade text,
  p_bairro text,
  p_telefone text,
  p_status text,
  p_representadas uuid[]
)
returns table(
  id text,
  nome text,
  cidade text,
  bairro text,
  representada text,
  telefone text,
  status text,
  responsavel_user_id uuid,
  representada_id uuid
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_existente public.clientes%rowtype;
  v_salvo public.clientes%rowtype;
  v_responsavel uuid;
  v_primeira uuid;
  v_nome_representada text;
  v_acao text;
begin
  if auth.uid() is null then raise exception 'Sessão inválida' using errcode = '42501'; end if;
  if p_representadas is null or cardinality(p_representadas) = 0 then raise exception 'Selecione pelo menos uma representada para o cliente'; end if;

  select c.* into v_existente from public.clientes c where c.id = p_id;

  if v_existente.id is null then
    v_responsavel := p_responsavel_user_id;
    v_acao := 'cadastrar';
  else
    if v_existente.user_id <> p_titular_user_id then raise exception 'Cliente não pertence a esta operação' using errcode = '42501'; end if;
    v_responsavel := coalesce(v_existente.responsavel_user_id, v_existente.user_id);
    v_acao := 'editar';
  end if;

  if not public.representadas_validas_para_responsavel(p_titular_user_id, v_responsavel, p_representadas) then
    raise exception 'Uma ou mais representadas não estão disponíveis para este responsável';
  end if;

  if public.usuario_e_admin() then
    null;
  elsif auth.uid() = p_titular_user_id and exists (select 1 from public.perfis pf where pf.user_id = auth.uid()) then
    null;
  elsif auth.uid() = v_responsavel and public.preposto_tem_permissao(p_titular_user_id, 'clientes', v_acao) then
    null;
  else
    raise exception 'Você não possui permissão para salvar este cliente' using errcode = '42501';
  end if;

  v_primeira := p_representadas[1];
  select pr.nome into v_nome_representada
  from public.perfil_representadas pr
  where pr.user_id = p_titular_user_id and pr.representada_id = v_primeira
  limit 1;

  if v_nome_representada is null then raise exception 'Representada principal inválida'; end if;

  if v_existente.id is null then
    insert into public.clientes(
      id,user_id,criado_por_user_id,responsavel_user_id,nome,cidade,bairro,representada,representada_id,telefone,status
    ) values (
      p_id,p_titular_user_id,auth.uid(),v_responsavel,trim(p_nome),trim(coalesce(p_cidade,'')),trim(coalesce(p_bairro,'')),
      v_nome_representada,v_primeira,trim(coalesce(p_telefone,'')),p_status
    ) returning * into v_salvo;
  else
    update public.clientes c
    set nome=trim(p_nome),cidade=trim(coalesce(p_cidade,'')),bairro=trim(coalesce(p_bairro,'')),
        representada=v_nome_representada,representada_id=v_primeira,telefone=trim(coalesce(p_telefone,'')),
        status=p_status,updated_at=now()
    where c.id=p_id
    returning c.* into v_salvo;
  end if;

  delete from public.cliente_representadas cr where cr.cliente_id=p_id;
  insert into public.cliente_representadas(cliente_id,representada_id)
  select p_id,x from (select distinct unnest(p_representadas) as x) selecionadas;

  return query
  select v_salvo.id,v_salvo.nome,v_salvo.cidade,v_salvo.bairro,v_salvo.representada,
         v_salvo.telefone,v_salvo.status,v_salvo.responsavel_user_id,v_salvo.representada_id;
end;
$$;

revoke all on function public.salvar_cliente_multirepresentada(text,uuid,uuid,text,text,text,text,text,uuid[]) from public, anon;
grant execute on function public.salvar_cliente_multirepresentada(text,uuid,uuid,text,text,text,text,text,uuid[]) to authenticated;

create or replace function public.salvar_visita_multirepresentada(
  p_id text,
  p_titular_user_id uuid,
  p_responsavel_user_id uuid,
  p_cliente_id text,
  p_data date,
  p_resultado text,
  p_odometro text,
  p_observacao text,
  p_representadas uuid[]
)
returns table(
  id text,
  cliente_id text,
  cliente_nome text,
  data date,
  resultado text,
  odometro text,
  observacao text,
  responsavel_user_id uuid,
  representada_id uuid
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_existente public.visitas%rowtype;
  v_salva public.visitas%rowtype;
  v_cliente public.clientes%rowtype;
  v_responsavel uuid;
  v_primeira uuid;
  v_acao text;
  v_total integer;
  v_validas integer;
begin
  if auth.uid() is null then raise exception 'Sessão inválida' using errcode = '42501'; end if;
  if p_representadas is null or cardinality(p_representadas) = 0 then raise exception 'Selecione pelo menos uma representada para a visita'; end if;

  select v.* into v_existente from public.visitas v where v.id=p_id;

  if v_existente.id is null then
    v_responsavel := p_responsavel_user_id;
    v_acao := 'cadastrar';
  else
    if v_existente.user_id <> p_titular_user_id then raise exception 'Visita não pertence a esta operação' using errcode = '42501'; end if;
    v_responsavel := coalesce(v_existente.responsavel_user_id,v_existente.user_id);
    v_acao := 'editar';
  end if;

  if not public.representadas_validas_para_responsavel(p_titular_user_id,v_responsavel,p_representadas) then
    raise exception 'Uma ou mais representadas não estão disponíveis para este responsável';
  end if;

  if public.usuario_e_admin() then
    null;
  elsif auth.uid()=p_titular_user_id and exists (select 1 from public.perfis pf where pf.user_id=auth.uid()) then
    null;
  elsif auth.uid()=v_responsavel and public.preposto_tem_permissao(p_titular_user_id,'visitas',v_acao) then
    null;
  else
    raise exception 'Você não possui permissão para salvar esta visita' using errcode='42501';
  end if;

  select c.* into v_cliente from public.clientes c where c.id=p_cliente_id and c.user_id=p_titular_user_id;
  if v_cliente.id is null then raise exception 'Cliente não encontrado nesta operação'; end if;

  if v_responsavel <> p_titular_user_id and coalesce(v_cliente.responsavel_user_id,v_cliente.user_id) <> v_responsavel then
    raise exception 'Este cliente não pertence à carteira deste preposto';
  end if;

  select count(distinct x) into v_total from unnest(p_representadas) x;
  select count(distinct cr.representada_id) into v_validas
  from public.cliente_representadas cr
  where cr.cliente_id=p_cliente_id and cr.representada_id=any(p_representadas);

  if v_validas <> v_total then raise exception 'A visita só pode usar representadas vinculadas ao cliente'; end if;

  v_primeira := p_representadas[1];

  if v_existente.id is null then
    insert into public.visitas(
      id,user_id,criado_por_user_id,responsavel_user_id,cliente_id,cliente_nome,data,resultado,odometro,observacao,representada_id
    ) values (
      p_id,p_titular_user_id,auth.uid(),v_responsavel,v_cliente.id,v_cliente.nome,p_data,p_resultado,
      trim(coalesce(p_odometro,'')),trim(coalesce(p_observacao,'')),v_primeira
    ) returning * into v_salva;
  else
    update public.visitas v
    set cliente_id=v_cliente.id,cliente_nome=v_cliente.nome,data=p_data,resultado=p_resultado,
        odometro=trim(coalesce(p_odometro,'')),observacao=trim(coalesce(p_observacao,'')),
        representada_id=v_primeira,updated_at=now()
    where v.id=p_id
    returning v.* into v_salva;
  end if;

  delete from public.visita_representadas vr where vr.visita_id=p_id;
  insert into public.visita_representadas(visita_id,representada_id)
  select p_id,x from (select distinct unnest(p_representadas) as x) selecionadas;

  return query
  select v_salva.id,v_salva.cliente_id,v_salva.cliente_nome,v_salva.data,v_salva.resultado,
         v_salva.odometro,v_salva.observacao,v_salva.responsavel_user_id,v_salva.representada_id;
end;
$$;

revoke all on function public.salvar_visita_multirepresentada(text,uuid,uuid,text,date,text,text,text,uuid[]) from public, anon;
grant execute on function public.salvar_visita_multirepresentada(text,uuid,uuid,text,date,text,text,text,uuid[]) to authenticated;

create or replace function public.visita_resolver_representada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  v_id := new.representada_id;
  if v_id is null then
    select c.representada_id into v_id
    from public.clientes c
    where c.id=new.cliente_id and c.user_id=new.user_id;
  end if;

  if v_id is null then raise exception 'Cliente ou representada da visita não encontrados'; end if;

  if exists (select 1 from public.cliente_representadas cr where cr.cliente_id=new.cliente_id)
     and not exists (
       select 1 from public.cliente_representadas cr
       where cr.cliente_id=new.cliente_id and cr.representada_id=v_id
     ) then
    raise exception 'A representada da visita não está vinculada ao cliente';
  end if;

  new.representada_id := v_id;
  return new;
end;
$$;

drop trigger if exists visita_resolver_representada_trg on public.visitas;
create trigger visita_resolver_representada_trg
before insert or update of cliente_id,user_id,representada_id
on public.visitas
for each row execute function public.visita_resolver_representada();
