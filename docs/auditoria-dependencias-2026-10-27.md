# Atualização e auditoria de dependências — 27/10/2026

- Next.js: 14.2.35 → 16.4.3 (versão estável consultada no npm).
- React e React DOM: 18.3.1 → 19.3.1; tipos React → 19.3.0.
- package-lock.json versionado para instalações reproduzíveis com npm ci.
- Node 22 LTS recomendado (.nvmrc); mínimo 22.18 para os testes TypeScript nativos.
- next lint substituído por ESLint CLI; adicionados comandos typecheck, test e test:ui.
- Configuração TypeScript atualizada pelo Next.js para o runtime JSX automático.

## Auditoria

Antes: 2 pacotes vulneráveis (next e postcss), 1 alerta crítico e 1 alto.
Depois: npm audit sem vulnerabilidades conhecidas, incluindo ferramentas de desenvolvimento.
Isso não substitui a revisão de autorização e segurança do código da aplicação.

Referências oficiais:
- https://nextjs.org/blog/nextjs-security-update-october-14-2026
- https://nextjs.org/docs/app/guides/upgrading/version-16

## Validação e limites

- Build de produção aprovado; páginas geradas, incluindo agenda, vendas, visitas e histórico.
- 16 testes de lógica/regressão aprovados.
- Servidor de produção iniciou usando hostname 127.0.0.1.
- Lint identifica dívida técnica existente: 16 erros e 4 avisos; regras não foram desativadas. Principalmente efeitos React com atualizações síncronas de estado. Revisão pendente, sem refatoração ampla nesta atualização.
- ESLint 9.39.5 mantido por compatibilidade declarada dos plugins do eslint-config-next; npm marca a linha como descontinuada. Atualizar para ESLint 10 quando os plugins suportarem essa versão.
- Testes visuais não concluídos: download do Chromium retornou arquivo inválido neste ambiente. Playwright agora é dependência de desenvolvimento explícita. Executar após instalar o navegador, com o app na porta 3100. Testes interceptam Supabase e não gravam dados reais.

## Atualizar o Codespaces

Pare o servidor com Ctrl+C. Na branch main, após preservar eventuais alterações locais:

```bash
git pull --rebase --autostash origin main
nvm install
nvm use
npm ci
npm run build
npm run dev
```

Para repetir as verificações:

```bash
npm audit
npm test
npm run typecheck
npm run lint
npx playwright install chromium
```

Em outro terminal, mantenha `npm run start -- --port 3100` aberto; execute `npm run test:ui`.
