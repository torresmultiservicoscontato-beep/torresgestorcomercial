begin;
do $$
declare v public.visitas; produto public.representada_produtos; venda uuid; itens jsonb; negado boolean;
begin
 select vi.* into strict v from public.visitas vi join public.perfis p on p.user_id=vi.user_id
 where exists(select 1 from public.representada_produtos rp where rp.titular_user_id=vi.user_id and rp.ativo) limit 1;
 select * into strict produto from public.representada_produtos where titular_user_id=v.user_id and ativo limit 1;
 perform set_config('request.jwt.claim.sub',v.user_id::text,true);
 v.id:='teste-lote-'||gen_random_uuid();v.houve_venda:=true;v.valor_venda:=1760;v.proxima_data:=null;v.responsavel_user_id:=v.user_id;
 insert into public.visitas select v.*;
 update public.representada_produtos set quantidade_minima=88 where id=produto.id;
 itens:=jsonb_build_array(jsonb_build_object('produtoId',produto.id,'produto',produto.nome,'representadaId',produto.representada_id,'quantidade','176','tamanhoLote',88,'quantidadeLotes','2','valorUnitario','10','valorTotal','1760'));
 set local role authenticated;
 venda:=public.salvar_detalhes_venda_visita(v.id,'{}','{}','Pedido lançado',itens);
 reset role;
 update public.representada_produtos set quantidade_minima=100 where id=produto.id;
 set local role authenticated;
 perform public.salvar_detalhes_venda_visita(v.id,'{}','{}','Pedido lançado',itens);
 reset role;
 if not exists(select 1 from public.venda_itens where venda_id=venda and tamanho_lote=88 and quantidade_lotes=2 and quantidade=176) then raise exception 'Catálogo alterou lote histórico';end if;
 set local role authenticated;
 perform public.atualizar_venda_com_itens(venda,'{}','{}','Pedido lançado',jsonb_build_array(jsonb_build_object('produto_id',produto.id,'produto',produto.nome,'representada_id',produto.representada_id,'quantidade',264,'tamanho_lote',88,'quantidade_lotes',3,'valor_unitario',10,'valor_total',2640)));
 negado:=false;
 begin
 perform public.atualizar_venda_com_itens(venda,'{}','{}','Pedido lançado','[{"produto":"Inválido","quantidade":176,"tamanho_lote":100,"quantidade_lotes":2}]');
 exception when check_violation then negado:=true;end;
 if not negado then raise exception 'Quantidade inconsistente aceita';end if;
 reset role;
 if not exists(select 1 from public.venda_itens where venda_id=venda and tamanho_lote=88 and quantidade_lotes=3 and quantidade=264) then raise exception 'Falha apagou lote';end if;
 set local role authenticated;
 perform public.atualizar_venda_com_itens(venda,'{}','{}','Pedido lançado','[{"produto":"Legado","quantidade":176}]');
 reset role;
 if not exists(select 1 from public.venda_itens where venda_id=venda and tamanho_lote is null and quantidade_lotes is null and quantidade=176) then raise exception 'Lote legado inventado';end if;
end;$$;
rollback;
select 'OK: lote histórico independente do catálogo, reedição, validação, rollback e legado sem inferência; tudo revertido.' resultado;
