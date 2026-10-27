create function public.atualizar_venda_com_itens(
 p_venda_id uuid, p_formas_pagamento text[], p_condicoes_prazo text[],
 p_situacao text, p_itens jsonb
) returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sessão obrigatória' using errcode='42501'; end if;
 if p_itens is null or jsonb_typeof(p_itens)<>'array' then
  raise exception 'Os itens da venda devem ser uma lista.' using errcode='22023';
 end if;
 -- O UPDATE verifica RLS e trava a venda até o fim da transação.
 update public.vendas
 set formas_pagamento=p_formas_pagamento, condicoes_prazo=p_condicoes_prazo,
 situacao=p_situacao, updated_at=now()
 where id=p_venda_id;
 if not found then
  raise exception 'Venda não encontrada ou sem permissão para editar.' using errcode='42501';
 end if;
 delete from public.venda_itens where venda_id=p_venda_id;
 insert into public.venda_itens(
 venda_id,representada_id,produto_id,produto,codigo,quantidade,unidade,
 valor_unitario,valor_total,origem,confirmado)
 select p_venda_id, nullif(i->>'representada_id','')::uuid,
 nullif(i->>'produto_id','')::uuid,trim(i->>'produto'),
 coalesce(i->>'codigo',''),nullif(i->>'quantidade','')::numeric,
 coalesce(i->>'unidade',''),nullif(i->>'valor_unitario','')::numeric,
 nullif(i->>'valor_total','')::numeric,'manual',true
 from jsonb_array_elements(p_itens) i
 where trim(coalesce(i->>'produto',''))<>'';
 -- Sem tratamento de exceção: falhas restauram a venda e todos os itens antigos.
end;$$;
revoke all on function public.atualizar_venda_com_itens(uuid,text[],text[],text,jsonb) from public,anon;
grant execute on function public.atualizar_venda_com_itens(uuid,text[],text[],text,jsonb) to authenticated;
