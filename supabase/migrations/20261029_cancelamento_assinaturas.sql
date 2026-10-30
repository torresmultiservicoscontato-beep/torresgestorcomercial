CREATE TABLE IF NOT EXISTS public.cancelamentos_assinatura (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 titular_user_id uuid NOT NULL REFERENCES public.perfis(user_id),
 assinatura_id uuid NOT NULL REFERENCES public.assinaturas_contas(id),
 plano_id uuid NOT NULL REFERENCES public.planos_assinatura(id),
 solicitado_em timestamptz NOT NULL DEFAULT now(),
 encerramento_em date NOT NULL,
 exportacao_ate date NOT NULL,
 prazo_exportacao_dias integer NOT NULL,
 encerramento_regra text NOT NULL,
 status text NOT NULL DEFAULT 'registrado',
 CONSTRAINT cancelamentos_status_check CHECK(status IN ('registrado','processado'))
);
CREATE UNIQUE INDEX IF NOT EXISTS cancelamento_uma_vez_por_assinatura ON public.cancelamentos_assinatura(assinatura_id) WHERE status='registrado';
ALTER TABLE public.cancelamentos_assinatura ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cancelamentos_assinatura FROM public,anon,authenticated;
GRANT SELECT ON public.cancelamentos_assinatura TO authenticated;
CREATE POLICY cancelamentos_consulta ON public.cancelamentos_assinatura FOR SELECT TO authenticated USING(titular_user_id=(SELECT auth.uid()) OR (SELECT public.usuario_e_admin()));
CREATE OR REPLACE FUNCTION public.solicitar_cancelamento_assinatura()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.assinaturas_contas%ROWTYPE; p public.planos_assinatura%ROWTYPE; data_fim date; novo_id uuid;
BEGIN
 SELECT * INTO a FROM public.assinaturas_contas WHERE titular_user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR a.status NOT IN ('ativa','teste') THEN RAISE EXCEPTION 'Não existe assinatura ativa para cancelar'; END IF;
 SELECT * INTO p FROM public.planos_assinatura WHERE id=a.plano_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Plano não encontrado'; END IF;
 IF EXISTS (SELECT 1 FROM public.cancelamentos_assinatura c WHERE c.assinatura_id=a.id AND c.status='registrado') THEN RAISE EXCEPTION 'Cancelamento já registrado'; END IF;
 data_fim := CASE WHEN p.encerramento_acesso='fim_periodo_pago' AND a.vencimento_em>current_date THEN a.vencimento_em ELSE current_date END;
 INSERT INTO public.cancelamentos_assinatura(titular_user_id,assinatura_id,plano_id,encerramento_em,exportacao_ate,prazo_exportacao_dias,encerramento_regra)
 VALUES(auth.uid(),a.id,p.id,data_fim,data_fim+p.prazo_exportacao_dias,p.prazo_exportacao_dias,p.encerramento_acesso) RETURNING id INTO novo_id;
 IF data_fim=current_date THEN UPDATE public.assinaturas_contas SET status='cancelada',updated_at=now() WHERE id=a.id; END IF;
 RETURN novo_id;
END $$;
REVOKE ALL ON FUNCTION public.solicitar_cancelamento_assinatura() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.solicitar_cancelamento_assinatura() TO authenticated;