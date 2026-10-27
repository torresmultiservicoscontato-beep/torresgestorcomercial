begin;
do $$
declare v public.visitas; titular uuid; outro uuid; preposto uuid; venda uuid; ordem uuid; rep uuid; bloqueado boolean;
begin
 select * into v from public.visitas limit 1;
 if v.id is null then raise exception 'Sem visita para teste';end if;
 titular:=v.user_id;
 select user_id into outro from public.perfis where user_id<>titular and papel<>'admin' limit 1;
 select representada_id into rep from public.perfil_representadas where user_id=titular limit 1;
 v.id:='teste-exclusao-'||gen_random_uuid()::text;
 v.responsavel_user_id:=titular;v.proxima_data:=current_date+1;v.proxima_acao:='Retorno';
 insert into public.visitas select v.*;
 insert into public.vendas(titular_user_id,responsavel_user_id,visita_id,cliente_id,cliente_nome,data,valor) values(titular,titular,v.id,v.cliente_id,v.cliente_nome,current_date,100) returning id into venda;
 insert into public.venda_ordens(venda_id,representada_id) values(venda,rep) returning id into ordem;
 perform set_config('request.jwt.claim.sub',outro::text,true);set local role authenticated;
 bloqueado:=false;
 begin perform public.excluir_visita(titular,v.id);exception when insufficient_privilege then bloqueado:=true;end;
 if not bloqueado then raise exception 'Outra conta excluiu visita';end if;
 perform set_config('request.jwt.claim.sub',titular::text,true);
 bloqueado:=false;
 begin perform public.excluir_visita(titular,v.id,outro);exception when insufficient_privilege then bloqueado:=true;end;
 if not bloqueado then raise exception 'Filtro de carteira ignorado';end if;
 reset role;
 insert into public.venda_comissao_pagamentos(ordem_id,tipo,valor,data_pagamento) values(ordem,'representante',1,current_date);
 set local role authenticated;bloqueado:=false;
 begin perform public.excluir_visita(titular,v.id);exception when raise_exception then
 if sqlerrm not like '%comissão paga%' then raise;end if;bloqueado:=true;end;
 if not bloqueado then raise exception 'Apagou financeiro pago';end if;
 reset role;
 -- DELETE direto, sem a RPC, também deve respeitar a proteção.
 for preposto in select user_id from public.perfis where user_id=titular or papel='admin' loop
  perform set_config('request.jwt.claim.sub',preposto::text,true);
  set local role authenticated;
  bloqueado:=false;
  begin
   delete from public.visitas where id=v.id;
  exception when check_violation then
   if sqlerrm not like '%comissão paga%' then raise;end if;
   bloqueado:=true;
  end;
  if not bloqueado then raise exception 'DELETE direto contornou comissão paga';end if;
  reset role;
 end loop;
 if not exists(select 1 from public.visitas where id=v.id)
 or not exists(select 1 from public.venda_comissao_pagamentos where ordem_id=ordem)
 then raise exception 'Dados pagos alterados após bloqueio';end if;
 -- Repasse parcial de preposto também impede DELETE direto.
 update public.venda_comissao_pagamentos set tipo='preposto' where ordem_id=ordem;
 perform set_config('request.jwt.claim.sub',titular::text,true);
 set local role authenticated;bloqueado:=false;
 begin delete from public.visitas where id=v.id;
 exception when check_violation then bloqueado:=true;end;
 if not bloqueado then raise exception 'Apagou comissão de preposto';end if;
 reset role;
 delete from public.venda_comissao_pagamentos where ordem_id=ordem;
 set local role authenticated;
 perform public.excluir_visita(titular,v.id);
 reset role;
 if exists(select 1 from public.visitas where id=v.id) or exists(select 1 from public.vendas where id=venda) or exists(select 1 from public.venda_ordens where id=ordem) or exists(select 1 from public.agenda_eventos where visita_id=v.id) then raise exception 'Cascata incompleta';end if;
 -- Usa um vínculo real apenas dentro da transação revertida.
 select p.user_id,p.titular_user_id into preposto,titular from public.prepostos p where p.user_id is not null and not exists(select 1 from public.perfis f where f.user_id=p.user_id and f.papel='admin') limit 1;
 if preposto is null then raise exception 'Sem preposto para teste';end if;
 update public.prepostos set status='ativo',permissoes=jsonb_set(permissoes,'{visitas,editar}','true') where user_id=preposto and titular_user_id=titular;
 v.user_id:=titular;v.responsavel_user_id:=preposto;v.proxima_data:=null;
 insert into public.visitas select v.*;
 perform set_config('request.jwt.claim.sub',preposto::text,true);set local role authenticated;
 perform public.excluir_visita(titular,v.id);
 reset role;
 insert into public.visitas select v.*;
 update public.prepostos set permissoes=jsonb_set(permissoes,'{visitas,editar}','false') where user_id=preposto and titular_user_id=titular;
 set local role authenticated;bloqueado:=false;
 begin perform public.excluir_visita(titular,v.id);exception when insufficient_privilege then bloqueado:=true;end;
 if not bloqueado then raise exception 'Preposto sem permissão excluiu';end if;
 reset role;set local role anon;bloqueado:=false;
 begin perform public.excluir_visita(titular,v.id);exception when insufficient_privilege then bloqueado:=true;end;
 if not bloqueado then raise exception 'Anon excluiu';end if;
 reset role;
end;$$;
rollback;
select 'OK: exclusão, cascata, isolamento e permissões; tudo revertido.' resultado;
