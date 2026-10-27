begin;
do $$
declare v public.visitas; alvo text:='teste-agenda-'||gen_random_uuid()::text; negado boolean;
begin
 if has_function_privilege('anon','public.sincronizar_agenda_visita(text)','EXECUTE')
 or has_function_privilege('authenticated','public.sincronizar_agenda_visita(text)','EXECUTE') then
 raise exception 'Função interna ainda exposta'; end if;
 select vi.* into strict v from public.visitas vi join public.perfis p on p.user_id=vi.user_id where p.papel<>'admin' limit 1;
 perform set_config('request.jwt.claim.sub',v.user_id::text,true);
 v.id:=alvo;v.responsavel_user_id:=v.user_id;v.proxima_data:=current_date;v.proxima_acao:='Visita';
 set local role authenticated;
 insert into public.visitas select v.*;
 negado:=false;
 begin perform public.sincronizar_agenda_visita(alvo);exception when insufficient_privilege then negado:=true;end;
 if not negado then raise exception 'Chamada direta permitida';end if;
 reset role;
 if not exists(select 1 from public.agenda_eventos where visita_id=alvo and status='Pendente') then raise exception 'Trigger não criou evento';end if;
 set local role authenticated;
 update public.visitas set proxima_data=null where id=alvo;
 reset role;
 if not exists(select 1 from public.agenda_eventos where visita_id=alvo and status='Cancelado') then raise exception 'Trigger não cancelou evento';end if;
 set local role anon;
 negado:=false;
 begin perform public.sincronizar_agenda_visita(alvo);exception when insufficient_privilege then negado:=true;end;
 if not negado then raise exception 'Chamada anônima permitida';end if;
 reset role;
end;$$;
rollback;
select 'OK: chamadas diretas bloqueadas; sincronização automática preservada; dados revertidos.' resultado;
