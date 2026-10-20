-- Vínculo opcional; lançamentos existentes continuam sem cliente.
alter table public.despesas
  add column cliente_id text,
  add column cliente_nome text not null default '',
  add constraint despesas_cliente_titular_fk foreign key (cliente_id, titular_user_id)
    references public.clientes(id, user_id);
create index despesas_cliente_titular_idx on public.despesas(cliente_id, titular_user_id) where cliente_id is not null;

create function private.validar_cliente_despesa()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  cliente public.clientes%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  if new.cliente_id is null then
    new.cliente_nome := '';
  elsif tg_op = 'UPDATE' and new.cliente_id is not distinct from old.cliente_id then
    -- Preserva o histórico mesmo que a carteira tenha mudado depois do gasto.
    new.cliente_nome := old.cliente_nome;
  else
    select * into cliente from public.clientes c
      where c.id = new.cliente_id and c.user_id = new.titular_user_id
      and coalesce(c.responsavel_user_id, c.user_id) = new.responsavel_user_id;
    if not found then raise exception 'Cliente não pertence à operação e ao responsável da despesa.'; end if;
    if auth.uid() <> new.titular_user_id and not public.usuario_e_admin() then
      if not coalesce(public.preposto_tem_permissao(new.titular_user_id, 'clientes', 'visualizar'), false)
        or not coalesce(public.preposto_tem_representada(new.titular_user_id, cliente.representada_id), false)
      then raise exception 'Sem permissão para vincular este cliente.'; end if;
    end if;
    new.cliente_nome := cliente.nome;
  end if;
  return new;
end;
$$;
revoke all on function private.validar_cliente_despesa() from public, anon, authenticated;
create trigger validar_cliente_despesa before insert or update on public.despesas
  for each row execute function private.validar_cliente_despesa();
