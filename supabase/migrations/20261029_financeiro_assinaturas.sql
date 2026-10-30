-- Financeiro de assinaturas, controle interno, sem integracao com gateway.
CREATE TABLE IF NOT EXISTS public.cobrancas_assinatura (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 assinatura_id uuid NOT NULL REFERENCES public.assinaturas_contas(id) ON DELETE RESTRICT,
 titular_user_id uuid NOT NULL REFERENCES public.perfis(user_id) ON DELETE RESTRICT,
 competencia date NOT NULL,
 periodo_inicio date NOT NULL,
 periodo_fim date NOT NULL,
 vencimento_em date NOT NULL,
 valor numeric(12,2) NOT NULL CHECK(valor>=0),
 status text NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','paga','vencida','cancelada')),
 pago_em timestamptz,
 meio_pagamento text,
 provedor text,
 provedor_cobranca_id text,
 observacoes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT cobranca_periodo_valido CHECK(periodo_fim>periodo_inicio),
 CONSTRAINT cobranca_pago_consistente CHECK((status='paga' AND pago_em IS NOT NULL) OR (status<>'paga' AND pago_em IS NULL)),
 CONSTRAINT cobranca_assinatura_competencia_unique UNIQUE(assinatura_id,competencia)
);
CREATE INDEX IF NOT EXISTS cobrancas_assinatura_titular_idx ON public.cobrancas_assinatura(titular_user_id,vencimento_em DESC);
CREATE INDEX IF NOT EXISTS cobrancas_assinatura_status_idx ON public.cobrancas_assinatura(status,vencimento_em);
ALTER TABLE public.cobrancas_assinatura ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cobrancas_assinatura FROM public,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.cobrancas_assinatura TO authenticated;
CREATE POLICY cobrancas_ler ON public.cobrancas_assinatura FOR SELECT TO authenticated
 USING(titular_user_id=(SELECT auth.uid()) OR (SELECT public.usuario_e_admin()));
CREATE POLICY cobrancas_admin_criar ON public.cobrancas_assinatura FOR INSERT TO authenticated
 WITH CHECK((SELECT public.usuario_e_admin()) AND EXISTS(SELECT 1 FROM public.assinaturas_contas a WHERE a.id=assinatura_id AND a.titular_user_id=titular_user_id));
CREATE POLICY cobrancas_admin_atualizar ON public.cobrancas_assinatura FOR UPDATE TO authenticated
 USING((SELECT public.usuario_e_admin())) WITH CHECK((SELECT public.usuario_e_admin()));
CREATE OR REPLACE FUNCTION public.admin_registrar_pagamento_cobranca(p_cobranca_id uuid,p_pago boolean,p_meio text DEFAULT null)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.cobrancas_assinatura%ROWTYPE;
BEGIN
 IF NOT public.usuario_e_admin() THEN RAISE EXCEPTION 'Apenas administrador'; END IF;
 SELECT * INTO c FROM public.cobrancas_assinatura WHERE id=p_cobranca_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cobrança inexistente'; END IF;
 IF c.status='cancelada' THEN RAISE EXCEPTION 'Cobrança cancelada'; END IF;
 IF p_pago THEN
   UPDATE public.cobrancas_assinatura SET status='paga',pago_em=COALESCE(pago_em,now()),meio_pagamento=COALESCE(p_meio,meio_pagamento),updated_at=now() WHERE id=c.id;
   UPDATE public.assinaturas_contas SET status='ativa',vencimento_em=greatest(COALESCE(vencimento_em,c.periodo_fim),c.periodo_fim),updated_at=now() WHERE id=c.assinatura_id AND status<>'cancelada';
 ELSE
   UPDATE public.cobrancas_assinatura SET status=CASE WHEN vencimento_em<current_date THEN 'vencida' ELSE 'pendente' END,pago_em=null,updated_at=now() WHERE id=c.id;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_registrar_pagamento_cobranca(uuid,boolean,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.admin_registrar_pagamento_cobranca(uuid,boolean,text) TO authenticated;
