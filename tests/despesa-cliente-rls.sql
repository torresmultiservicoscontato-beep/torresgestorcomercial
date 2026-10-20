begin;
do $$
declare
 c public.clientes%rowtype;
 outro uuid;
 despesa uuid;
 bloqueado boolean;
begin
 select cl.* into c from public.clientes cl join public.perfis p on p.user_id=cl.user_id
 where coalesce(cl.responsavel_user_id,cl.user_id)=cl.user_id and p.papel<>'admin' limit 1;
 if c.id is null then raise exception 'Cliente de teste indisponível.'; end if;
 select user_id into outro from public.perfis where user_id<>c.user_id and papel<>'admin' limit 1;
 if outro is null then raise exception 'Segunda operação indisponível.'; end if;
 perform set_config('request.jwt.claim.sub',c.user_id::text,true);
 set local role authenticated;
 insert into public.despesas(titular_user_id,responsavel_user_id,grupo,categoria,descricao,valor_centavos,data,status,cliente_id,cliente_nome)
 values(c.user_id,c.user_id,'Administrativa','Contador','Teste cliente opcional',100,current_date,'Pendente',c.id,'Nome forjado') returning id into despesa;
 if not exists(select 1 from public.despesas where id=despesa and cliente_nome=c.nome) then raise exception 'Nome não validado pelo servidor.'; end if;
 update public.despesas set cliente_nome='Alteração forjada' where id=despesa;
 if not exists(select 1 from public.despesas where id=despesa and cliente_nome=c.nome) then raise exception 'Histórico adulterado.'; end if;
 update public.despesas set cliente_id=null where id=despesa;
 if not exists(select 1 from public.despesas where id=despesa and cliente_id is null and cliente_nome='') then raise exception 'Remoção de vínculo falhou.'; end if;
 update public.despesas set cliente_id=c.id where id=despesa;
 perform set_config('request.jwt.claim.sub',outro::text,true);
 bloqueado:=false;
 begin
 insert into public.despesas(titular_user_id,responsavel_user_id,grupo,categoria,descricao,valor_centavos,data,status,cliente_id)
 values(outro,outro,'Dia a dia','Almoço','Vínculo proibido',100,current_date,'Pendente',c.id);
 exception when raise_exception then bloqueado:=true; end;
 if not bloqueado then raise exception 'Vínculo entre operações permitido.'; end if;
 reset role;
end;
$$;
rollback;
select 'OK: cliente opcional, nome do servidor, histórico, remoção e isolamento; testes revertidos.' as resultado;
