create function public.salvar_visita_venda_atomica(p_id text, p_titular_user_id uuid, p_responsavel_user_id uuid, p_cliente_id text, p_data date, p_resultado text, p_representadas uuid[], p_hora_entrada time without time zone, p_hora_saida time without time zone, p_odometro_chegada numeric, p_origem_cliente_id text, p_destino_cliente_id text, p_tipo_contato text, p_houve_venda boolean, p_valor_venda numeric, p_origem_venda text, p_proxima_acao text, p_proxima_data date, p_frequencia text, p_status_cliente text, p_observacao text,
 p_formas_pagamento text[], p_condicoes_prazo text[], p_situacao text, p_itens jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_resultado jsonb;
begin
 if auth.uid() is null then raise exception 'Sessão obrigatória' using errcode='42501'; end if;
 if p_itens is null or jsonb_typeof(p_itens) <> 'array' then
  raise exception 'Os itens da venda devem ser uma lista.' using errcode='22023';
 end if;
 -- As funções chamadas mantêm as validações de conta, carteira e permissões.
 -- Não capturar exceções: qualquer falha reverte visita, agenda, venda e itens.
 select to_jsonb(v) into v_resultado
 from public.salvar_visita_completa_v2(p_id, p_titular_user_id, p_responsavel_user_id, p_cliente_id, p_data, p_resultado, p_representadas, p_hora_entrada, p_hora_saida, p_odometro_chegada, p_origem_cliente_id, p_destino_cliente_id, p_tipo_contato, p_houve_venda, p_valor_venda, p_origem_venda, p_proxima_acao, p_proxima_data, p_frequencia, p_status_cliente, p_observacao) v;
 perform public.salvar_detalhes_venda_visita(
  p_id, p_formas_pagamento, p_condicoes_prazo, p_situacao, p_itens
 );
 return v_resultado;
end;
$$;
revoke all on function public.salvar_visita_venda_atomica(text, uuid, uuid, text, date, text, uuid[], time without time zone, time without time zone, numeric, text, text, text, boolean, numeric, text, text, date, text, text, text, text[], text[], text, jsonb) from public, anon;
grant execute on function public.salvar_visita_venda_atomica(text, uuid, uuid, text, date, text, uuid[], time without time zone, time without time zone, numeric, text, text, text, boolean, numeric, text, text, date, text, text, text, text[], text[], text, jsonb) to authenticated;
