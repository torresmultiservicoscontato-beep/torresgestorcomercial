alter table public.visitas
  add column if not exists hora_entrada time,
  add column if not exists hora_saida time,
  add column if not exists duracao_minutos integer,
  add column if not exists odometro_inicial numeric(12,1),
  add column if not exists odometro_final numeric(12,1),
  add column if not exists km_trecho numeric(12,1),
  add column if not exists origem text not null default '',
  add column if not exists destino text not null default '',
  add column if not exists tipo_contato text not null default 'Presencial',
  add column if not exists houve_venda boolean not null default false,
  add column if not exists valor_venda numeric(14,2) not null default 0,
  add column if not exists origem_venda text not null default '',
  add column if not exists proxima_acao text not null default 'Retorno',
  add column if not exists proxima_data date,
  add column if not exists frequencia text not null default '',
  add column if not exists status_cliente text not null default '';

create index if not exists visitas_user_responsavel_data_idx
  on public.visitas(user_id, responsavel_user_id, data desc);

create or replace function public.salvar_visita_completa(
  p_id text,
  p_titular_user_id uuid,
  p_responsavel_user_id uuid,
  p_cliente_id text,
  p_data date,
  p_resultado text,
  p_representadas uuid[],
  p_hora_entrada time,
  p_hora_saida time,
  p_odometro_inicial numeric,
  p_odometro_final numeric,
  p_origem text,
  p_destino text,
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
  odometro text,
  observacao text,
  responsavel_user_id uuid,
  representada_id uuid,
  hora_entrada time,
  hora_saida time,
  duracao_minutos integer,
  odometro_inicial numeric,
  odometro_final numeric,
  km_trecho numeric,
  origem text,
  destino text,
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
  v_responsavel uuid;
  v_primeira uuid;
  v_acao text;
  v_duracao integer;
  v_km numeric(12,1);
  v_odometro_legado text;
  v_valor numeric(14,2);
  v_origem_venda text;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;

  if p_representadas is null or cardinality(p_representadas) = 0 then
    raise exception 'Selecione pelo menos uma representada para a visita';
  end if;

  select v.* into v_existente from public.visitas v where v.id = p_id;

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

  if v_cliente.id is null then raise exception 'Cliente não encontrado nesta operação'; end if;

  if v_responsavel <> p_titular_user_id
     and coalesce(v_cliente.responsavel_user_id, v_cliente.user_id) <> v_responsavel then
    raise exception 'Este cliente não pertence à carteira deste preposto';
  end if;

  if p_hora_entrada is not null and p_hora_saida is not null then
    if p_hora_saida < p_hora_entrada then
      raise exception 'O horário de saída não pode ser anterior ao horário de entrada';
    end if;
    v_duracao := floor(extract(epoch from (p_hora_saida - p_hora_entrada)) / 60)::integer;
  else
    v_duracao := null;
  end if;

  if p_odometro_inicial is not null and p_odometro_inicial < 0 then raise exception 'O odômetro inicial não pode ser negativo'; end if;
  if p_odometro_final is not null and p_odometro_final < 0 then raise exception 'O odômetro final não pode ser negativo'; end if;

  if p_odometro_inicial is not null and p_odometro_final is not null then
    if p_odometro_final < p_odometro_inicial then raise exception 'O odômetro final não pode ser menor que o inicial'; end if;
    v_km := round(p_odometro_final - p_odometro_inicial, 1);
  else
    v_km := null;
  end if;

  v_valor := case when coalesce(p_houve_venda, false) then greatest(coalesce(p_valor_venda, 0), 0) else 0 end;
  v_origem_venda := case when coalesce(p_houve_venda, false) then trim(coalesce(p_origem_venda, '')) else '' end;
  v_odometro_legado := coalesce(p_odometro_final::text, p_odometro_inicial::text, '');
  v_primeira := p_representadas[1];

  if v_existente.id is null then
    insert into public.visitas(
      id, user_id, criado_por_user_id, responsavel_user_id,
      cliente_id, cliente_nome, data, resultado, odometro, observacao, representada_id,
      hora_entrada, hora_saida, duracao_minutos, odometro_inicial, odometro_final, km_trecho,
      origem, destino, tipo_contato, houve_venda, valor_venda, origem_venda,
      proxima_acao, proxima_data, frequencia, status_cliente
    ) values (
      p_id, p_titular_user_id, auth.uid(), v_responsavel,
      v_cliente.id, v_cliente.nome, p_data, coalesce(nullif(trim(p_resultado), ''), 'Sem venda'),
      v_odometro_legado, trim(coalesce(p_observacao, '')), v_primeira,
      p_hora_entrada, p_hora_saida, v_duracao, p_odometro_inicial, p_odometro_final, v_km,
      trim(coalesce(p_origem, '')), coalesce(nullif(trim(p_destino), ''), v_cliente.nome),
      coalesce(nullif(trim(p_tipo_contato), ''), 'Presencial'), coalesce(p_houve_venda, false), v_valor, v_origem_venda,
      coalesce(nullif(trim(p_proxima_acao), ''), 'Retorno'), p_proxima_data,
      trim(coalesce(p_frequencia, '')), coalesce(nullif(trim(p_status_cliente), ''), v_cliente.status)
    ) returning * into v_salva;
  else
    update public.visitas v
    set cliente_id = v_cliente.id,
        cliente_nome = v_cliente.nome,
        data = p_data,
        resultado = coalesce(nullif(trim(p_resultado), ''), 'Sem venda'),
        odometro = v_odometro_legado,
        observacao = trim(coalesce(p_observacao, '')),
        representada_id = v_primeira,
        hora_entrada = p_hora_entrada,
        hora_saida = p_hora_saida,
        duracao_minutos = v_duracao,
        odometro_inicial = p_odometro_inicial,
        odometro_final = p_odometro_final,
        km_trecho = v_km,
        origem = trim(coalesce(p_origem, '')),
        destino = coalesce(nullif(trim(p_destino), ''), v_cliente.nome),
        tipo_contato = coalesce(nullif(trim(p_tipo_contato), ''), 'Presencial'),
        houve_venda = coalesce(p_houve_venda, false),
        valor_venda = v_valor,
        origem_venda = v_origem_venda,
        proxima_acao = coalesce(nullif(trim(p_proxima_acao), ''), 'Retorno'),
        proxima_data = p_proxima_data,
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
         v_salva.data, v_salva.resultado, v_salva.odometro, v_salva.observacao,
         v_salva.responsavel_user_id, v_salva.representada_id,
         v_salva.hora_entrada, v_salva.hora_saida, v_salva.duracao_minutos,
         v_salva.odometro_inicial, v_salva.odometro_final, v_salva.km_trecho,
         v_salva.origem, v_salva.destino, v_salva.tipo_contato,
         v_salva.houve_venda, v_salva.valor_venda, v_salva.origem_venda,
         v_salva.proxima_acao, v_salva.proxima_data, v_salva.frequencia, v_salva.status_cliente;
end;
$$;

revoke all on function public.salvar_visita_completa(text,uuid,uuid,text,date,text,uuid[],time,time,numeric,numeric,text,text,text,boolean,numeric,text,text,date,text,text,text) from public, anon;
grant execute on function public.salvar_visita_completa(text,uuid,uuid,text,date,text,uuid[],time,time,numeric,numeric,text,text,text,boolean,numeric,text,text,date,text,text,text) to authenticated;
