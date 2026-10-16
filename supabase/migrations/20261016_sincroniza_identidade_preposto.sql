create or replace function public.sincronizar_identidade_preposto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.prepostos
  set nome = new.nome,
      email = lower(new.email),
      whatsapp = new.whatsapp,
      updated_at = now()
  where user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_sincronizar_identidade_preposto on public.preposto_perfis;
create trigger trg_sincronizar_identidade_preposto
after update of nome, email, whatsapp on public.preposto_perfis
for each row execute function public.sincronizar_identidade_preposto();
