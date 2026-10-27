-- Index eligibility diagnostic only; not a latency benchmark.
begin;
set local enable_seqscan=off;
set local enable_sort=off;
do $$
declare r record; plano json;
begin
 for r in select * from (values
('clientes_usuario_criacao_idx','select id from public.clientes where user_id=''00000000-0000-0000-0000-000000000000'' order by created_at desc limit 25'),
('clientes_usuario_responsavel_criacao_idx','select id from public.clientes where user_id=''00000000-0000-0000-0000-000000000000'' and responsavel_user_id=''00000000-0000-0000-0000-000000000000'' order by created_at desc limit 25'),
('visitas_usuario_historico_idx','select id from public.visitas where user_id=''00000000-0000-0000-0000-000000000000'' order by data desc,hora_entrada desc nulls last,created_at desc limit 25'),
('visitas_usuario_responsavel_historico_idx','select id from public.visitas where user_id=''00000000-0000-0000-0000-000000000000'' and responsavel_user_id=''00000000-0000-0000-0000-000000000000'' order by data desc,hora_entrada desc nulls last,created_at desc limit 25'),
('vendas_ativas_titular_historico_idx','select id from public.vendas where titular_user_id=''00000000-0000-0000-0000-000000000000'' and ativa=true order by data desc,created_at desc limit 25'),
('vendas_ativas_responsavel_historico_idx','select id from public.vendas where titular_user_id=''00000000-0000-0000-0000-000000000000'' and responsavel_user_id=''00000000-0000-0000-0000-000000000000'' and ativa=true order by data desc,created_at desc limit 25'),
('visitas_cliente_data_idx','select data from public.visitas where cliente_id=''fixture-inexistente'' order by data desc limit 1'),
('agenda_frequencia_pendente_cliente_data_idx','select data from public.agenda_eventos where cliente_id=''fixture-inexistente'' and origem=''frequencia'' and status=''Pendente'' and data>=current_date order by data limit 1')
 ) as casos(indice,consulta) loop
 execute 'explain (format json) ' || r.consulta into plano;
 if position('Index' in plano::text)=0 or position('"Node Type": "Sort"' in plano::text)>0 then
 raise exception 'Plano inesperado para %: %',r.indice,plano;
 end if;
 end loop;
end;$$;
rollback;
select 'OK: oito consultas com caminhos indexados, ordenação sem Sort; configuração revertida' resultado;
