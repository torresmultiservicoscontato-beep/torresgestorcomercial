begin;
do $$
declare titular uuid; rep uuid; outro uuid; produto uuid; bloqueado boolean; invalido numeric;
begin
 select pr.user_id,pr.representada_id into titular,rep from public.perfil_representadas pr join public.perfis pf on pf.user_id=pr.user_id where pr.representada_id is not null and pf.papel<>'admin' limit 1;
 select user_id into outro from public.perfis where user_id<>titular and papel<>'admin' limit 1;
 if titular is null or outro is null then raise exception 'Faltam contas de teste';end if;
 perform set_config('request.jwt.claim.sub',titular::text,true);set local role authenticated;
 produto:=public.salvar_produto_representada_v3(titular,rep,null,'TESTE-QMIN','Teste quantidade mínima','UN',true,null,12);
 if not exists(select 1 from public.listar_produtos_modulo_v2(titular,rep) where produto_id=produto and quantidade_minima=12 and unidade='UN') then raise exception 'Cadastro/listagem falhou';end if;
 perform public.salvar_produto_representada_v3(titular,rep,produto,'TESTE-QMIN','Teste quantidade mínima','UN',true,null,100);
 if not exists(select 1 from public.listar_produtos_modulo_v2(titular,rep) where produto_id=produto and quantidade_minima=100) then raise exception 'Edição falhou';end if;
 foreach invalido in array array[0,-1,1.2345,null,'NaN'::numeric] loop
 bloqueado:=false;
 begin perform public.salvar_produto_representada_v3(titular,rep,produto,'TESTE-QMIN','Teste','UN',true,null,invalido);
 exception when check_violation then bloqueado:=true;end;
 if not bloqueado then raise exception 'Quantidade inválida aceita';end if;
 end loop;
 perform public.salvar_produto_representada_v2(titular,rep,produto,'TESTE-QMIN','Teste cliente anterior','UN',true,null);
 if not exists(select 1 from public.listar_produtos_modulo_v2(titular,rep) where produto_id=produto and quantidade_minima=100) then raise exception 'Cliente antigo apagou o mínimo';end if;
 perform set_config('request.jwt.claim.sub',outro::text,true);bloqueado:=false;
 begin perform public.salvar_produto_representada_v3(titular,rep,produto,'TESTE-QMIN','Teste acesso indevido','UN',true,null,1);
 exception when insufficient_privilege then bloqueado:=true;end;
 if not bloqueado then raise exception 'Edição entre operações permitida';end if;
 reset role;set local role anon;bloqueado:=false;
 begin perform * from public.listar_produtos_modulo_v2(titular,rep);exception when insufficient_privilege then bloqueado:=true;end;
 if not bloqueado then raise exception 'Consulta anônima permitida';end if;
 reset role;
end;$$;
rollback;
select 'OK: mínimo no cadastro, edição, listagem, compatibilidade e isolamento; testes revertidos.' as resultado;
