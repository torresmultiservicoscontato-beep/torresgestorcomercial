begin;
do $$
declare v public.vendas; antes jsonb; depois jsonb; outro uuid; negado boolean;
 itens jsonb := '[{"produto":"Item novo","quantidade":2,"valor_unitario":12.5,"valor_total":25}]';
begin
 select ve.* into strict v from public.vendas ve
 join public.perfis pf on pf.user_id=ve.titular_user_id limit 1;
 select jsonb_build_object(
 'venda',(select to_jsonb(x) from public.vendas x where id=v.id),
 'itens',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.venda_itens x where venda_id=v.id)
 ) into antes;
 perform set_config('request.jwt.claim.sub',v.titular_user_id::text,true);
 set local role authenticated;
 negado:=false;
 begin
  perform public.atualizar_venda_com_itens(v.id,array['Pix'],array['Teste'],v.situacao,
    itens||'[{"produto":"Item com erro","quantidade":"invalida"}]'::jsonb);
 exception when invalid_text_representation then negado:=true;
 end;
 if not negado then raise exception 'Falha não ocorreu';end if;
 reset role;
 select jsonb_build_object(
 'venda',(select to_jsonb(x) from public.vendas x where id=v.id),
 'itens',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.venda_itens x where venda_id=v.id)
 ) into depois;
 if antes is distinct from depois then raise exception 'Falha perdeu dados anteriores';end if;
 set local role authenticated;
 perform public.atualizar_venda_com_itens(v.id,array['Pix'],array[]::text[],v.situacao,itens);
 perform public.atualizar_venda_com_itens(v.id,array['Pix'],array[]::text[],v.situacao,itens);
 reset role;
 if (select count(*) from public.venda_itens where venda_id=v.id)<>1
 or not exists(select 1 from public.venda_itens where venda_id=v.id and produto='Item novo' and valor_total=25)
 then raise exception 'Sucesso não substituiu itens corretamente';end if;
 select user_id into strict outro from public.perfis where user_id<>v.titular_user_id and papel<>'admin' limit 1;
 perform set_config('request.jwt.claim.sub',outro::text,true);
 set local role authenticated;negado:=false;
 begin perform public.atualizar_venda_com_itens(v.id,'{}','{}',v.situacao,'[]');
 exception when insufficient_privilege then negado:=true;end;
 if not negado then raise exception 'Outra conta alterou venda';end if;
 reset role;
 if (select count(*) from public.venda_itens where venda_id=v.id)<>1 then raise exception 'Outra conta apagou itens';end if;
 perform set_config('request.jwt.claim.sub',v.titular_user_id::text,true);
 set local role authenticated;negado:=false;
 begin perform public.atualizar_venda_com_itens(v.id,'{}','{}',v.situacao,'{}');
 exception when invalid_parameter_value then negado:=true;end;
 if not negado then raise exception 'Formato inválido aceito';end if;
 perform public.atualizar_venda_com_itens(v.id,'{}','{}',v.situacao,'[]');
 reset role;
 if exists(select 1 from public.venda_itens where venda_id=v.id) then raise exception 'Lista vazia explícita não removeu itens';end if;
 set local role anon;negado:=false;
 begin perform public.atualizar_venda_com_itens(v.id,'{}','{}',v.situacao,'[]');
 exception when insufficient_privilege then negado:=true;end;
 if not negado then raise exception 'Anon acessou RPC';end if;
 reset role;
end;$$;
rollback;
select 'OK: falha preserva venda e itens, sucesso substitui sem duplicar, lista vazia explícita e isolamento; dados revertidos.' resultado;
