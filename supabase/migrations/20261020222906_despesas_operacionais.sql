-- Despesas da operação, com isolamento por titular e responsável.
create table public.despesas (
  id uuid primary key default gen_random_uuid(),
  titular_user_id uuid not null references public.perfis(user_id),
  responsavel_user_id uuid not null references auth.users(id),
  responsavel_nome text not null default '',
  grupo text not null check (grupo in ('Dia a dia', 'Administrativa')),
  categoria text not null,
  descricao text not null check (length(btrim(descricao)) between 1 and 160),
  valor_centavos bigint not null check (valor_centavos > 0 and valor_centavos <= 9999999999),
  data date not null check (data between date '1900-01-01' and date '2199-12-31'),
  vencimento date check (vencimento between date '1900-01-01' and date '2199-12-31'),
  status text not null default 'Pago' check (status in ('Pago','Pendente','Cancelado')),
  pago_em date check (pago_em between date '1900-01-01' and date '2199-12-31'),
  forma_pagamento text check (forma_pagamento in ('Pix','Dinheiro','Cartão de débito','Cartão de crédito','Boleto','Transferência','Outro')),
  fornecedor text not null default '' check (length(fornecedor) <= 160),
  documento text not null default '' check (length(documento) <= 80),
  observacao text not null default '' check (length(observacao) <= 2000),
  rota_id uuid references public.rotas_semanais(id),
  rota_nome text not null default '',
  criado_por_user_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint despesas_categoria_grupo check (
    (grupo='Dia a dia' and categoria in ('Combustível','Transporte','Pedágio','Estacionamento','Almoço','Lanche','Hospedagem','Manutenção do veículo','Outras despesas de campo'))
    or (grupo='Administrativa' and categoria in ('Contador','Impostos','CORE / Conselho','Telefone e internet','Sistemas e assinaturas','Aluguel','Material de escritório','Outras despesas administrativas'))
  ),
  constraint despesas_pagamento_coerente check (
    (status='Pago' and pago_em is not null and forma_pagamento is not null)
    or (status<>'Pago' and pago_em is null and forma_pagamento is null)
  ),
  constraint despesas_rota_campo check (rota_id is null or grupo='Dia a dia')
);

create index despesas_titular_data_idx on public.despesas(titular_user_id, data desc, id);
create index despesas_responsavel_data_idx on public.despesas(responsavel_user_id, data desc);
create index despesas_rota_idx on public.despesas(rota_id) where rota_id is not null;
create index despesas_criador_idx on public.despesas(criado_por_user_id);

alter table public.despesas enable row level security;
revoke all on public.despesas from anon, authenticated;
grant select, insert, update on public.despesas to authenticated;

create policy despesas_select on public.despesas for select to authenticated using (
  (select public.usuario_e_admin()) or titular_user_id=(select auth.uid())
  or (responsavel_user_id=(select auth.uid()) and public.preposto_tem_permissao(titular_user_id,'despesas','visualizar'))
);
create policy despesas_insert on public.despesas for insert to authenticated with check (
  (select public.usuario_e_admin()) or titular_user_id=(select auth.uid())
  or (responsavel_user_id=(select auth.uid())
      and public.preposto_tem_permissao(titular_user_id,'despesas','visualizar')
      and public.preposto_tem_permissao(titular_user_id,'despesas','cadastrar'))
);
create policy despesas_update on public.despesas for update to authenticated using (
  (select public.usuario_e_admin()) or titular_user_id=(select auth.uid())
  or (responsavel_user_id=(select auth.uid())
      and public.preposto_tem_permissao(titular_user_id,'despesas','visualizar')
      and public.preposto_tem_permissao(titular_user_id,'despesas','editar'))
) with check (
  (select public.usuario_e_admin()) or titular_user_id=(select auth.uid())
  or (responsavel_user_id=(select auth.uid())
      and public.preposto_tem_permissao(titular_user_id,'despesas','visualizar')
      and public.preposto_tem_permissao(titular_user_id,'despesas','editar'))
);

-- A função privada valida vínculos mesmo quando o usuário não pode ler a rota
-- diretamente. Não é uma API pública, não concede acesso a despesas e não pode
-- ser chamada pelo cliente; as políticas acima continuam a validar cada escrita.
create schema if not exists private;
create function private.validar_despesa_operacional() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_nome text;
  v_rota public.rotas_semanais%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sua sessão expirou.' using errcode='42501';
  end if;
  if tg_op='UPDATE' then
    if new.titular_user_id is distinct from old.titular_user_id
       or new.responsavel_user_id is distinct from old.responsavel_user_id then
      raise exception 'A operação e o responsável de uma despesa não podem ser transferidos.' using errcode='42501';
    end if;
    new.criado_por_user_id := old.criado_por_user_id;
    new.created_at := old.created_at;
    new.responsavel_nome := old.responsavel_nome;
  else
    if new.responsavel_user_id=new.titular_user_id then
      select nome into v_nome from public.perfis where user_id=new.titular_user_id;
    else
      select nome into v_nome from public.prepostos
      where titular_user_id=new.titular_user_id and user_id=new.responsavel_user_id and status='ativo';
    end if;
    if v_nome is null then
      raise exception 'Responsável sem vínculo ativo com esta operação.' using errcode='23514';
    end if;
    new.responsavel_nome := v_nome;
    new.criado_por_user_id := auth.uid();
    new.created_at := clock_timestamp();
  end if;
  if new.rota_id is not null then
    select * into v_rota from public.rotas_semanais where id=new.rota_id;
    if v_rota.id is null or v_rota.titular_user_id<>new.titular_user_id
        or v_rota.responsavel_user_id<>new.responsavel_user_id then
      raise exception 'A rota deve pertencer à mesma operação e ao mesmo responsável.' using errcode='23514';
    end if;
    if tg_op='UPDATE' and new.rota_id is not distinct from old.rota_id then
      new.rota_nome := old.rota_nome;
    else
      new.rota_nome := (array['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo'])[v_rota.dia_semana] || ' • ' || v_rota.municipio;
    end if;
  else
    new.rota_nome := '';
  end if;
  if new.status='Pago' and new.pago_em > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A data de pagamento não pode estar no futuro.' using errcode='23514';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function private.validar_despesa_operacional() from public, anon, authenticated;
create trigger validar_despesa_operacional before insert or update on public.despesas
for each row execute function private.validar_despesa_operacional();

-- Habilita o novo módulo nos vínculos existentes, preservando configurações
-- explícitas. O representante pode ajustar cada ação em Equipe.
update public.prepostos
set permissoes=coalesce(permissoes,'{}'::jsonb) || '{"despesas":{"visualizar":true,"cadastrar":true,"editar":true}}'::jsonb
where not (coalesce(permissoes,'{}'::jsonb) ? 'despesas');
