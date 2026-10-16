drop policy if exists clientes_preposto_select on public.clientes;
drop policy if exists clientes_preposto_insert on public.clientes;
drop policy if exists clientes_preposto_update on public.clientes;

create policy clientes_preposto_select on public.clientes
for select to authenticated
using (
  responsavel_user_id = (select auth.uid())
  and public.preposto_tem_permissao(user_id, 'clientes', 'visualizar')
);

create policy clientes_preposto_insert on public.clientes
for insert to authenticated
with check (
  responsavel_user_id = (select auth.uid())
  and criado_por_user_id = (select auth.uid())
  and public.preposto_tem_permissao(user_id, 'clientes', 'cadastrar')
);

create policy clientes_preposto_update on public.clientes
for update to authenticated
using (
  responsavel_user_id = (select auth.uid())
  and public.preposto_tem_permissao(user_id, 'clientes', 'editar')
)
with check (
  responsavel_user_id = (select auth.uid())
  and public.preposto_tem_permissao(user_id, 'clientes', 'editar')
);

drop policy if exists visitas_preposto_select on public.visitas;
drop policy if exists visitas_preposto_insert on public.visitas;
drop policy if exists visitas_preposto_update on public.visitas;

create policy visitas_preposto_select on public.visitas
for select to authenticated
using (
  responsavel_user_id = (select auth.uid())
  and public.preposto_tem_permissao(user_id, 'visitas', 'visualizar')
);

create policy visitas_preposto_insert on public.visitas
for insert to authenticated
with check (
  responsavel_user_id = (select auth.uid())
  and criado_por_user_id = (select auth.uid())
  and public.preposto_tem_permissao(user_id, 'visitas', 'cadastrar')
);

create policy visitas_preposto_update on public.visitas
for update to authenticated
using (
  responsavel_user_id = (select auth.uid())
  and public.preposto_tem_permissao(user_id, 'visitas', 'editar')
)
with check (
  responsavel_user_id = (select auth.uid())
  and public.preposto_tem_permissao(user_id, 'visitas', 'editar')
);
