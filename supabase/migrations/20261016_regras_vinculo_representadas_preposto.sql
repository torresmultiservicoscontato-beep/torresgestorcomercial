drop function if exists public.solicitar_vinculo_preposto(uuid,text,jsonb);
drop function if exists public.listar_vinculos_preposto_atual();

create or replace function public.listar_representadas_para_preposto(p_titular_user_id uuid,p_email text,p_vinculo_id uuid default null)
returns table(representada_id uuid,nome text,cnpj text,disponivel boolean)
language plpgsql security definer set search_path=public,auth as $$
declare v_preposto_user_id uuid;
begin
  if not (public.usuario_e_admin() or (auth.uid()=p_titular_user_id and exists(select 1 from public.perfis pf where pf.user_id=auth.uid()))) then
    raise exception 'Acesso negado para administrar esta equipe' using errcode='42501';
  end if;
  select pp.user_id into v_preposto_user_id from public.preposto_perfis pp where lower(pp.email)=lower(trim(p_email));
  if v_preposto_user_id is null then raise exception 'Nenhum preposto cadastrado com este e-mail'; end if;
  return query
  select rc.id,pr.nome,rc.cnpj,
    not exists(select 1 from public.preposto_representadas ppr where ppr.preposto_user_id=v_preposto_user_id and ppr.representada_id=rc.id and ppr.status in ('pendente','ativo') and (p_vinculo_id is null or ppr.vinculo_id<>p_vinculo_id))
  from public.perfil_representadas pr join public.representadas_catalogo rc on rc.id=pr.representada_id
  where pr.user_id=p_titular_user_id order by pr.nome;
end; $$;
revoke all on function public.listar_representadas_para_preposto(uuid,text,uuid) from public,anon;
grant execute on function public.listar_representadas_para_preposto(uuid,text,uuid) to authenticated;

create or replace function public.solicitar_vinculo_preposto(p_titular_user_id uuid,p_email text,p_permissoes jsonb,p_representadas uuid[])
returns table(id uuid,titular_user_id uuid,user_id uuid,nome text,email text,whatsapp text,status text,permissoes jsonb,created_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path=public,auth as $$
declare v_perfil public.preposto_perfis%rowtype; v_vinculo public.prepostos%rowtype; v_total_selecionadas integer; v_total_validas integer;
begin
  if not (public.usuario_e_admin() or (auth.uid()=p_titular_user_id and exists(select 1 from public.perfis pf where pf.user_id=auth.uid()))) then raise exception 'Acesso negado para administrar esta equipe' using errcode='42501'; end if;
  select * into v_perfil from public.preposto_perfis pp where lower(pp.email)=lower(trim(p_email));
  if v_perfil.user_id is null then raise exception 'Nenhum preposto cadastrado com este e-mail'; end if;
  if p_representadas is null or cardinality(p_representadas)=0 then raise exception 'Selecione pelo menos uma representada para o preposto'; end if;
  select count(distinct x) into v_total_selecionadas from unnest(p_representadas) x;
  select count(distinct pr.representada_id) into v_total_validas from public.perfil_representadas pr where pr.user_id=p_titular_user_id and pr.representada_id=any(p_representadas);
  if v_total_validas<>v_total_selecionadas then raise exception 'Uma ou mais representadas selecionadas não pertencem a este representante'; end if;
  if exists(select 1 from public.prepostos p where p.titular_user_id=p_titular_user_id and p.user_id=v_perfil.user_id and p.status in ('pendente','ativo','inativo')) then raise exception 'Este preposto já possui vínculo com esta operação'; end if;
  if exists(select 1 from public.preposto_representadas ppr where ppr.preposto_user_id=v_perfil.user_id and ppr.representada_id=any(p_representadas) and ppr.status in ('pendente','ativo')) then raise exception 'Uma ou mais representadas já estão vinculadas a este preposto em outra operação'; end if;
  delete from public.prepostos where titular_user_id=p_titular_user_id and user_id=v_perfil.user_id and status='recusado';
  insert into public.prepostos(titular_user_id,user_id,nome,email,whatsapp,status,permissoes)
  values(p_titular_user_id,v_perfil.user_id,v_perfil.nome,lower(v_perfil.email),v_perfil.whatsapp,'pendente',p_permissoes)
  returning * into v_vinculo;
  begin
    insert into public.preposto_representadas(vinculo_id,preposto_user_id,representada_id,status)
    select v_vinculo.id,v_perfil.user_id,x,'pendente' from (select distinct unnest(p_representadas) as x) selecionadas;
  exception when unique_violation then
    raise exception 'Uma das representadas acabou de ser vinculada a este preposto em outra operação. Atualize a tela e tente novamente.';
  end;
  return query select v_vinculo.id,v_vinculo.titular_user_id,v_vinculo.user_id,v_vinculo.nome,v_vinculo.email,v_vinculo.whatsapp,v_vinculo.status,v_vinculo.permissoes,v_vinculo.created_at,v_vinculo.updated_at;
end; $$;
revoke all on function public.solicitar_vinculo_preposto(uuid,text,jsonb,uuid[]) from public,anon;
grant execute on function public.solicitar_vinculo_preposto(uuid,text,jsonb,uuid[]) to authenticated;

create or replace function public.atualizar_vinculo_preposto(p_vinculo_id uuid,p_status text,p_permissoes jsonb,p_representadas uuid[])
returns table(id uuid,titular_user_id uuid,user_id uuid,nome text,email text,whatsapp text,status text,permissoes jsonb,created_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path=public,auth as $$
declare v_vinculo public.prepostos%rowtype; v_status_destino text; v_total_selecionadas integer; v_total_validas integer;
begin
  select p.* into v_vinculo from public.prepostos p where p.id=p_vinculo_id;
  if v_vinculo.id is null then raise exception 'Vínculo não encontrado'; end if;
  if not (public.usuario_e_admin() or (auth.uid()=v_vinculo.titular_user_id and exists(select 1 from public.perfis pf where pf.user_id=auth.uid()))) then raise exception 'Acesso negado para administrar este vínculo' using errcode='42501'; end if;
  if v_vinculo.status='pendente' then v_status_destino:='pendente'; elsif p_status in ('ativo','inativo') then v_status_destino:=p_status; else raise exception 'Status de vínculo inválido'; end if;
  if p_representadas is null or cardinality(p_representadas)=0 then raise exception 'Selecione pelo menos uma representada para o preposto'; end if;
  select count(distinct x) into v_total_selecionadas from unnest(p_representadas) x;
  select count(distinct pr.representada_id) into v_total_validas from public.perfil_representadas pr where pr.user_id=v_vinculo.titular_user_id and pr.representada_id=any(p_representadas);
  if v_total_validas<>v_total_selecionadas then raise exception 'Uma ou mais representadas selecionadas não pertencem a este representante'; end if;
  if v_status_destino in ('pendente','ativo') and exists(select 1 from public.preposto_representadas ppr where ppr.preposto_user_id=v_vinculo.user_id and ppr.representada_id=any(p_representadas) and ppr.status in ('pendente','ativo') and ppr.vinculo_id<>v_vinculo.id) then raise exception 'Uma ou mais representadas já estão vinculadas a este preposto em outra operação'; end if;
  delete from public.preposto_representadas ppr where ppr.vinculo_id=v_vinculo.id;
  insert into public.preposto_representadas(vinculo_id,preposto_user_id,representada_id,status)
  select v_vinculo.id,v_vinculo.user_id,x,v_status_destino from (select distinct unnest(p_representadas) as x) selecionadas;
  update public.prepostos p set status=v_status_destino,permissoes=p_permissoes,updated_at=now() where p.id=v_vinculo.id returning p.* into v_vinculo;
  return query select v_vinculo.id,v_vinculo.titular_user_id,v_vinculo.user_id,v_vinculo.nome,v_vinculo.email,v_vinculo.whatsapp,v_vinculo.status,v_vinculo.permissoes,v_vinculo.created_at,v_vinculo.updated_at;
end; $$;
revoke all on function public.atualizar_vinculo_preposto(uuid,text,jsonb,uuid[]) from public,anon;
grant execute on function public.atualizar_vinculo_preposto(uuid,text,jsonb,uuid[]) to authenticated;

create or replace function public.responder_vinculo_preposto(p_vinculo_id uuid,p_aceitar boolean)
returns void language plpgsql security definer set search_path=public,auth as $$
declare v_user_id uuid;
begin
  select p.user_id into v_user_id from public.prepostos p where p.id=p_vinculo_id and p.user_id=auth.uid() and p.status='pendente';
  if v_user_id is null then raise exception 'Convite pendente não encontrado'; end if;
  if p_aceitar and not exists(select 1 from public.preposto_representadas ppr where ppr.vinculo_id=p_vinculo_id) then raise exception 'Este convite ainda não possui representadas definidas'; end if;
  update public.prepostos set status=case when p_aceitar then 'ativo' else 'recusado' end,updated_at=now() where prepostos.id=p_vinculo_id;
  update public.preposto_representadas set status=case when p_aceitar then 'ativo' else 'recusado' end,updated_at=now() where vinculo_id=p_vinculo_id;
end; $$;
revoke all on function public.responder_vinculo_preposto(uuid,boolean) from public,anon;
grant execute on function public.responder_vinculo_preposto(uuid,boolean) to authenticated;

create function public.listar_vinculos_preposto_atual()
returns table(id uuid,titular_user_id uuid,nome_representante text,nome_representacao text,status text,permissoes jsonb,representadas text[],created_at timestamptz)
language sql stable security definer set search_path=public,auth as $$
  select p.id,p.titular_user_id,pf.nome,pf.nome_representacao,p.status,p.permissoes,
    coalesce(array_agg(rc.nome order by rc.nome) filter(where rc.id is not null),array[]::text[]),p.created_at
  from public.prepostos p join public.perfis pf on pf.user_id=p.titular_user_id
  left join public.preposto_representadas ppr on ppr.vinculo_id=p.id
  left join public.representadas_catalogo rc on rc.id=ppr.representada_id
  where p.user_id=auth.uid()
  group by p.id,p.titular_user_id,pf.nome,pf.nome_representacao,p.status,p.permissoes,p.created_at
  order by p.created_at desc;
$$;
revoke all on function public.listar_vinculos_preposto_atual() from public,anon;
grant execute on function public.listar_vinculos_preposto_atual() to authenticated;

create or replace function public.listar_representadas_do_vinculo(p_vinculo_id uuid)
returns table(nome text)
language sql stable security definer set search_path=public as $$
  select pr.nome from public.prepostos p
  join public.preposto_representadas ppr on ppr.vinculo_id=p.id
  join public.perfil_representadas pr on pr.user_id=p.titular_user_id and pr.representada_id=ppr.representada_id
  where p.id=p_vinculo_id and p.status='ativo' and ppr.status='ativo'
    and (p.user_id=auth.uid() or p.titular_user_id=auth.uid() or public.usuario_e_admin())
  order by pr.nome;
$$;
revoke all on function public.listar_representadas_do_vinculo(uuid) from public,anon;
grant execute on function public.listar_representadas_do_vinculo(uuid) to authenticated;
