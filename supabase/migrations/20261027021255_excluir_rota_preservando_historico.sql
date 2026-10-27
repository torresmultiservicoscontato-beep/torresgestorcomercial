alter table public.rotas_semanais add column excluida_em timestamptz, add column excluida_por uuid;
alter table public.rotas_semanais drop constraint rotas_semanais_titular_user_id_responsavel_user_id_dia_sema_key;
create unique index rotas_semanais_ativas_dia_key on public.rotas_semanais(titular_user_id,responsavel_user_id,dia_semana) where excluida_em is null;
CREATE OR REPLACE FUNCTION public.listar_rotas_semanais(p_titular_user_id uuid, p_responsavel_user_id uuid)
 RETURNS TABLE(id uuid, dia_semana smallint, municipio text, bairros text[], observacao text, representada_ids uuid[], representada_nomes text[], updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
  where r.excluida_em is null and r.titular_user_id = p_titular_user_id
    and r.responsavel_user_id = p_responsavel_user_id
  group by r.id, r.dia_semana, r.municipio, r.bairros, r.observacao, r.updated_at
  order by r.dia_semana;
end;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_rota_semanal(p_titular_user_id uuid, p_responsavel_user_id uuid, p_dia_semana smallint, p_municipio text, p_bairros text[], p_observacao text, p_representadas uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
      and r.excluida_em is null
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
  on conflict (titular_user_id, responsavel_user_id, dia_semana) where excluida_em is null
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
$function$;


create or replace function public.excluir_rota_semanal(p_rota_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.rotas_semanais;
begin
 if auth.uid() is null then raise exception 'Sessão inválida' using errcode='42501'; end if;
 select * into r from public.rotas_semanais where id=p_rota_id for update;
 if r.id is null or not public.pode_acessar_rota_operacional(r.titular_user_id,r.responsavel_user_id,'excluir') then
  raise exception 'Você não possui permissão para excluir esta rota' using errcode='42501';
 end if;
 if r.excluida_em is not null then return;end if;
 update public.rotas_semanais set excluida_em=now(),excluida_por=auth.uid(),updated_at=now() where id=p_rota_id;
end;$$;
revoke all on function public.excluir_rota_semanal(uuid) from public,anon;
grant execute on function public.excluir_rota_semanal(uuid) to authenticated;

-- Existing historical links may remain; new links must target active routes.
create or replace function private.validar_rota_ativa_vinculo() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.rota_id is null then return new; end if;
 if tg_op='UPDATE' then
  if new.rota_id is not distinct from old.rota_id then return new; end if;
 end if;
 perform 1 from public.rotas_semanais where id=new.rota_id and excluida_em is null for share;
 if not found then raise exception 'Esta rota foi excluída. Selecione uma rota ativa.' using errcode='23514';end if;
 return new;
end;$$;
revoke all on function private.validar_rota_ativa_vinculo() from public,anon,authenticated;
create trigger validar_rota_ativa_cliente before insert or update of rota_id on public.clientes for each row execute function private.validar_rota_ativa_vinculo();
create trigger validar_rota_ativa_despesa before insert or update of rota_id on public.despesas for each row execute function private.validar_rota_ativa_vinculo();
