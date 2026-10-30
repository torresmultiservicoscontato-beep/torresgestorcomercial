ALTER TABLE public.chamados_suporte ADD COLUMN IF NOT EXISTS etiqueta text NOT NULL DEFAULT 'normal' CHECK (etiqueta IN ('baixa','normal','alta','urgente'));
CREATE INDEX IF NOT EXISTS chamados_suporte_status_data_idx ON public.chamados_suporte(status,criado_em DESC);
DROP POLICY IF EXISTS chamados_admin_excluir ON public.chamados_suporte;
CREATE POLICY chamados_admin_excluir ON public.chamados_suporte FOR DELETE TO authenticated USING ((SELECT public.usuario_e_admin()));
GRANT DELETE ON public.chamados_suporte TO authenticated;
