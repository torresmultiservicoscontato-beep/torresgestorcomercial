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

  v_primeira := p_representadas[1];

  if v_existente.id is null then
    insert into public.visitas(
      id, user_id, criado_por_user_id, responsavel_user_id,
      cliente_id, cliente_nome, data, resultado, odometro, observacao, representada_id
    ) values (
      p_id, p_titular_user_id, auth.uid(), v_responsavel,
      v_cliente.id, v_cliente.nome, p_data, p_resultado,
      trim(coalesce(p_odometro,'')), trim(coalesce(p_observacao,'')), v_primeira
    ) returning * into v_salva;
  else
    update public.visitas v
    set cliente_id = v_cliente.id,
        cliente_nome = v_cliente.nome,
        data = p_data,
        resultado = p_resultado,
        odometro = trim(coalesce(p_odometro,'')),
        observacao = trim(coalesce(p_observacao,'')),
        representada_id = v_primeira,
        updated_at = now()
    where v.id = p_id
    returning v.* into v_salva;
  end if;

  delete from public.visita_representadas vr
  where vr.visita_id = p_id;

  insert into public.visita_representadas(visita_id, representada_id)
  select p_id, x
  from (select distinct unnest(p_representadas) as x) selecionadas;

  return query
  select v_salva.id, v_salva.cliente_id, v_salva.cliente_nome,
         v_salva.data, v_salva.resultado, v_salva.odometro, v_salva.observacao,
         v_salva.responsavel_user_id, v_salva.representada_id;
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
  v_responsavel uuid;
begin
  v_id := new.representada_id;
  v_responsavel := coalesce(new.responsavel_user_id, new.user_id);

  if v_id is null then
    select c.representada_id into v_id
    from public.clientes c
    where c.id = new.cliente_id
      and c.user_id = new.user_id;
  end if;

  if v_id is null then
    raise exception 'Cliente ou representada da visita não encontrados';
  end if;

  if not public.representadas_validas_para_responsavel(new.user_id, v_responsavel, array[v_id]) then
    raise exception 'A representada da visita não está disponível para este responsável';
  end if;

  new.representada_id := v_id;
  return new;
end;
$$;
