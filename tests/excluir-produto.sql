begin;
do $$
declare titular uuid; outro uuid; rep uuid; produto uuid; item public.venda_itens; item_id uuid; bloqueado boolean;
begin
 select pr.user_id,pr.representada_id into titular,rep from public.perfil_representadas pr join public.perfis pf on pf.user_id=pr.user_id where pf.papel<>'admin' limit 1;
 select user_id into outro from public.perfis where user_id<>titular and papel<>'admin' limit 1;
 perform set_config('request.jwt.claim.sub',titular::text,true);set local role authenticated;
 produto:=public.salvar_produto_representada_v4(titular,rep,null,'TESTE-DEL','Produto teste exclusão','UN',true,null,88,10);
 reset role;
 select * into item from public.venda_itens limit 1;
 if item.id is null then raise exception 'Sem item para testar preservação';end if;
 item.id:=gen_random_uuid();item.produto_id:=produto;item.produto:='Produto teste exclusão';item.quantidade:=176;item.valor_unitario:=10;item.valor_total:=1760;
 insert into public.venda_itens select item.*;
 item_id:=item.id;
 perform set_config('request.jwt.claim.sub',outro::text,true);set local role authenticated;bloqueado:=false;
 begin perform public.excluir_produto(titular,produto);exception when insufficient_privilege then bloqueado:=true;end;
 if not bloqueado then raise exception 'Outra conta excluiu';end if;
 perform set_config('request.jwt.claim.sub',titular::text,true);
 perform public.excluir_produto(titular,produto);
 reset role;
 if exists(select 1 from public.representada_produtos where id=produto) then raise exception 'Produto não excluído';end if;
 if not exists(select 1 from public.venda_itens where id=item_id and produto_id is null and venda_itens.produto='Produto teste exclusão' and quantidade=176 and valor_total=1760 and valor_unitario=10) then raise exception 'Histórico alterado';end if;
 set local role anon;bloqueado:=false;
 begin perform public.excluir_produto(titular,produto);exception when insufficient_privilege then bloqueado:=true;end;
 if not bloqueado then raise exception 'Anon autorizado';end if;
 reset role;
end;$$;
rollback;
select 'OK: exclusão, isolamento e preservação de venda; testes revertidos.' resultado;
