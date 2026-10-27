-- Small operational tables at deployment; fail quickly instead of blocking writes.
set local lock_timeout = '3s';
set local statement_timeout = '30s';

create index if not exists clientes_usuario_criacao_idx on public.clientes (user_id, created_at desc);
create index if not exists clientes_usuario_responsavel_criacao_idx on public.clientes (user_id, responsavel_user_id, created_at desc);
create index if not exists visitas_usuario_historico_idx on public.visitas (user_id, data desc, hora_entrada desc nulls last, created_at desc);
create index if not exists visitas_usuario_responsavel_historico_idx on public.visitas (user_id, responsavel_user_id, data desc, hora_entrada desc nulls last, created_at desc);
create index if not exists vendas_ativas_titular_historico_idx on public.vendas (titular_user_id, data desc, created_at desc) where ativa = true;
create index if not exists vendas_ativas_responsavel_historico_idx on public.vendas (titular_user_id, responsavel_user_id, data desc, created_at desc) where ativa = true;
create index if not exists visitas_cliente_data_idx on public.visitas (cliente_id, data desc);
create index if not exists agenda_frequencia_pendente_cliente_data_idx on public.agenda_eventos (cliente_id, data) where origem = 'frequencia' and status = 'Pendente';
-- Foreign keys used by client history and commission reconciliation.
create index if not exists vendas_cliente_idx on public.vendas (cliente_id);
create index if not exists venda_comissao_itens_ordem_idx on public.venda_comissao_itens (ordem_id);

-- One row per visible customer, instead of transferring the entire history.
-- Invoker is intentional: RLS applies independently to all three relations.
create or replace function public.carregar_resumo_clientes(p_ids text[], p_hoje date)
returns table (
  id text, logradouro text, numero text, complemento text, cep text,
  rota_id uuid, rota_ordem integer, latitude double precision, longitude double precision,
  ultima_visita date, proxima_visita_prevista date
)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if p_hoje is null or cardinality(p_ids) > 200 then
    raise exception 'Informe a data e no máximo 200 clientes por consulta.' using errcode = '22023';
  end if;
  return query
  select c.id, c.logradouro, c.numero, c.complemento, c.cep,
    c.rota_id, c.rota_ordem, c.latitude, c.longitude,
    (select v.data from public.visitas v where v.cliente_id = c.id order by v.data desc limit 1),
    (select a.data from public.agenda_eventos a where a.cliente_id = c.id
      and a.origem = 'frequencia' and a.status = 'Pendente' and a.data >= p_hoje
      order by a.data limit 1)
  from public.clientes c where c.id = any(p_ids);
end;
$$;
revoke all on function public.carregar_resumo_clientes(text[], date) from public, anon;
grant execute on function public.carregar_resumo_clientes(text[], date) to authenticated;

analyze public.clientes;
analyze public.visitas;
analyze public.vendas;
analyze public.agenda_eventos;
analyze public.venda_comissao_itens;
