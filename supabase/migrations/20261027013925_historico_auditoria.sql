create table public.auditoria (
 id bigint generated always as identity primary key,
 ocorrido_em timestamptz not null default clock_timestamp(),
 transacao bigint not null default txid_current(),
 ator_user_id uuid, ator_nome text not null, origem text not null,
 titular_user_id uuid, tabela text not null, registro_id text not null,
 acao text not null check (acao in ('INSERT','UPDATE','DELETE')),
 dados_antes jsonb, dados_depois jsonb
);
create index auditoria_operacao_data on public.auditoria(titular_user_id,ocorrido_em desc,id desc);
create index auditoria_transacao on public.auditoria(transacao,tabela);
alter table public.auditoria enable row level security;
revoke all on public.auditoria from public,anon,authenticated;
grant select on public.auditoria to authenticated;
create policy auditoria_leitura on public.auditoria for select to authenticated
using (public.usuario_e_admin() or (titular_user_id=(select auth.uid()) and exists(select 1 from public.perfis p where p.user_id=(select auth.uid()))));

create function private.auditoria_titular(p_tabela text,p_dados jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare pai text; campo text; chave text; dados jsonb; titular uuid;
begin
 case p_tabela
 when 'clientes' then return nullif(p_dados->>'user_id','')::uuid;
 when 'visitas' then return nullif(p_dados->>'user_id','')::uuid;
 when 'perfis' then return nullif(p_dados->>'user_id','')::uuid;
 when 'perfil_representadas' then return nullif(p_dados->>'user_id','')::uuid;
 when 'preposto_perfis' then return nullif(p_dados->>'user_id','')::uuid;
 when 'vendas' then return nullif(p_dados->>'titular_user_id','')::uuid;
 when 'rotas_semanais' then return nullif(p_dados->>'titular_user_id','')::uuid;
 when 'agenda_eventos' then return nullif(p_dados->>'titular_user_id','')::uuid;
 when 'despesas' then return nullif(p_dados->>'titular_user_id','')::uuid;
 when 'prepostos' then return nullif(p_dados->>'titular_user_id','')::uuid;
 when 'relatorios_favoritos' then return nullif(p_dados->>'titular_user_id','')::uuid;
 when 'representada_operacoes' then return nullif(p_dados->>'titular_user_id','')::uuid;
 when 'representada_produtos' then return nullif(p_dados->>'titular_user_id','')::uuid;
 when 'cliente_representadas' then pai:='clientes';campo:='cliente_id';chave:='id';
 when 'visita_representadas' then pai:='visitas';campo:='visita_id';chave:='id';
 when 'rota_representadas' then pai:='rotas_semanais';campo:='rota_id';chave:='id';
 when 'venda_itens' then pai:='vendas';campo:='venda_id';chave:='id';
 when 'venda_ordens' then pai:='vendas';campo:='venda_id';chave:='id';
 when 'venda_anexos' then pai:='vendas';campo:='venda_id';chave:='id';
 when 'venda_representadas' then pai:='vendas';campo:='venda_id';chave:='id';
 when 'venda_recebimentos' then pai:='venda_ordens';campo:='ordem_id';chave:='id';
 when 'venda_comissao_itens' then pai:='venda_ordens';campo:='ordem_id';chave:='id';
 when 'venda_comissao_pagamentos' then pai:='venda_ordens';campo:='ordem_id';chave:='id';
 when 'preposto_representadas' then pai:='prepostos';campo:='vinculo_id';chave:='id';
 when 'preposto_produto_comissoes' then pai:='prepostos';campo:='vinculo_id';chave:='id';
 when 'representadas_catalogo' then return null;
 else raise exception 'Tabela não configurada para auditoria: %',p_tabela;
 end case;
 execute format('select to_jsonb(t) from public.%I t where to_jsonb(t)->>%L=$1',pai,chave)
 into dados using p_dados->>campo;
 if dados is not null then return private.auditoria_titular(pai,dados);end if;
 -- O registro do pai é escrito BEFORE DELETE, antes da cascata das FKs.
 select a.titular_user_id into titular from public.auditoria a
 where a.transacao=txid_current() and a.tabela=pai and a.acao='DELETE'
 and a.dados_antes->>chave=p_dados->>campo order by a.id desc limit 1;
 if not found then raise exception 'Operação do registro não encontrada para auditoria';end if;
 return titular;
end;$$;
create function private.registrar_auditoria()
returns trigger language plpgsql security definer set search_path='' as $$
declare anterior jsonb; posterior jsonb; dados jsonb; ator uuid:=auth.uid(); nome text; chave jsonb;
begin
 if tg_op<>'INSERT' then anterior:=to_jsonb(old);end if;
 if tg_op<>'DELETE' then posterior:=to_jsonb(new);end if;
 if tg_op='UPDATE' and (anterior-'updated_at')=(posterior-'updated_at') then return new;end if;
 dados:=coalesce(posterior,anterior);
 select coalesce((select p.nome from public.perfis p where p.user_id=ator),
 (select p.nome from public.preposto_perfis p where p.user_id=ator),
 case when ator is null then 'Sistema / operação técnica' else ator::text end) into nome;
 select jsonb_object_agg(a.attname,dados->a.attname) into chave
 from pg_catalog.pg_index i join pg_catalog.pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey)
 where i.indrelid=tg_relid and i.indisprimary;
 insert into public.auditoria(ator_user_id,ator_nome,origem,titular_user_id,tabela,registro_id,acao,dados_antes,dados_depois)
 values(ator,nome,case when ator is null then 'sistema' else 'usuario' end,
 private.auditoria_titular(tg_table_name,dados),tg_table_name,
 coalesce(dados->>'id',chave::text),tg_op,anterior,posterior);
 if tg_op='DELETE' then return old;end if;
 return new;
end;$$;
revoke all on function private.auditoria_titular(text,jsonb),private.registrar_auditoria() from public,anon,authenticated;
create trigger auditoria_gravacao after insert or update on public.clientes for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.clientes for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.visitas for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.visitas for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.perfis for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.perfis for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.perfil_representadas for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.perfil_representadas for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.preposto_perfis for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.preposto_perfis for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.vendas for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.vendas for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.rotas_semanais for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.rotas_semanais for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.agenda_eventos for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.agenda_eventos for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.despesas for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.despesas for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.prepostos for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.prepostos for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.relatorios_favoritos for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.relatorios_favoritos for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.representada_operacoes for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.representada_operacoes for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.representada_produtos for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.representada_produtos for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.cliente_representadas for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.cliente_representadas for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.visita_representadas for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.visita_representadas for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.rota_representadas for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.rota_representadas for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.venda_itens for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.venda_itens for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.venda_ordens for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.venda_ordens for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.venda_anexos for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.venda_anexos for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.venda_representadas for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.venda_representadas for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.venda_recebimentos for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.venda_recebimentos for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.venda_comissao_itens for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.venda_comissao_itens for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.venda_comissao_pagamentos for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.venda_comissao_pagamentos for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.preposto_representadas for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.preposto_representadas for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.preposto_produto_comissoes for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.preposto_produto_comissoes for each row execute function private.registrar_auditoria();
create trigger auditoria_gravacao after insert or update on public.representadas_catalogo for each row execute function private.registrar_auditoria();
create trigger auditoria_exclusao before delete on public.representadas_catalogo for each row execute function private.registrar_auditoria();
