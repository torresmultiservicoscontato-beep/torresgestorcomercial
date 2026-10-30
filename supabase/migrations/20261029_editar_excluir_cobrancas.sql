GRANT DELETE ON public.cobrancas_assinatura TO authenticated;
CREATE POLICY cobrancas_admin_excluir ON public.cobrancas_assinatura FOR DELETE TO authenticated USING ((SELECT public.usuario_e_admin()) AND status <> 'paga');
CREATE OR REPLACE FUNCTION public.admin_alterar_cobranca(p_id uuid,p_status text,p_valor numeric,p_vencimento date,p_inicio date,p_fim date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.cobrancas_assinatura%ROWTYPE;
BEGIN
 IF NOT public.usuario_e_admin() THEN RAISE EXCEPTION 'Apenas administrador'; END IF;
 SELECT * INTO c FROM public.cobrancas_assinatura WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cobrança não localizada'; END IF;
 IF c.status='paga' THEN RAISE EXCEPTION 'Reverta o pagamento antes de editar'; END IF;
 IF p_status NOT IN ('pendente','vencida','cancelada') THEN RAISE EXCEPTION 'Para marcar como paga, registre o recebimento'; END IF;
 IF p_valor<0 OR p_fim<=p_inicio THEN RAISE EXCEPTION 'Valores ou período inválidos'; END IF;
 UPDATE public.cobrancas_assinatura SET status=p_status,valor=p_valor,vencimento_em=p_vencimento,periodo_inicio=p_inicio,periodo_fim=p_fim,updated_at=now() WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_alterar_cobranca(uuid,text,numeric,date,date,date) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.admin_alterar_cobranca(uuid,text,numeric,date,date,date) TO authenticated;
