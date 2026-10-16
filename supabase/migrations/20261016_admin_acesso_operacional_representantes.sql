create policy perfis_admin_all
on public.perfis
for all
to authenticated
using (public.usuario_e_admin())
with check (public.usuario_e_admin());

create policy perfil_representadas_admin_all
on public.perfil_representadas
for all
to authenticated
using (public.usuario_e_admin())
with check (public.usuario_e_admin());

create policy clientes_admin_all
on public.clientes
for all
to authenticated
using (public.usuario_e_admin())
with check (public.usuario_e_admin());

create policy visitas_admin_all
on public.visitas
for all
to authenticated
using (public.usuario_e_admin())
with check (public.usuario_e_admin());
