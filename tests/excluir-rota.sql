begin;
set local timezone='America/Sao_Paulo';
do $$
declare r public.rotas_semanais; nova uuid; despesa uuid; outro uuid; preposto uuid; admin uuid; equipe uuid; negado boolean; antes bigint; reps uuid[];
begin
 select rs.* into strict r from public.rotas_semanais rs join public.perfis p on p.user_id=rs.titular_user_id
 where p.papel<>'admin' and rs.responsavel_user_id=rs.titular_user_id and rs.excluida_em is null
 and exists(select 1 from public.rota_representadas rr where rr.rota_id=rs.id) limit 1;
 select user_id into strict outro from public.perfis where user_id<>r.titular_user_id and papel<>'admin' limit 1;
 select user_id into strict admin from public.perfis where papel='admin' limit 1;
 select user_id into strict preposto from public.prepostos where titular_user_id=r.titular_user_id and status='ativo' and user_id is not null limit 1;
 select array_agg(representada_id) into reps from public.rota_representadas where rota_id=r.id;
 select count(*) into antes from public.clientes where rota_id=r.id;
 perform set_config('request.jwt.claim.sub',r.titular_user_id::text,true);
 insert into public.despesas(titular_user_id,responsavel_user_id,grupo,categoria,descricao,valor_centavos,data,status,rota_id)
 values(r.titular_user_id,r.titular_user_id,'Dia a dia','Combustível','Teste exclusão rota',100,current_date,'Pendente',r.id) returning id into despesa;
 perform set_config('request.jwt.claim.sub',outro::text,true);
 set local role authenticated;
 negado:=false;begin perform public.excluir_rota_semanal(r.id);exception when insufficient_privilege then negado:=true;end;
 if not negado then raise exception 'Outra operação excluiu rota';end if;
 perform set_config('request.jwt.claim.sub',r.titular_user_id::text,true);
 perform public.excluir_rota_semanal(r.id);
 perform public.excluir_rota_semanal(r.id);
 if exists(select 1 from public.listar_rotas_semanais(r.titular_user_id,r.titular_user_id) where id=r.id) then raise exception 'Rota excluída ainda ativa';end if;
 nova:=public.salvar_rota_semanal(r.titular_user_id,r.titular_user_id,r.dia_semana,'Nova rota',r.bairros,'',reps);
 if nova=r.id then raise exception 'Nova rota sobrescreveu histórico';end if;
 reset role;
 if not exists(select 1 from public.rotas_semanais where id=r.id and excluida_em is not null and excluida_por=r.titular_user_id and municipio=r.municipio) then raise exception 'Rota antiga perdida';end if;
 if not exists(select 1 from public.despesas where id=despesa and rota_id=r.id) then raise exception 'Despesa perdeu vínculo';end if;
 if (select count(*) from public.clientes where rota_id=r.id)<>antes then raise exception 'Clientes perderam vínculo';end if;
 if (select count(*) from public.rota_representadas where rota_id=r.id)<>cardinality(reps) then raise exception 'Representadas perdidas';end if;
 if not exists(select 1 from public.auditoria where tabela='rotas_semanais' and registro_id=r.id::text and ator_user_id=r.titular_user_id and dados_depois->>'excluida_em' is not null) then raise exception 'Exclusão sem auditoria';end if;
 negado:=false;
 begin insert into public.despesas(titular_user_id,responsavel_user_id,grupo,categoria,descricao,valor_centavos,data,status,rota_id)
 values(r.titular_user_id,r.titular_user_id,'Dia a dia','Combustível','Vínculo proibido',100,current_date,'Pendente',r.id);
 exception when check_violation then negado:=true;end;
 if not negado then raise exception 'Novo vínculo em rota excluída';end if;
 update public.despesas set descricao='Histórico editável',rota_id=r.id where id=despesa;
 -- Prepare a separate route for the preposto, within the rollback transaction.
 update public.rotas_semanais set excluida_em=now() where titular_user_id=r.titular_user_id and responsavel_user_id=preposto and dia_semana=r.dia_semana and excluida_em is null;
 insert into public.rotas_semanais(titular_user_id,responsavel_user_id,dia_semana,municipio)
 values(r.titular_user_id,preposto,r.dia_semana,'Equipe teste') returning id into equipe;
 update public.prepostos set permissoes=jsonb_set(permissoes,'{rotas}','{"visualizar":true,"editar":true,"excluir":false}') where titular_user_id=r.titular_user_id and user_id=preposto;
 perform set_config('request.jwt.claim.sub',preposto::text,true);
 set local role authenticated;
 negado:=false;begin perform public.excluir_rota_semanal(equipe);exception when insufficient_privilege then negado:=true;end;
 if not negado then raise exception 'Editar concedeu exclusão';end if;
 reset role;
 update public.prepostos set permissoes=jsonb_set(permissoes,'{rotas}','{"visualizar":true,"editar":false,"excluir":true}') where titular_user_id=r.titular_user_id and user_id=preposto;
 set local role authenticated;
 negado:=false;begin perform public.excluir_rota_semanal(nova);exception when insufficient_privilege then negado:=true;end;
 if not negado then raise exception 'Preposto excluiu rota do titular';end if;
 perform public.excluir_rota_semanal(equipe);
 reset role;
 update public.prepostos set status='inativo' where titular_user_id=r.titular_user_id and user_id=preposto;
 set local role authenticated;
 negado:=false;begin perform public.excluir_rota_semanal(equipe);exception when insufficient_privilege then negado:=true;end;
 if not negado then raise exception 'Preposto inativo autorizado';end if;
 perform set_config('request.jwt.claim.sub',admin::text,true);
 perform public.excluir_rota_semanal(nova);
 reset role;
 set local role anon;
 negado:=false;begin perform public.excluir_rota_semanal(nova);exception when insufficient_privilege then negado:=true;end;
 if not negado then raise exception 'Anônimo autorizado';end if;
 reset role;
end;$$;
rollback;
select 'OK: exclusão lógica, histórico, nova rota, auditoria, vínculos e permissões; dados revertidos.' resultado;
