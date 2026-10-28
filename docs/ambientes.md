# Ambientes — Torres Gestor Comercial

## Produção
- Código: branch `main`.
- Supabase exclusivo de produção: `sqlrhvxiluzgeldxcmyf`.
- `NEXT_PUBLIC_APP_ENV=production`.
- `NEXT_PUBLIC_SUPABASE_URL=https://sqlrhvxiluzgeldxcmyf.supabase.co`.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: chave **publishable** desse projeto, configurada no provedor de deploy.
- Usar apenas domínio oficial, dados reais, Auth e Storage de produção.

## Testes / homologação
- Código: branch `develop`.
- Criar um **projeto Supabase independente** (ou branch de banco isolada), com Auth, Storage, migrações e usuários de teste próprios. Não compartilhar URL, chaves ou dados de produção.
- `NEXT_PUBLIC_APP_ENV=test`.
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` devem apontar exclusivamente para o Supabase de testes.
- Configurar um deploy e domínio/subdomínio exclusivos para a branch `develop`.
- **Não importar dados pessoais reais** para testes.

## Promoção de alterações
1. Desenvolver em branch de funcionalidade derivada de `develop`, abrir PR para `develop` e validar testes automatizados.
2. Aplicar migrações **primeiro no Supabase de testes**, validar permissões/RLS, Auth, Storage, relatórios e fluxos de venda.
3. Homologar no deploy de testes antes de criar PR de `develop` para `main`.
4. Para produção, exigir revisão humana, backup e janela de aplicação das migrações; publicar o código correspondente apenas após validação.
5. Nunca rodar migrações destrutivas ou limpeza de Storage em produção como parte de testes.

## Variáveis e segurança
- Configurar URLs e chaves por **ambiente no provedor de deploy**. Nunca versionar `.env.local` ou chaves secretas/service_role.
- `NEXT_PUBLIC_*` é público no navegador: jamais colocar secrets nesses campos.
- O módulo `app/lib/supabase.ts` não possui mais fallback para produção; se as variáveis faltarem, o cliente não será inicializado.
- A aplicação bloqueia explicitamente `NEXT_PUBLIC_APP_ENV=test` ao apontar para o projeto de produção.
- GitHub Actions executa testes em PRs, sem credenciais de banco; isso **não** substitui a homologação funcional com uma base isolada.
- Configurar no GitHub a proteção da branch `main` e a obrigatoriedade de PR + checks. Configurar aprovação manual do deploy de produção no provedor de hospedagem.

## Pendências externas
- Provisionar Supabase de testes (pode gerar custos, depende de autorização).
- Aplicar todas as migrations no Supabase de testes e configurar bucket/policies.
- Configurar dois deployments e secrets ambientais no serviço de hospedagem.
- Habilitar branch protection e revisores no GitHub.
