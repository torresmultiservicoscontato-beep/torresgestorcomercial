-- Torres Gestor Comercial — somente TESTES na implantacao inicial.
-- O acesso as tabelas depende de public.usuario_e_admin().
CREATE TABLE IF NOT EXISTS public.planos_assinatura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text NOT NULL DEFAULT '',
  preco_mensal numeric(12,2) NOT NULL DEFAULT 0 CHECK (preco_mensal >= 0),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.assinaturas_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titular_user_id uuid NOT NULL UNIQUE REFERENCES public.perfis(user_id) ON DELETE CASCADE,
  plano_id uuid REFERENCES public.planos_assinatura(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK(status IN ('pendente','ativa','atrasada','suspensa','cancelada','teste')),
  inicio_em date,
  vencimento_em date,
  valor_mensal numeric(12,2) NOT NULL DEFAULT 0 CHECK(valor_mensal >= 0),
  observacoes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assinaturas_contas_status_idx ON public.assinaturas_contas(status);
CREATE INDEX IF NOT EXISTS assinaturas_contas_vencimento_idx ON public.assinaturas_contas(vencimento_em);
ALTER TABLE public.planos_assinatura ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas_contas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.planos_assinatura,public.assinaturas_contas FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.planos_assinatura,public.assinaturas_contas TO authenticated;
DROP POLICY IF EXISTS planos_admin_select ON public.planos_assinatura;
CREATE POLICY planos_admin_select ON public.planos_assinatura FOR SELECT TO authenticated USING ((SELECT public.usuario_e_admin()));
DROP POLICY IF EXISTS planos_admin_insert ON public.planos_assinatura;
CREATE POLICY planos_admin_insert ON public.planos_assinatura FOR INSERT TO authenticated WITH CHECK ((SELECT public.usuario_e_admin()));
DROP POLICY IF EXISTS planos_admin_update ON public.planos_assinatura;
CREATE POLICY planos_admin_update ON public.planos_assinatura FOR UPDATE TO authenticated USING ((SELECT public.usuario_e_admin())) WITH CHECK ((SELECT public.usuario_e_admin()));
DROP POLICY IF EXISTS planos_admin_delete ON public.planos_assinatura;
CREATE POLICY planos_admin_delete ON public.planos_assinatura FOR DELETE TO authenticated USING ((SELECT public.usuario_e_admin()));
DROP POLICY IF EXISTS assinaturas_admin_select ON public.assinaturas_contas;
CREATE POLICY assinaturas_admin_select ON public.assinaturas_contas FOR SELECT TO authenticated USING ((SELECT public.usuario_e_admin()));
DROP POLICY IF EXISTS assinaturas_admin_insert ON public.assinaturas_contas;
CREATE POLICY assinaturas_admin_insert ON public.assinaturas_contas FOR INSERT TO authenticated WITH CHECK ((SELECT public.usuario_e_admin()));
DROP POLICY IF EXISTS assinaturas_admin_update ON public.assinaturas_contas;
CREATE POLICY assinaturas_admin_update ON public.assinaturas_contas FOR UPDATE TO authenticated USING ((SELECT public.usuario_e_admin())) WITH CHECK ((SELECT public.usuario_e_admin()));
DROP POLICY IF EXISTS assinaturas_admin_delete ON public.assinaturas_contas;
CREATE POLICY assinaturas_admin_delete ON public.assinaturas_contas FOR DELETE TO authenticated USING ((SELECT public.usuario_e_admin()));
