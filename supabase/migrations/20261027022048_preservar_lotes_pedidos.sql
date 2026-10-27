alter table public.venda_itens add column tamanho_lote numeric, add column quantidade_lotes numeric;
alter table public.venda_itens add constraint venda_itens_lotes_validos check (
 (tamanho_lote is null and quantidade_lotes is null) or
 (tamanho_lote is not null and quantidade_lotes is not null and quantidade is not null
 and tamanho_lote > 0 and tamanho_lote < 'Infinity'::numeric
 and quantidade_lotes > 0 and quantidade_lotes <= 9007199254740991
 and trunc(quantidade_lotes)=quantidade_lotes
 and quantidade = round(tamanho_lote * quantidade_lotes,3))
);
comment on column public.venda_itens.tamanho_lote is 'Tamanho do lote no pedido; não deve ser recalculado pelo catálogo atual. NULL em itens legados sem informação.';
CREATE OR REPLACE FUNCTION public.atualizar_venda_com_itens(p_venda_id uuid, p_formas_pagamento text[], p_condicoes_prazo text[], p_situacao text, p_itens jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
 valor_unitario,valor_total,origem,confirmado,tamanho_lote,quantidade_lotes)
 select p_venda_id, nullif(i->>'representada_id','')::uuid,
 nullif(i->>'produto_id','')::uuid,trim(i->>'produto'),
 coalesce(i->>'codigo',''),nullif(i->>'quantidade','')::numeric,
 coalesce(i->>'unidade',''),nullif(i->>'valor_unitario','')::numeric,
 nullif(i->>'valor_total','')::numeric,'manual',true,
 nullif(i->>'tamanho_lote','')::numeric,nullif(i->>'quantidade_lotes','')::numeric
 from jsonb_array_elements(p_itens) i
 where trim(coalesce(i->>'produto',''))<>'';
 -- Sem tratamento de exceção: falhas restauram a venda e todos os itens antigos.
end;$function$;
CREATE OR REPLACE FUNCTION public.salvar_detalhes_venda_visita(p_visita_id text, p_formas_pagamento text[] DEFAULT '{}'::text[], p_condicoes_prazo text[] DEFAULT '{}'::text[], p_situacao text DEFAULT 'Pedido lançado'::text, p_itens jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_visita public.visitas%rowtype;
  v_venda public.vendas%rowtype;
  v_item jsonb;
  v_representada uuid;
  v_produto_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida' using errcode='42501';
  end if;

  select * into v_visita from public.visitas where id = p_visita_id;
  if v_visita.id is null then
    raise exception 'Visita não encontrada';
  end if;

  if not (
    public.usuario_e_admin()
    or (
      v_visita.user_id = auth.uid()
      and exists (select 1 from public.perfis pf where pf.user_id = auth.uid())
    )
    or (
      coalesce(v_visita.responsavel_user_id, v_visita.user_id) = auth.uid()
      and public.preposto_tem_permissao(
        v_visita.user_id,
        'vendas',
        case
          when exists(select 1 from public.vendas vx where vx.visita_id=p_visita_id)
          then 'editar'
          else 'cadastrar'
        end
      )
    )
  ) then
    raise exception 'Você não possui permissão para salvar esta venda' using errcode='42501';
  end if;

  if not coalesce(v_visita.houve_venda,false) then
    update public.vendas
       set ativa=false, situacao='Cancelada', updated_at=now()
     where visita_id=p_visita_id;

    select * into v_venda
    from public.vendas
    where visita_id=p_visita_id;

    return v_venda.id;
  end if;

  insert into public.vendas(
    titular_user_id,responsavel_user_id,visita_id,cliente_id,cliente_nome,data,valor,
    formas_pagamento,condicoes_prazo,situacao,ativa,origem
  ) values (
    v_visita.user_id,
    coalesce(v_visita.responsavel_user_id,v_visita.user_id),
    v_visita.id,
    v_visita.cliente_id,
    v_visita.cliente_nome,
    v_visita.data,
    greatest(coalesce(v_visita.valor_venda,0),0),
    coalesce(p_formas_pagamento,'{}'),
    coalesce(p_condicoes_prazo,'{}'),
    coalesce(nullif(trim(p_situacao),''),'Pedido lançado'),
    true,
    'visita'
  )
  on conflict (visita_id) do update set
    titular_user_id=excluded.titular_user_id,
    responsavel_user_id=excluded.responsavel_user_id,
    cliente_id=excluded.cliente_id,
    cliente_nome=excluded.cliente_nome,
    data=excluded.data,
    valor=excluded.valor,
    formas_pagamento=excluded.formas_pagamento,
    condicoes_prazo=excluded.condicoes_prazo,
    situacao=excluded.situacao,
    ativa=true,
    updated_at=now()
  returning * into v_venda;

  delete from public.venda_representadas
  where venda_id=v_venda.id;

  insert into public.venda_representadas(venda_id,representada_id)
  select v_venda.id, vr.representada_id
  from public.visita_representadas vr
  where vr.visita_id=p_visita_id
  on conflict do nothing;

  delete from public.venda_itens
  where venda_id=v_venda.id
    and origem='visita';

  if jsonb_typeof(coalesce(p_itens,'[]'::jsonb))='array' then
    for v_item in
      select value
      from jsonb_array_elements(coalesce(p_itens,'[]'::jsonb))
    loop
      if trim(coalesce(v_item->>'produto',''))='' then
        continue;
      end if;

      begin
        v_representada := nullif(v_item->>'representadaId','')::uuid;
      exception when invalid_text_representation then
        v_representada := null;
      end;

      begin
        v_produto_id := nullif(v_item->>'produtoId','')::uuid;
      exception when invalid_text_representation then
        v_produto_id := null;
      end;

      if v_produto_id is not null then
        if not exists (
          select 1
          from public.representada_produtos rp
          where rp.id=v_produto_id
            and rp.titular_user_id=v_visita.user_id
            and rp.ativo=true
            and (v_representada is null or rp.representada_id=v_representada)
        ) then
          raise exception 'Produto selecionado não pertence ao catálogo ativo desta operação';
        end if;

        select rp.representada_id
        into v_representada
        from public.representada_produtos rp
        where rp.id=v_produto_id;
      end if;

      insert into public.venda_itens(
        venda_id,
        representada_id,
        produto_id,
        produto,
        codigo,
        quantidade,
        unidade,
        valor_unitario,
        valor_total,
        origem,
        confirmado,
        tamanho_lote,
        quantidade_lotes
      ) values (
        v_venda.id,
        v_representada,
        v_produto_id,
        trim(v_item->>'produto'),
        trim(coalesce(v_item->>'codigo','')),
        nullif(v_item->>'quantidade','')::numeric,
        trim(coalesce(v_item->>'unidade','')),
        nullif(v_item->>'valorUnitario','')::numeric,
        nullif(v_item->>'valorTotal','')::numeric,
        'visita',
        true,
        nullif(v_item->>'tamanhoLote','')::numeric,
        nullif(v_item->>'quantidadeLotes','')::numeric
      );
    end loop;
  end if;

  return v_venda.id;
end;
$function$;
