alter table public.clientes
  add column if not exists logradouro text not null default '',
  add column if not exists numero text not null default '',
  add column if not exists complemento text not null default '',
  add column if not exists cep text not null default '',
  add column if not exists rota_id uuid references public.rotas_semanais(id) on delete set null,
  add column if not exists rota_ordem integer,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists geocodificado_em timestamptz;

create index if not exists clientes_rota_id_idx on public.clientes(rota_id);
create index if not exists clientes_rota_ordem_idx on public.clientes(rota_id, rota_ordem);

create or replace function public.salvar_cliente_completo(
  p_id text,
  p_titular_user_id uuid,
  p_responsavel_user_id uuid,
  p_nome text,
  p_cidade text,
  p_bairro text,
  p_logradouro text,
  p_numero text,
  p_complemento text,
  p_cep text,
  p_telefone text,
  p_status text,
  p_rota_id uuid,
  p_representadas uuid[]
)
returns table(
  id text,
  nome text,
  cidade text,
  bairro text,
  logradouro text,
  numero text,
  complemento text,
  cep text,
  representada text,
  telefone text,
  status text,
  responsavel_user_id uuid,
  representada_id uuid,
  rota_id uuid,
  rota_ordem integer,
  latitude double precision,
  longitude double precision
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
  v_rota_ordem integer;
  v_endereco_alterado boolean;
begin
  if auth.uid() is null then raise exception 'Sessão inválida' using errcode = '42501'; end if;
  if trim(coalesce(p_nome, '')) = '' then raise exception 'Informe o nome do cliente'; end if;
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

  if p_rota_id is not null then
    if not exists (
      select 1 from public.rotas_semanais r
      where r.id = p_rota_id
        and r.titular_user_id = p_titular_user_id
        and r.responsavel_user_id = v_responsavel
    ) then
      raise exception 'A rota selecionada não pertence a este responsável';
    end if;

    if not exists (
      select 1 from public.rota_representadas rr
      where rr.rota_id = p_rota_id
        and rr.representada_id = any(p_representadas)
    ) then
      raise exception 'A rota selecionada não atende nenhuma das representadas deste cliente';
    end if;
  end if;

  v_primeira := p_representadas[1];
  select pr.nome into v_nome_representada
  from public.perfil_representadas pr
  where pr.user_id = p_titular_user_id and pr.representada_id = v_primeira
  limit 1;

  if v_nome_representada is null then raise exception 'Representada principal inválida'; end if;

  if p_rota_id is null then
    v_rota_ordem := null;
  elsif v_existente.id is not null and v_existente.rota_id = p_rota_id and v_existente.rota_ordem is not null then
    v_rota_ordem := v_existente.rota_ordem;
  else
    select coalesce(max(c.rota_ordem), 0) + 1 into v_rota_ordem
    from public.clientes c where c.rota_id = p_rota_id;
  end if;

  v_endereco_alterado := v_existente.id is not null and (
    v_existente.logradouro is distinct from trim(coalesce(p_logradouro, ''))
    or v_existente.numero is distinct from trim(coalesce(p_numero, ''))
    or v_existente.complemento is distinct from trim(coalesce(p_complemento, ''))
    or v_existente.bairro is distinct from trim(coalesce(p_bairro, ''))
    or v_existente.cidade is distinct from trim(coalesce(p_cidade, ''))
    or v_existente.cep is distinct from trim(coalesce(p_cep, ''))
  );

  if v_existente.id is null then
    insert into public.clientes(
      id, user_id, criado_por_user_id, responsavel_user_id,
      nome, cidade, bairro, logradouro, numero, complemento, cep,
      representada, representada_id, telefone, status, rota_id, rota_ordem,
      latitude, longitude, geocodificado_em
    ) values (
      p_id, p_titular_user_id, auth.uid(), v_responsavel,
      trim(p_nome), trim(coalesce(p_cidade,'')), trim(coalesce(p_bairro,'')),
      trim(coalesce(p_logradouro,'')), trim(coalesce(p_numero,'')), trim(coalesce(p_complemento,'')), trim(coalesce(p_cep,'')),
      v_nome_representada, v_primeira, trim(coalesce(p_telefone,'')), p_status,
      p_rota_id, v_rota_ordem, null, null, null
    ) returning * into v_salvo;
  else
    update public.clientes c
    set nome = trim(p_nome),
        cidade = trim(coalesce(p_cidade,'')),
        bairro = trim(coalesce(p_bairro,'')),
        logradouro = trim(coalesce(p_logradouro,'')),
        numero = trim(coalesce(p_numero,'')),
        complemento = trim(coalesce(p_complemento,'')),
        cep = trim(coalesce(p_cep,'')),
        representada = v_nome_representada,
        representada_id = v_primeira,
        telefone = trim(coalesce(p_telefone,'')),
        status = p_status,
        rota_id = p_rota_id,
        rota_ordem = v_rota_ordem,
        latitude = case when v_endereco_alterado then null else c.latitude end,
        longitude = case when v_endereco_alterado then null else c.longitude end,
        geocodificado_em = case when v_endereco_alterado then null else c.geocodificado_em end,
        updated_at = now()
    where c.id = p_id
    returning c.* into v_salvo;
  end if;

  delete from public.cliente_representadas cr where cr.cliente_id = p_id;
  insert into public.cliente_representadas(cliente_id, representada_id)
  select p_id, x from (select distinct unnest(p_representadas) as x) selecionadas;

  return query
  select v_salvo.id, v_salvo.nome, v_salvo.cidade, v_salvo.bairro,
         v_salvo.logradouro, v_salvo.numero, v_salvo.complemento, v_salvo.cep,
         v_salvo.representada, v_salvo.telefone, v_salvo.status,
         v_salvo.responsavel_user_id, v_salvo.representada_id,
         v_salvo.rota_id, v_salvo.rota_ordem, v_salvo.latitude, v_salvo.longitude;
end;
$$;

revoke all on function public.salvar_cliente_completo(text,uuid,uuid,text,text,text,text,text,text,text,text,text,uuid,uuid[]) from public, anon;
grant execute on function public.salvar_cliente_completo(text,uuid,uuid,text,text,text,text,text,text,text,text,text,uuid,uuid[]) to authenticated;

create or replace function public.listar_clientes_mapa_rota(p_rota_id uuid)
returns table(
  id text,
  nome text,
  cidade text,
  bairro text,
  logradouro text,
  numero text,
  complemento text,
  cep text,
  latitude double precision,
  longitude double precision,
  rota_ordem integer,
  representada_ids uuid[],
  representada_nomes text[]
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_rota public.rotas_semanais%rowtype;
begin
  select r.* into v_rota from public.rotas_semanais r where r.id = p_rota_id;
  if v_rota.id is null then raise exception 'Rota não encontrada'; end if;

  if not public.pode_acessar_rota_operacional(v_rota.titular_user_id, v_rota.responsavel_user_id, 'visualizar') then
    raise exception 'Você não possui permissão para visualizar esta rota' using errcode = '42501';
  end if;

  return query
  select c.id, c.nome, c.cidade, c.bairro, c.logradouro, c.numero, c.complemento, c.cep,
         c.latitude, c.longitude, c.rota_ordem,
         coalesce(array_agg(rc.representada_id order by cat.nome) filter (where rc.representada_id is not null), '{}'::uuid[]) as representada_ids,
         coalesce(array_agg(cat.nome order by cat.nome) filter (where cat.nome is not null), '{}'::text[]) as representada_nomes
  from public.clientes c
  left join public.cliente_representadas rc on rc.cliente_id = c.id
  left join public.representadas_catalogo cat on cat.id = rc.representada_id
  where c.rota_id = p_rota_id
  group by c.id, c.nome, c.cidade, c.bairro, c.logradouro, c.numero, c.complemento, c.cep,
           c.latitude, c.longitude, c.rota_ordem
  order by c.rota_ordem nulls last, lower(c.nome);
end;
$$;

revoke all on function public.listar_clientes_mapa_rota(uuid) from public, anon;
grant execute on function public.listar_clientes_mapa_rota(uuid) to authenticated;

create or replace function public.atualizar_coordenadas_cliente_rota(
  p_cliente_id text,
  p_latitude double precision,
  p_longitude double precision
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_cliente public.clientes%rowtype;
  v_rota public.rotas_semanais%rowtype;
begin
  if p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Coordenadas inválidas';
  end if;

  select c.* into v_cliente from public.clientes c where c.id = p_cliente_id;
  if v_cliente.id is null or v_cliente.rota_id is null then raise exception 'Cliente da rota não encontrado'; end if;

  select r.* into v_rota from public.rotas_semanais r where r.id = v_cliente.rota_id;
  if v_rota.id is null then raise exception 'Rota não encontrada'; end if;

  if not public.pode_acessar_rota_operacional(v_rota.titular_user_id, v_rota.responsavel_user_id, 'visualizar') then
    raise exception 'Você não possui permissão para atualizar o mapa desta rota' using errcode = '42501';
  end if;

  update public.clientes
  set latitude = p_latitude,
      longitude = p_longitude,
      geocodificado_em = now(),
      updated_at = now()
  where id = p_cliente_id;
end;
$$;

revoke all on function public.atualizar_coordenadas_cliente_rota(text,double precision,double precision) from public, anon;
grant execute on function public.atualizar_coordenadas_cliente_rota(text,double precision,double precision) to authenticated;
