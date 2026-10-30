CREATE TABLE IF NOT EXISTS public.chamados_suporte (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 assunto text NOT NULL CHECK (char_length(trim(assunto)) BETWEEN 5 AND 160),
 categoria text NOT NULL DEFAULT 'duvida' CHECK (categoria IN ('duvida','problema','financeiro','acesso','sugestao','privacidade')),
 descricao text NOT NULL CHECK (char_length(trim(descricao)) BETWEEN 10 AND 5000),
 status text NOT NULL DEFAULT 'aberto' CHECK(status IN ('aberto','em_atendimento','aguardando_usuario','resolvido','fechado')),
 resposta_admin text NOT NULL DEFAULT '',
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chamados_suporte ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chamados_suporte FROM public,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.chamados_suporte TO authenticated;
CREATE POLICY chamados_ver ON public.chamados_suporte FOR SELECT TO authenticated
 USING (usuario_id=(SELECT auth.uid()) OR (SELECT public.usuario_e_admin()));
CREATE POLICY chamados_criar ON public.chamados_suporte FOR INSERT TO authenticated
 WITH CHECK (usuario_id=(SELECT auth.uid()) AND status='aberto' AND resposta_admin='');
CREATE POLICY chamados_admin_atualizar ON public.chamados_suporte FOR UPDATE TO authenticated
 USING ((SELECT public.usuario_e_admin())) WITH CHECK ((SELECT public.usuario_e_admin()));
