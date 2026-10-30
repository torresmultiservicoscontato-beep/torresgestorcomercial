-- Torres Gestor Comercial: etapa de testes para solicitacoes de planos.
CREATE TABLE IF NOT EXISTS public.solicitacoes_troca_plano (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titular_user_id uuid NOT NULL REFERENCES public.perfis(user_id) ON DELETE CASCADE,
  plano_atual_id uuid REFERENCES public.planos_assinatura(id) ON DELETE SET NULL,
  plano_solicitado_id uuid NOT NULL REFERENCES public.planos_assinatura(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','recusada')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  respondido_em timestamptz,
  observacao_admin text NOT NULL DEFAULT '',
  CONSTRAINT troca_plano_diferente CHECK (plano_atual_id IS DISTINCT FROM plano_solicitado_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS solicitacoes_troca_plano_pendente_unique
  ON public.solicitacoes_troca_plano(titular_user_id) WHERE status='pendente';
ALTER TABLE public.solicitacoes_troca_plano ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.solicitacoes_troca_plano FROM public, anon, authenticated;
GRANT SELECT, INSERT ON public.solicitacoes_troca_plano TO authenticated;
DROP POLICY IF EXISTS solicitacoes_leitura ON public.solicitacoes_troca_plano;
CREATE POLICY solicitacoes_leitura ON public.solicitacoes_troca_plano FOR SELECT TO authenticated
USING (titular_user_id=(SELECT auth.uid()) OR (SELECT public.usuario_e_admin()));
DROP POLICY IF EXISTS solicitacoes_criacao ON public.solicitacoes_troca_plano;
CREATE POLICY solicitacoes_criacao ON public.solicitacoes_troca_plano FOR INSERT TO authenticated
WITH CHECK (
 titular_user_id=(SELECT auth.uid()) AND status='pendente'
 AND respondido_em IS NULL AND observacao_admin=''
 AND EXISTS (SELECT 1 FROM public.planos_assinatura p WHERE p.id=plano_solicitado_id AND p.ativo)
 AND plano_atual_id IS NOT DISTINCT FROM (SELECT a.plano_id FROM public.assinaturas_contas a WHERE a.titular_user_id=(SELECT auth.uid()))
);
DROP POLICY IF EXISTS planos_admin_select ON public.planos_assinatura;
CREATE POLICY planos_catalogo_visivel ON public.planos_assinatura FOR SELECT TO authenticated
USING (ativo OR (SELECT public.usuario_e_admin()));
DROP POLICY IF EXISTS assinaturas_admin_select ON public.assinaturas_contas;
CREATE POLICY assinaturas_propria_ou_admin ON public.assinaturas_contas FOR SELECT TO authenticated
USING (titular_user_id=(SELECT auth.uid()) OR (SELECT public.usuario_e_admin()));
CREATE OR REPLACE FUNCTION public.admin_responder_troca_plano(p_solicitacao_id uuid,p_aprovar boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.solicitacoes_troca_plano%ROWTYPE; p public.planos_assinatura%ROWTYPE;
BEGIN
 IF NOT public.usuario_e_admin() THEN RAISE EXCEPTION 'Acesso administrativo obrigatório'; END IF;
 SELECT * INTO s FROM public.solicitacoes_troca_plano WHERE id=p_solicitacao_id FOR UPDATE;
 IF NOT FOUND OR s.status<>'pendente' THEN RAISE EXCEPTION 'Solicitação indisponível'; END IF;
 IF p_aprovar THEN
   SELECT * INTO p FROM public.planos_assinatura WHERE id=s.plano_solicitado_id AND ativo;
   IF NOT FOUND THEN RAISE EXCEPTION 'Plano não está ativo'; END IF;
   INSERT INTO public.assinaturas_contas(titular_user_id,plano_id,status,valor_mensal)
   VALUES(s.titular_user_id,p.id,'ativa',p.preco_mensal)
   ON CONFLICT(titular_user_id) DO UPDATE
     SET plano_id=EXCLUDED.plano_id,status='ativa',
         valor_mensal=EXCLUDED.valor_mensal,updated_at=now();
 END IF;
 UPDATE public.solicitacoes_troca_plano SET
   status=CASE WHEN p_aprovar THEN 'aprovada' ELSE 'recusada' END,
   respondido_em=now() WHERE id=s.id;
END $$;
REVOKE ALL ON FUNCTION public.admin_responder_troca_plano(uuid,boolean) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.admin_responder_troca_plano(uuid,boolean) TO authenticated;
