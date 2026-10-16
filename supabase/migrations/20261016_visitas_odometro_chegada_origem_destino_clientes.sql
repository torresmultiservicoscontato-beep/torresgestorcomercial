alter table public.visitas
  add column if not exists odometro_chegada numeric(12,1),
  add column if not exists origem_cliente_id text,
  add column if not exists destino_cliente_id text;

update public.visitas
set odometro_chegada = coalesce(odometro_chegada, odometro_final, odometro_inicial),
    destino_cliente_id = coalesce(destino_cliente_id, cliente_id)
where odometro_chegada is null
   or destino_cliente_id is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'visitas_origem_cliente_id_fkey'
  ) then
    alter table public.visitas
      add constraint visitas_origem_cliente_id_fkey
      foreign key (origem_cliente_id) references public.clientes(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'visitas_destino_cliente_id_fkey'
  ) then
    alter table public.visitas
      add constraint visitas_destino_cliente_id_fkey
      foreign key (destino_cliente_id) references public.clientes(id) on delete set null;
  end if;
end $$;

create or replace function public.salvar_visita_completa_v2(
  p_id text,
  p_titular_user_id uuid,
  p_responsavel_user_id uuid,
  p_cliente_id text,
  p_data date,
  p_resultado text,
  p_representadas uuid[],
  p_hora_entrada time,
  p_hora_saida time,
  p_odometro_chegada numeric,
  p_origem_cliente_id text,
  p_destino_cliente_id text,
  p_tipo_contato text,
  p_houve_venda boolean,
  p_valor_venda numeric,
  p_origem_venda text,
  p_proxima_acao text,
  p_proxima_data date,
  p_frequencia text,
  p_status_cliente text,
  p_observacao text
)
returns table(
  id text,
  cliente_id text,
  cliente_nome text,
  data date,
  resultado text,
  observacao text,
  responsavel_user_id uuid,
  representada_id uuid,
  hora_entrada time,
  hora_saida time,
  duracao_minutos integer,
  odometro_chegada numeric,
  km_trecho numeric,
  origem text,
  destino text,
  origem_cliente_id text,
  destino_cliente_id text,
  tipo_contato text,
  houve_venda boolean,
  valor_venda numeric,
  origem_venda text,
  proxima_acao text,
  proxima_data date,
  frequencia text,
  status_cliente text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_existente public.visitas%rowtype;
  v_salva public.visitas%rowtype;
  v_cliente public.clientes%rowtype;
  v_origem_cliente public.clientes%rowtype;
  v_destino_cliente public.clientes%rowtype;
  v_responsavel uuid;
  v_primeira uuid;
  v_acao text;
  v_duracao integer;
  v_km numeric(12,1);
  v_odometro_anterior numeric(12,1);
  v_valor numeric(14,2);
  v_origem_venda text;
  v_proxima_data date;
  v_destino_id text;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;

  if p_representadas is null or cardinality(p_representadas) = 0 then
    raise exception 'Selecione pelo menos uma representada para a visita';
  end if;

  select v.* into v_existente
  from public.visitas v
  where v.id = p_id;

  if v_existente.id is null then
    v_responsavel := p_responsavel_user_id;
    v_acao := 'cadastrar';
  else
    if v_existente.user_id <> p_titular_user_id then
      raise exception 'Visita não pertence a esta operação' using errcode = '42501';
    end if;
    v_responsavel := coalesce(v_existente.responsavel_user_id, v_existente.user_id);
    v_acao := 'editar';
  end if;

  if not public.representadas_validas_para_responsavel(p_titular_user_id, v_responsavel, p_representadas) then
    raise exception 'Uma ou mais representadas não estão disponíveis para este responsável';
  end if;

  if public.usuario_e_admin() then
    null;
  elsif auth.uid() = p_titular_user_id
        and exists (select 1 from public.perfis pf where pf.user_id = auth.uid()) then
    null;
  elsif auth.uid() = v_responsavel
        and public.preposto_tem_permissao(p_titular_user_id, 'visitas', v_acao) then
    null;
  else
    raise exception 'Você não possui permissão para salvar esta visita' using errcode = '42501';
  end if;

  select c.* into v_cliente
  from public.clientes c
  where c.id = p_cliente_id
    and c.user_id = p_titular_user_id;

  if v_cliente.id is null then
    raise exception 'Cliente não encontrado nesta operação';
  end if;

  if v_responsavel <> p_titular_user_id
     and coalesce(v_cliente.responsavel_user_id, v_cliente.user_id) <> v_responsavel then
    raise exception 'Este cliente não pertence à carteira deste preposto';
  end if;

  if p_origem_cliente_id is not null and trim(p_origem_cliente_id) <> '' then
    select c.* into v_origem_cliente
    from public.clientes c
    where c.id = p_origem_cliente_id
      and c.user_id = p_titular_user_id;
    if v_origem_cliente.id is null then
      raise exception 'Cliente de origem não pertence a esta operação';
    end if;
  end if;

  v_destino_id := coalesce(nullif(trim(p_destino_cliente_id), ''), p_cliente_id);
  select c.* into v_destino_cliente
  from public.clientes c
  where c.id = v_destino_id
    and c.user_id = p_titular_user_id;
  if v_destino_cliente.id is null then
    raise exception 'Cliente de destino não pertence a esta operação';
  end if;

  if p_hora_entrada is not null and p_hora_saida is not null then
    if p_hora_saida < p_hora_entrada then
      raise exception 'O horário de saída não pode ser anterior ao horário de entrada';
    end if;
    v_duracao := floor(extract(epoch from (p_hora_saida - p_hora_entrada)) / 60)::integer;
  else
    v_duracao := null;
  end if;

  if p_odometro_chegada is not null and p_odometro_chegada < 0 then
    raise exception 'O odômetro de chegada não pode ser negativo';
  end if;

  select v.odometro_chegada
    into v_odometro_anterior
  from public.visitas v
  where v.user_id = p_titular_user_id
    and coalesce(v.responsavel_user_id, v.user_id) = v_responsavel
    and v.data = p_data
    and v.id <> p_id
    and v.odometro_chegada is not null
    and (
      p_hora_entrada is null
      or v.hora_entrada is null
      or v.hora_entrada < p_hora_entrada
    )
  order by coalesce(v.hora_entrada, time '00:00') desc, v.created_at desc
  limit 1;

  if p_odometro_chegada is not null and v_odometro_anterior is not null then
    if p_odometro_chegada < v_odometro_anterior then
      raise exception 'O odômetro de chegada não pode ser menor que o da visita anterior';
    end if;
    v_km := round(p_odometro_chegada - v_odometro_anterior, 1);
  else
    v_km := null;
  end if;

  v_valor := case when coalesce(p_houve_venda, false) then greatest(coalesce(p_valor_venda, 0), 0) else 0 end;
  v_origem_venda := case when coalesce(p_houve_venda, false) then trim(coalesce(p_origem_venda, '')) else '' end;
  v_primeira := p_representadas[1];

  v_proxima_data := p_proxima_data;
  if trim(coalesce(p_proxima_acao, '')) = 'Retorno' then
    v_proxima_data := case trim(coalesce(p_frequencia, ''))
      when '1 semana' then p_data + 7
      when '2 semanas' then p_data + 14
      when '3 semanas' then p_data + 21
      when '4 semanas' then p_data + 28
      when '30 dias' then p_data + 30
      when '60 dias' then p_data + 60
      when '90 dias' then p_data + 90
      else p_proxima_data
    end;
  end if;

  if v_existente.id is null then
    insert into public.visitas(
      id, user_id, criado_por_user_id, responsavel_user_id,
      cliente_id, cliente_nome, data, resultado, odometro, observacao, representada_id,
      hora_entrada, hora_saida, duracao_minutos,
      odometro_chegada, odometro_inicial, odometro_final, km_trecho,
      origem, destino, origem_cliente_id, destino_cliente_id,
      tipo_contato, houve_venda, valor_venda, origem_venda,
      proxima_acao, proxima_data, frequencia, status_cliente
    ) values (
      p_id, p_titular_user_id, auth.uid(), v_responsavel,
      v_cliente.id, v_cliente.nome, p_data, coalesce(nullif(trim(p_resultado), ''), 'Sem venda'),
      coalesce(p_odometro_chegada::text, ''), trim(coalesce(p_observacao, '')), v_primeira,
      p_hora_entrada, p_hora_saida, v_duracao,
      p_odometro_chegada, null, p_odometro_chegada, v_km,
      coalesce(v_origem_cliente.nome, ''), v_destino_cliente.nome,
      nullif(trim(coalesce(p_origem_cliente_id, '')), ''), v_destino_cliente.id,
      coalesce(nullif(trim(p_tipo_contato), ''), 'Presencial'), coalesce(p_houve_venda, false), v_valor, v_origem_venda,
      coalesce(nullif(trim(p_proxima_acao), ''), 'Retorno'), v_proxima_data,
      trim(coalesce(p_frequencia, '')), coalesce(nullif(trim(p_status_cliente), ''), v_cliente.status)
    ) returning * into v_salva;
  else
    update public.visitas v
    set cliente_id = v_cliente.id,
        cliente_nome = v_cliente.nome,
        data = p_data,
        resultado = coalesce(nullif(trim(p_resultado), ''), 'Sem venda'),
        odometro = coalesce(p_odometro_chegada::text, ''),
        observacao = trim(coalesce(p_observacao, '')),
        representada_id = v_primeira,
        hora_entrada = p_hora_entrada,
        hora_saida = p_hora_saida,
        duracao_minutos = v_duracao,
        odometro_chegada = p_odometro_chegada,
        odometro_inicial = null,
        odometro_final = p_odometro_chegada,
        km_trecho = v_km,
        origem = coalesce(v_origem_cliente.nome, ''),
        destino = v_destino_cliente.nome,
        origem_cliente_id = nullif(trim(coalesce(p_origem_cliente_id, '')), ''),
        destino_cliente_id = v_destino_cliente.id,
        tipo_contato = coalesce(nullif(trim(p_tipo_contato), ''), 'Presencial'),
        houve_venda = coalesce(p_houve_venda, false),
        valor_venda = v_valor,
        origem_venda = v_origem_venda,
        proxima_acao = coalesce(nullif(trim(p_proxima_acao), ''), 'Retorno'),
        proxima_data = v_proxima_data,
        frequencia = trim(coalesce(p_frequencia, '')),
        status_cliente = coalesce(nullif(trim(p_status_cliente), ''), v_cliente.status),
        updated_at = now()
    where v.id = p_id
    returning v.* into v_salva;
  end if;

  delete from public.visita_representadas vr where vr.visita_id = p_id;
  insert into public.visita_representadas(visita_id, representada_id)
  select p_id, x from (select distinct unnest(p_representadas) as x) selecionadas;

  return query
  select v_salva.id, v_salva.cliente_id, v_salva.cliente_nome,
         v_salva.data, v_salva.resultado, v_salva.observacao,
         v_salva.responsavel_user_id, v_salva.representada_id,
         v_salva.hora_entrada, v_salva.hora_saida, v_salva.duracao_minutos,
         v_salva.odometro_chegada, v_salva.km_trecho,
         v_salva.origem, v_salva.destino, v_salva.origem_cliente_id, v_salva.destino_cliente_id,
         v_salva.tipo_contato, v_salva.houve_venda, v_salva.valor_venda, v_salva.origem_venda,
         v_salva.proxima_acao, v_salva.proxima_data, v_salva.frequencia, v_salva.status_cliente;
end;
$$;

revoke all on function public.salvar_visita_completa_v2(text,uuid,uuid,text,date,text,uuid[],time,time,numeric,text,text,text,boolean,numeric,text,text,date,text,text,text) from public, anon;
grant execute on function public.salvar_visita_completa_v2(text,uuid,uuid,text,date,text,uuid[],time,time,numeric,text,text,text,boolean,numeric,text,text,date,text,text,text) to authenticated;
