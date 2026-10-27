begin;
create function pg_temp.salvar_teste(v public.visitas, reps uuid[], alvo text, itens jsonb, obs text, com_venda boolean default true)
returns jsonb language sql as $$
 select public.salvar_visita_venda_atomica(
 alvo,v.user_id,v.user_id,v.cliente_id,current_date,'Venda',reps,
 null,null,null,null,v.cliente_id,'Presencial',com_venda,100,'Presencial',
 'Retorno',current_date+7,'1 semana',v.status_cliente,obs,
 array['Pix'],array[]::text[],'Pedido lançado',itens);
$$;
do $$
declare
 v public.visitas; reps uuid[]; alvo text := 'teste-atomico-'||gen_random_uuid()::text;
 venda uuid; resultado jsonb; valido jsonb; invalido jsonb; antes jsonb;
 bloqueado boolean; outro uuid;
begin
 select vi.* into strict v from public.visitas vi
 where exists(select 1 from public.perfis pf where pf.user_id=vi.user_id)
 and exists(select 1 from public.perfil_representadas pr where pr.user_id=vi.user_id and pr.representada_id is not null)
 limit 1;
 select array_agg(representada_id) into reps from public.perfil_representadas where user_id=v.user_id and representada_id is not null;
 valido:=jsonb_build_array(jsonb_build_object('produto','Teste atomicidade','representadaId',reps[1],'quantidade','2','valorUnitario','50','valorTotal','100'));
 invalido:=valido||jsonb_build_array(jsonb_build_object('produto','Falha após primeiro item','quantidade','invalido'));
 perform set_config('request.jwt.claim.sub',v.user_id::text,true);
 set local role authenticated;
 bloqueado:=false;
 begin perform pg_temp.salvar_teste(v,reps,alvo,invalido,'não persistir');
 exception when invalid_text_representation then bloqueado:=true;end;
 if not bloqueado then raise exception 'Item inválido foi aceito';end if;
 reset role;
 if exists(select 1 from public.visitas where id=alvo)
 or exists(select 1 from public.vendas where visita_id=alvo)
 or exists(select 1 from public.visita_representadas where visita_id=alvo)
 or exists(select 1 from public.agenda_eventos where visita_id=alvo)
 then raise exception 'Criação parcial persistiu';end if;
 set local role authenticated;
 resultado:=pg_temp.salvar_teste(v,reps,alvo,valido,'original');
 if resultado->>'id'<>alvo then raise exception 'Retorno incorreto';end if;
 reset role;
 select id into strict venda from public.vendas where visita_id=alvo;
 if (select count(*) from public.venda_itens where venda_id=venda)<>1 then raise exception 'Itens não salvos';end if;
 select jsonb_build_object(
 'visita',(select to_jsonb(x) from public.visitas x where id=alvo),
 'venda',(select to_jsonb(x) from public.vendas x where id=venda),
 'itens',(select jsonb_agg(to_jsonb(x) order by id) from public.venda_itens x where venda_id=venda)
 ) into antes;
 set local role authenticated;bloqueado:=false;
 begin perform pg_temp.salvar_teste(v,reps,alvo,invalido,'não alterar');
 exception when invalid_text_representation then bloqueado:=true;end;
 if not bloqueado then raise exception 'Edição inválida aceita';end if;
 reset role;
 if antes is distinct from jsonb_build_object(
 'visita',(select to_jsonb(x) from public.visitas x where id=alvo),
 'venda',(select to_jsonb(x) from public.vendas x where id=venda),
 'itens',(select jsonb_agg(to_jsonb(x) order by id) from public.venda_itens x where venda_id=venda)
 ) then raise exception 'Edição parcial persistiu';end if;
 set local role authenticated;
 perform pg_temp.salvar_teste(v,reps,alvo,valido,'editado');
 reset role;
 if (select observacao from public.visitas where id=alvo)<>'editado'
 or (select count(*) from public.vendas where visita_id=alvo)<>1
 or (select count(*) from public.venda_itens where venda_id=venda)<>1
 then raise exception 'Edição duplicou ou não salvou';end if;
 select user_id into outro from public.perfis where user_id<>v.user_id and papel<>'admin' limit 1;
 if outro is null then raise exception 'Sem segunda conta para testar';end if;
 perform set_config('request.jwt.claim.sub',outro::text,true);
 set local role authenticated;bloqueado:=false;
 begin perform pg_temp.salvar_teste(v,reps,alvo,valido,'invasão');
 exception when insufficient_privilege then bloqueado:=true;end;
 if not bloqueado then raise exception 'Outra conta alterou visita';end if;
 reset role;
 perform set_config('request.jwt.claim.sub',v.user_id::text,true);
 set local role authenticated;
 perform pg_temp.salvar_teste(v,reps,alvo||'-sem-venda','[]','sem venda',false);
 reset role;
 if not exists(select 1 from public.visitas where id=alvo||'-sem-venda')
 or exists(select 1 from public.vendas where visita_id=alvo||'-sem-venda')
 then raise exception 'Visita sem venda incorreta';end if;
 set local role anon;bloqueado:=false;
 begin perform pg_temp.salvar_teste(v,reps,alvo,valido,'anon');
 exception when insufficient_privilege then bloqueado:=true;end;
 if not bloqueado then raise exception 'Anon acessou RPC';end if;
 reset role;
end;$$;
rollback;
select 'OK: gravação conjunta, rollback na criação e edição, sem duplicação, sem venda e isolamento; tudo revertido.' resultado;
