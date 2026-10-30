ALTER TABLE public.cobrancas_assinatura ADD COLUMN IF NOT EXISTS asaas_invoice_url text, ADD COLUMN IF NOT EXISTS asaas_billing_type text CHECK (asaas_billing_type IN ('PIX','BOLETO'));
CREATE TABLE IF NOT EXISTS public.asaas_clientes_sandbox(titular_user_id uuid PRIMARY KEY REFERENCES public.perfis(user_id),asaas_customer_id text NOT NULL UNIQUE,criado_em timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.asaas_clientes_sandbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.asaas_clientes_sandbox FROM public,anon,authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS cobrancas_asaas_id_unique ON public.cobrancas_assinatura(provedor_cobranca_id) WHERE provedor_cobranca_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.proteger_cobranca_asaas_sandbox() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.provedor_cobranca_id IS NOT NULL THEN RAISE EXCEPTION 'Cobrança emitida no Asaas: cancele primeiro no provedor'; END IF;
  RETURN OLD;
 END IF;
 IF OLD.provedor_cobranca_id IS NOT NULL AND (
  NEW.valor IS DISTINCT FROM OLD.valor OR NEW.vencimento_em IS DISTINCT FROM OLD.vencimento_em OR
  NEW.periodo_inicio IS DISTINCT FROM OLD.periodo_inicio OR NEW.periodo_fim IS DISTINCT FROM OLD.periodo_fim OR
  NEW.provedor_cobranca_id IS DISTINCT FROM OLD.provedor_cobranca_id
 ) THEN RAISE EXCEPTION 'Cobrança emitida no Asaas: edição exige sincronização no provedor'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proteger_cobranca_asaas_sandbox ON public.cobrancas_assinatura;
CREATE TRIGGER proteger_cobranca_asaas_sandbox BEFORE UPDATE OR DELETE ON public.cobrancas_assinatura FOR EACH ROW EXECUTE FUNCTION public.proteger_cobranca_asaas_sandbox();