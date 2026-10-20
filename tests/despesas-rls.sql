-- Teste de integração transacional. Executar como postgres; nenhum lançamento
-- de teste ou mudança de permissão permanece após o ROLLBACK.
begin;
do $$
declare
  v_titular uuid;
  v_preposto uuid;
  v_outro uuid;
  v_admin uuid;
  v_rota uuid;
  v_propria uuid;
  v_equipe uuid;
  v_quantidade integer;
  v_bloqueado boolean;
begin
  select p.titular_user_id,p.user_id into v_titular,v_preposto
  from public.prepostos p join public.perfis f on f.user_id=p.titular_user_id
  where p.status='ativo' and p.user_id is not null and f.papel<>'admin' limit 1;
  select user_id into v_outro from public.perfis where user_id<>v_titular and papel<>'admin' limit 1;
  select user_id into v_admin from public.perfis where papel='admin' limit 1;
  select id into v_rota from public.rotas_semanais where titular_user_id=v_titular and responsavel_user_id=v_titular limit 1;
  if v_titular is null or v_preposto is null or v_outro is null or v_admin is null or v_rota is null then
    raise exception 'Faltam usuários/rota para executar os cenários de isolamento.';
  end if;
  perform set_config('request.jwt.claim.sub',v_titular::text,true);
  set local role authenticated;
  insert into public.despesas(titular_user_id,responsavel_user_id,grupo,categoria,descricao,valor_centavos,data,status,rota_id)
  values(v_titular,v_titular,'Dia a dia','Combustível','Teste transacional representante',4500,current_date,'Pendente',v_rota) returning id into v_propria;
  insert into public.despesas(titular_user_id,responsavel_user_id,grupo,categoria,descricao,valor_centavos,data,status)
  values(v_titular,v_preposto,'Dia a dia','Almoço','Teste transacional preposto',2500,current_date,'Pendente') returning id into v_equipe;
  select count(*) into v_quantidade from public.despesas where id in(v_propria,v_equipe);
  if v_quantidade<>2 then raise exception 'Representante deve consultar suas despesas e as da equipe.'; end if;

  perform set_config('request.jwt.claim.sub',v_preposto::text,true);
  select count(*) into v_quantidade from public.despesas where id in(v_propria,v_equipe);
  if v_quantidade<>1 then raise exception 'Preposto viu uma despesa de outro responsável.'; end if;
  update public.despesas set valor_centavos=3000 where id=v_equipe;
  get diagnostics v_quantidade=row_count;
  if v_quantidade<>1 then raise exception 'Preposto não conseguiu editar sua despesa.'; end if;
  update public.despesas set valor_centavos=999 where id=v_propria;
  get diagnostics v_quantidade=row_count;
  if v_quantidade<>0 then raise exception 'Preposto editou despesa do representante.'; end if;
  v_bloqueado:=false;
  begin
    insert into public.despesas(titular_user_id,responsavel_user_id,grupo,categoria,descricao,valor_centavos,data,status)
    values(v_titular,v_titular,'Dia a dia','Almoço','Teste proibido',100,current_date,'Pendente');
  exception when insufficient_privilege then v_bloqueado:=true; end;
  if not v_bloqueado then raise exception 'Preposto criou despesa em nome de outro.'; end if;
  v_bloqueado:=false;
  begin update public.despesas set responsavel_user_id=v_titular where id=v_equipe;
  exception when insufficient_privilege then v_bloqueado:=true; end;
  if not v_bloqueado then raise exception 'Transferência indevida de responsável permitida.'; end if;
  v_bloqueado:=false;
  begin update public.despesas set rota_id=v_rota where id=v_equipe;
  exception when check_violation then v_bloqueado:=true; end;
  if not v_bloqueado then raise exception 'Despesa vinculada à rota de outro responsável.'; end if;

  perform set_config('request.jwt.claim.sub',v_outro::text,true);
  select count(*) into v_quantidade from public.despesas where id in(v_propria,v_equipe);
  if v_quantidade<>0 then raise exception 'Vazamento de despesas entre operações.'; end if;
  update public.despesas set valor_centavos=999 where id=v_equipe;
  get diagnostics v_quantidade=row_count;
  if v_quantidade<>0 then raise exception 'Edição indevida entre operações.'; end if;

  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  select count(*) into v_quantidade from public.despesas where id in(v_propria,v_equipe);
  if v_quantidade<>2 then raise exception 'Administrador não conseguiu consultar a operação.'; end if;

  perform set_config('request.jwt.claim.sub',v_titular::text,true);
  update public.prepostos set permissoes=jsonb_set(permissoes,'{despesas}', '{"visualizar":true,"cadastrar":false,"editar":false}'::jsonb)
  where titular_user_id=v_titular and user_id=v_preposto;
  perform set_config('request.jwt.claim.sub',v_preposto::text,true);
  update public.despesas set valor_centavos=999 where id=v_equipe;
  get diagnostics v_quantidade=row_count;
  if v_quantidade<>0 then raise exception 'Preposto editou sem permissão.'; end if;
  v_bloqueado:=false;
  begin
    insert into public.despesas(titular_user_id,responsavel_user_id,grupo,categoria,descricao,valor_centavos,data,status)
    values(v_titular,v_preposto,'Dia a dia','Almoço','Teste proibido',100,current_date,'Pendente');
  exception when insufficient_privilege then v_bloqueado:=true; end;
  if not v_bloqueado then raise exception 'Preposto cadastrou sem permissão.'; end if;

  perform set_config('request.jwt.claim.sub',v_titular::text,true);
  update public.prepostos set permissoes=jsonb_set(permissoes,'{despesas,visualizar}','false'::jsonb)
  where titular_user_id=v_titular and user_id=v_preposto;
  perform set_config('request.jwt.claim.sub',v_preposto::text,true);
  select count(*) into v_quantidade from public.despesas where id=v_equipe;
  if v_quantidade<>0 then raise exception 'Preposto consultou sem permissão.'; end if;

  perform set_config('request.jwt.claim.sub',v_titular::text,true);
  v_bloqueado:=false;
  begin update public.despesas set valor_centavos=-1 where id=v_propria;
  exception when check_violation then v_bloqueado:=true; end;
  if not v_bloqueado then raise exception 'Valor negativo aceito.'; end if;
  v_bloqueado:=false;
  begin update public.despesas set status='Pago' where id=v_propria;
  exception when check_violation then v_bloqueado:=true; end;
  if not v_bloqueado then raise exception 'Despesa paga sem data/forma aceita.'; end if;
  update public.despesas set status='Pago',pago_em=current_date,forma_pagamento='Pix' where id=v_propria;
  update public.despesas set status='Cancelado',pago_em=null,forma_pagamento=null where id=v_propria;
  if not exists(select 1 from public.despesas where id=v_propria and status='Cancelado') then raise exception 'Cancelamento não preservou lançamento.'; end if;
  v_bloqueado:=false;
  begin delete from public.despesas where id=v_propria;
  exception when insufficient_privilege then v_bloqueado:=true; end;
  if not v_bloqueado then raise exception 'Exclusão física permitida.'; end if;
  reset role;
  set local role anon;
  v_bloqueado:=false;
  begin perform * from public.despesas limit 1;
  exception when insufficient_privilege then v_bloqueado:=true; end;
  if not v_bloqueado then raise exception 'Consulta anônima permitida.'; end if;
  reset role;
end;
$$;
rollback;
select 'OK: isolamento, permissões, vínculos, valores e pagamento; testes revertidos.' as resultado;
