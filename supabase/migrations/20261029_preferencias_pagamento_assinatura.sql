CREATE TABLE IF NOT EXISTS public.preferencias_pagamento_assinatura (
 titular_user_id uuid PRIMARY KEY REFERENCES public.perfis(user_id) ON DELETE CASCADE,
 forma_preferida text NOT NULL DEFAULT 'pix' CHECK (forma_preferida IN ('pix','boleto','cartao')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.preferencias_pagamento_assinatura ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.preferencias_pagamento_assinatura FROM public,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.preferencias_pagamento_assinatura TO authenticated;
CREATE POLICY preferencias_pagamento_ler ON public.preferencias_pagamento_assinatura FOR SELECT TO authenticated USING (titular_user_id=(SELECT auth.uid()) OR (SELECT public.usuario_e_admin()));
CREATE POLICY preferencias_pagamento_inserir ON public.preferencias_pagamento_assinatura FOR INSERT TO authenticated WITH CHECK (titular_user_id=(SELECT auth.uid()));
CREATE POLICY preferencias_pagamento_atualizar ON public.preferencias_pagamento_assinatura FOR UPDATE TO authenticated USING (titular_user_id=(SELECT auth.uid())) WITH CHECK (titular_user_id=(SELECT auth.uid()));
