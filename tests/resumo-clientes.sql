-- Run after the migration. All fixtures are rolled back.
begin;
set local statement_timeout = '30s';
do $$
declare
  c public.clientes;
  ids text[];
  atores uuid[];
  ator uuid;
  negado boolean;
  quantidade integer;
begin
  select cl.* into strict c from public.clientes cl join public.perfis p on p.user_id=cl.user_id
    where p.papel <> 'admin' limit 1;
  perform set_config('request.jwt.claim.sub', c.user_id::text, true);
  insert into public.visitas(id,user_id,responsavel_user_id,criado_por_user_id,cliente_id,cliente_nome,representada_id,data)
    select gen_random_uuid()::text,c.user_id,c.responsavel_user_id,c.user_id,c.id,c.nome,c.representada_id,current_date-g
    from generate_series(1,1101) g;
  select array_agg(id) into ids from public.clientes;
  if cardinality(ids)>200 then raise exception 'Fixture requires at most 200 clients'; end if;
  select array_agg(user_id) into atores from (
    select user_id from public.perfis union select user_id from public.preposto_perfis union select gen_random_uuid()
  ) u;
  foreach ator in array atores loop
    perform set_config('request.jwt.claim.sub', ator::text, true);
    set local role authenticated;
    -- Compare all visible rows and dates against independent aggregates with RLS.
    if exists (
      with esperado as (
        select cl.id,cl.logradouro,cl.numero,cl.complemento,cl.cep,cl.rota_id,cl.rota_ordem,cl.latitude,cl.longitude,
          (select max(v.data) from public.visitas v where v.cliente_id=cl.id) ultima_visita,
          (select min(a.data) from public.agenda_eventos a where a.cliente_id=cl.id and a.origem='frequencia' and a.status='Pendente' and a.data>=current_date) proxima_visita_prevista
        from public.clientes cl where cl.id=any(ids)
      ), obtido as (select * from public.carregar_resumo_clientes(ids,current_date))
      (select * from esperado except select * from obtido)
      union all
      (select * from obtido except select * from esperado)
    ) then raise exception 'Resumo difere das consultas protegidas por RLS'; end if;
    if exists(select 1 from public.carregar_resumo_clientes('{}'::text[],current_date)) then raise exception 'Lista vazia retornou dados'; end if;
    reset role;
  end loop;
  perform set_config('request.jwt.claim.sub',c.user_id::text,true);
  set local role authenticated;
  select count(*) into quantidade from public.carregar_resumo_clientes(array[c.id,c.id],current_date);
  if quantidade<>1 then raise exception 'Histórico extenso ou IDs repetidos duplicaram o resumo'; end if;
  negado:=false;
  begin perform public.carregar_resumo_clientes(array_fill(c.id,array[201]),current_date);
  exception when invalid_parameter_value then negado:=true; end;
  if not negado then raise exception 'Aceitou lote excessivo'; end if;
  reset role;
  set local role anon;
  negado:=false;
  begin perform public.carregar_resumo_clientes(ids,current_date);
  exception when insufficient_privilege then negado:=true; end;
  if not negado then raise exception 'Anon autorizado'; end if;
  reset role;
end;
$$;
rollback;
select 'OK: resumo, histórico >1000, RLS de todos os perfis, lista vazia, duplicados, limite e anon; fixtures revertidas' resultado;
