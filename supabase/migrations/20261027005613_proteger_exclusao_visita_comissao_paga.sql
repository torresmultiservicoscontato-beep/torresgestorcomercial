create function private.bloquear_exclusao_visita_comissao_paga()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 -- Bloqueia as mesmas linhas usadas pela exclusão RPC; inserções de pagamentos
 -- precisam validar a FK da ordem e aguardam estes locks.
 perform 1 from public.vendas where visita_id = old.id for update;
 perform 1 from public.venda_ordens o
 join public.vendas v on v.id = o.venda_id
 where v.visita_id = old.id for update of o;
 if exists (
  select 1 from public.venda_comissao_pagamentos p
  join public.venda_ordens o on o.id = p.ordem_id
  join public.vendas v on v.id = o.venda_id
  where v.visita_id = old.id
 ) then
  raise exception 'Esta visita possui comissão paga ou recebida. Regularize os pagamentos no financeiro antes de excluir.'
   using errcode = '23514';
 end if;
 return old;
end;
$$;
revoke all on function private.bloquear_exclusao_visita_comissao_paga() from public, anon, authenticated;
create trigger bloquear_exclusao_visita_comissao_paga
 before delete on public.visitas
 for each row execute function private.bloquear_exclusao_visita_comissao_paga();
