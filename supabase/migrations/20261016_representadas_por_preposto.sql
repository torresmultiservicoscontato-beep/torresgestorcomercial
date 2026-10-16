create or replace function public.normalizar_representada(p_valor text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(
    translate(lower(trim(coalesce(p_valor, ''))),'áàãâäéèêëíìîïóòõôöúùûüç','aaaaaeeeeiiiiooooouuuuc'),
    '[^a-z0-9]+','','g'
  );
$$;

create table if not exists public.representadas_catalogo (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nome_normalizado text not null unique,
  cnpj text,
  cnpj_normalizado text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists representadas_catalogo_cnpj_unique_idx
  on public.representadas_catalogo(cnpj_normalizado)
  where cnpj_normalizado is not null and cnpj_normalizado <> '';

alter table public.representadas_catalogo enable row level security;
grant select on public.representadas_catalogo to authenticated;

alter table public.perfil_representadas
  add column if not exists representada_id uuid references public.representadas_catalogo(id) on delete restrict;

insert into public.representadas_catalogo (nome, nome_normalizado)
select min(pr.nome), public.normalizar_representada(pr.nome)
from public.perfil_representadas pr
where public.normalizar_representada(pr.nome) <> ''
group by public.normalizar_representada(pr.nome)
on conflict (nome_normalizado) do nothing;

update public.perfil_representadas pr
set representada_id = rc.id
from public.representadas_catalogo rc
where pr.representada_id is null
  and rc.nome_normalizado = public.normalizar_representada(pr.nome);

create unique index if not exists perfil_representadas_user_representada_unique_idx
  on public.perfil_representadas(user_id, representada_id)
  where representada_id is not null;

create or replace function public.perfil_representada_resolver_catalogo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_chave text; v_id uuid;
begin
  v_chave := public.normalizar_representada(new.nome);
  if v_chave = '' then raise exception 'Nome da representada inválido'; end if;
  select id into v_id from public.representadas_catalogo where nome_normalizado = v_chave;
  if v_id is null then
    insert into public.representadas_catalogo(nome,nome_normalizado)
    values(trim(new.nome),v_chave) returning id into v_id;
  end if;
  new.representada_id := v_id;
  return new;
end;
$$;

drop trigger if exists perfil_representadas_resolver_catalogo_trg on public.perfil_representadas;
create trigger perfil_representadas_resolver_catalogo_trg
before insert or update of nome on public.perfil_representadas
for each row execute function public.perfil_representada_resolver_catalogo();

create table if not exists public.preposto_representadas (
  id uuid primary key default gen_random_uuid(),
  vinculo_id uuid not null references public.prepostos(id) on delete cascade,
  preposto_user_id uuid not null references auth.users(id) on delete cascade,
  representada_id uuid not null references public.representadas_catalogo(id) on delete restrict,
  status text not null default 'pendente' check (status in ('pendente','ativo','inativo','recusado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(vinculo_id,representada_id)
);

create unique index if not exists preposto_representada_conflito_unique_idx
  on public.preposto_representadas(preposto_user_id,representada_id)
  where status in ('pendente','ativo');
create index if not exists preposto_representadas_vinculo_idx on public.preposto_representadas(vinculo_id);
create index if not exists preposto_representadas_user_idx on public.preposto_representadas(preposto_user_id);
create index if not exists preposto_representadas_representada_idx on public.preposto_representadas(representada_id);

alter table public.preposto_representadas enable row level security;
grant select on public.preposto_representadas to authenticated;

create policy preposto_representadas_select on public.preposto_representadas
for select to authenticated
using (
  preposto_user_id = auth.uid()
  or public.usuario_e_admin()
  or exists(select 1 from public.prepostos p where p.id=preposto_representadas.vinculo_id and p.titular_user_id=auth.uid())
);

create policy representadas_catalogo_select_vinculadas on public.representadas_catalogo
for select to authenticated
using (
  public.usuario_e_admin()
  or exists(select 1 from public.perfil_representadas pr where pr.representada_id=representadas_catalogo.id and pr.user_id=auth.uid())
  or exists(select 1 from public.preposto_representadas ppr where ppr.representada_id=representadas_catalogo.id and ppr.preposto_user_id=auth.uid())
);

alter table public.clientes add column if not exists representada_id uuid references public.representadas_catalogo(id) on delete restrict;
update public.clientes c set representada_id=pr.representada_id
from public.perfil_representadas pr
where c.representada_id is null and pr.user_id=c.user_id
  and public.normalizar_representada(pr.nome)=public.normalizar_representada(c.representada);

create or replace function public.cliente_resolver_representada()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  select pr.representada_id into v_id from public.perfil_representadas pr
  where pr.user_id=new.user_id and public.normalizar_representada(pr.nome)=public.normalizar_representada(new.representada) limit 1;
  if v_id is null then raise exception 'Representada não pertence à operação selecionada'; end if;
  new.representada_id:=v_id; return new;
end; $$;

drop trigger if exists cliente_resolver_representada_trg on public.clientes;
create trigger cliente_resolver_representada_trg before insert or update of user_id,representada on public.clientes
for each row execute function public.cliente_resolver_representada();

alter table public.visitas add column if not exists representada_id uuid references public.representadas_catalogo(id) on delete restrict;
update public.visitas v set representada_id=c.representada_id
from public.clientes c where v.representada_id is null and c.id=v.cliente_id and c.user_id=v.user_id;

create or replace function public.visita_resolver_representada()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  select c.representada_id into v_id from public.clientes c where c.id=new.cliente_id and c.user_id=new.user_id;
  if v_id is null then raise exception 'Cliente ou representada da visita não encontrados'; end if;
  new.representada_id:=v_id; return new;
end; $$;

drop trigger if exists visita_resolver_representada_trg on public.visitas;
create trigger visita_resolver_representada_trg before insert or update of user_id,cliente_id on public.visitas
for each row execute function public.visita_resolver_representada();

create or replace function public.preposto_tem_representada(p_titular_user_id uuid,p_representada_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.prepostos p
    join public.preposto_representadas ppr on ppr.vinculo_id=p.id
    join public.perfil_representadas pr on pr.user_id=p.titular_user_id and pr.representada_id=ppr.representada_id
    where p.user_id=auth.uid() and p.titular_user_id=p_titular_user_id and p.status='ativo'
      and ppr.preposto_user_id=auth.uid() and ppr.representada_id=p_representada_id and ppr.status='ativo'
  );
$$;
revoke all on function public.preposto_tem_representada(uuid,uuid) from public,anon;
grant execute on function public.preposto_tem_representada(uuid,uuid) to authenticated;

drop policy if exists clientes_preposto_select on public.clientes;
drop policy if exists clientes_preposto_insert on public.clientes;
drop policy if exists clientes_preposto_update on public.clientes;
create policy clientes_preposto_select on public.clientes for select to authenticated using(responsavel_user_id=auth.uid() and public.preposto_tem_permissao(user_id,'clientes','visualizar') and public.preposto_tem_representada(user_id,representada_id));
create policy clientes_preposto_insert on public.clientes for insert to authenticated with check(responsavel_user_id=auth.uid() and criado_por_user_id=auth.uid() and public.preposto_tem_permissao(user_id,'clientes','cadastrar') and public.preposto_tem_representada(user_id,representada_id));
create policy clientes_preposto_update on public.clientes for update to authenticated using(responsavel_user_id=auth.uid() and public.preposto_tem_permissao(user_id,'clientes','editar') and public.preposto_tem_representada(user_id,representada_id)) with check(responsavel_user_id=auth.uid() and public.preposto_tem_permissao(user_id,'clientes','editar') and public.preposto_tem_representada(user_id,representada_id));

drop policy if exists visitas_preposto_select on public.visitas;
drop policy if exists visitas_preposto_insert on public.visitas;
drop policy if exists visitas_preposto_update on public.visitas;
create policy visitas_preposto_select on public.visitas for select to authenticated using(responsavel_user_id=auth.uid() and public.preposto_tem_permissao(user_id,'visitas','visualizar') and public.preposto_tem_representada(user_id,representada_id));
create policy visitas_preposto_insert on public.visitas for insert to authenticated with check(responsavel_user_id=auth.uid() and criado_por_user_id=auth.uid() and public.preposto_tem_permissao(user_id,'visitas','cadastrar') and public.preposto_tem_representada(user_id,representada_id));
create policy visitas_preposto_update on public.visitas for update to authenticated using(responsavel_user_id=auth.uid() and public.preposto_tem_permissao(user_id,'visitas','editar') and public.preposto_tem_representada(user_id,representada_id)) with check(responsavel_user_id=auth.uid() and public.preposto_tem_permissao(user_id,'visitas','editar') and public.preposto_tem_representada(user_id,representada_id));

create or replace function public.proteger_representada_em_uso()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.representada_id is not null and exists(
    select 1 from public.prepostos p join public.preposto_representadas ppr on ppr.vinculo_id=p.id
    where p.titular_user_id=old.user_id and ppr.representada_id=old.representada_id
      and p.status in ('pendente','ativo') and ppr.status in ('pendente','ativo')
  ) then
    raise exception 'Esta representada está vinculada a um preposto. Remova ou altere o vínculo na Equipe antes de excluir a representada.';
  end if;
  return old;
end; $$;

drop trigger if exists proteger_representada_em_uso_trg on public.perfil_representadas;
create trigger proteger_representada_em_uso_trg before delete on public.perfil_representadas
for each row execute function public.proteger_representada_em_uso();
