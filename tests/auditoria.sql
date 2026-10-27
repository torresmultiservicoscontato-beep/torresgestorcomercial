begin;
do $$
declare v public.visitas; alvo text:='teste-auditoria-'||gen_random_uuid()::text;
 titular uuid; outro uuid; venda uuid; ordem uuid; total bigint; negado boolean;
begin
 select vi.* into strict v from public.visitas vi join public.perfis p on p.user_id=vi.user_id limit 1;
 titular:=v.user_id;
 perform set_config('request.jwt.claim.sub',titular::text,true);
 v.id:=alvo;v.responsavel_user_id:=titular;v.proxima_data:=null;
 insert into public.visitas select v.*;
 update public.visitas set observacao='Alteração auditada' where id=alvo;
 insert into public.vendas(titular_user_id,responsavel_user_id,visita_id,cliente_id,cliente_nome,data,valor)
 values(titular,titular,alvo,v.cliente_id,v.cliente_nome,current_date,10) returning id into venda;
 insert into public.venda_itens(venda_id,produto,origem) values(venda,'Item auditado','manual');
 delete from public.visitas where id=alvo;
 if (select count(*) from public.auditoria where tabela='visitas' and registro_id=alvo)<>3 then raise exception 'CRUD não registrado';end if;
 if exists(select 1 from public.auditoria where registro_id=alvo and (ator_user_id is distinct from titular or titular_user_id is distinct from titular)) then raise exception 'Autor ou operação incorretos';end if;
 if not exists(select 1 from public.auditoria where tabela='visitas' and registro_id=alvo and acao='UPDATE' and dados_antes->>'observacao' is not null and dados_depois->>'observacao'='Alteração auditada') then raise exception 'Antes/depois ausente';end if;
 if not exists(select 1 from public.auditoria where tabela='venda_itens' and dados_antes->>'venda_id'=venda::text and acao='DELETE' and titular_user_id=titular) then raise exception 'Cascata sem operação';end if;
 select count(*) into total from public.auditoria where transacao=txid_current();
 begin
  insert into public.visitas select v.*;
  raise exception 'Reverter subtransação';
 exception when raise_exception then null;end;
 if (select count(*) from public.auditoria where transacao=txid_current())<>total then raise exception 'Falha gerou auditoria persistida';end if;
 set local role authenticated;
 if (select count(*) from public.auditoria where registro_id=alvo)<>3 then raise exception 'Titular não consulta histórico';end if;
 negado:=false;
 begin delete from public.auditoria where registro_id=alvo;exception when insufficient_privilege then negado:=true;end;
 if not negado then raise exception 'Usuário apagou auditoria';end if;
 negado:=false;
 begin insert into public.auditoria(ator_nome,origem,tabela,registro_id,acao) values('falso','usuario','visitas','falso','DELETE');exception when insufficient_privilege then negado:=true;end;
 if not negado then raise exception 'Usuário forjou histórico';end if;
 reset role;
 select user_id into strict outro from public.perfis where user_id<>titular and papel<>'admin' limit 1;
 perform set_config('request.jwt.claim.sub',outro::text,true);
 set local role authenticated;
 if exists(select 1 from public.auditoria where registro_id=alvo) then raise exception 'Outra operação leu histórico';end if;
 reset role;
 perform set_config('request.jwt.claim.sub','',true);
 v.id:=alvo||'-sistema';insert into public.visitas select v.*;
 if not exists(select 1 from public.auditoria where registro_id=v.id and ator_user_id is null and origem='sistema') then raise exception 'Operação técnica atribuída incorretamente';end if;
end;$$;
rollback;
select 'OK: CRUD, autor, antes/depois, cascata, rollback, sistema, isolamento e histórico protegido; dados revertidos.' resultado;
