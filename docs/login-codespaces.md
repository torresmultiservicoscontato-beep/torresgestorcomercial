# Login no Codespaces — develop

## Diagnóstico e correções

Não foi possível inspecionar a máquina Codespaces do usuário. No ambiente desta investigação não havia `.env.local` nem variáveis Supabase injetadas. A `develop` não tem fallback de produção, portanto sem configuração o cliente é nulo. O formulário anteriormente aceitava o clique e retornava sem mensagem. Configuração parcial ou ambiente incompatível também lançava exceção na importação do módulo, podendo impedir a renderização.

Agora configurações ausentes/inválidas desativam o cliente e exibem um alerta no login, sem derrubar a página. O botão fica desabilitado. O isolamento por host continua obrigatório. Placeholders dos exemplos são rejeitados. O login trata falhas de rede, credenciais inválidas e rejeições na verificação inicial da sessão. A consulta inicial não chama mais `signOut` quando não encontra sessão, evitando que uma verificação atrasada limpe um login em andamento. Falhas ao consultar perfis não são mais convertidas silenciosamente em “perfil inexistente”.

A conexão HTTPS ao Auth de testes foi bloqueada pela política de saída deste ambiente (`CONNECT 403`). Isso não demonstra indisponibilidade do Supabase ou bloqueio no Codespaces. Sem chave e conta de testes, autenticação real permanece não validada.

## Configurar e testar no Codespaces

1. Preserve alterações locais e abra `develop` (`git switch develop`). Use Node 22.18+ (`nvm install && nvm use`, quando disponível) e `npm ci`.
2. Crie `.env.local` a partir de `.env.test.example` somente se o arquivo local ainda não existir. Se já existir, edite-o preservando as demais configurações. Nunca versione esse arquivo.
3. Configure `NEXT_PUBLIC_APP_ENV=test`, `NEXT_PUBLIC_SUPABASE_URL=https://bwoxqsbqbtrkfvrsswrq.supabase.co` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` com a chave pública real **do projeto de testes**, obtida no painel desse projeto. Remova placeholders. Não use chave `service_role` nem credenciais de produção. A chave pública não cria usuários nem transfere usuários entre projetos.
4. Se usar Codespaces Secrets, habilite o acesso para este repositório e reinicie o Codespace após alterá-los. Confira apenas a presença dos nomes das variáveis; não publique valores. Variáveis exportadas podem prevalecer sobre `.env.local`.
5. Pare o Next.js e reinicie com `npm run dev -- --hostname 0.0.0.0 --port 3000`. Abra a porta 3000 pelo painel **Ports** do Codespaces e acesse `/login`. Mantenha a visibilidade da porta privada. Variáveis `NEXT_PUBLIC_*` são incorporadas ao navegador: um build antigo exige novo `npm run build` e reinício de `npm run start`, não apenas alterar a variável do processo.
6. Entre com uma conta exclusivamente de testes, com e-mail confirmado se exigido pelo Supabase. Se necessário, crie uma conta fictícia no projeto de testes e conclua seu cadastro. Contas existentes em produção não existem automaticamente em testes.
7. No DevTools, confira Console e Network. O botão deve fazer `POST` para `https://bwoxqsbqbtrkfvrsswrq.supabase.co/auth/v1/token?grant_type=password`. `Invalid API key` indica chave inválida/incompatível; credenciais inválidas exigem conferir a conta de testes; erro de rede exige verificar acesso ao host de testes. Nunca exponha senha, tokens ou cabeçalhos em capturas.
8. Para cadastro com confirmação e recuperação de senha, configure no **Supabase de testes** as URLs de redirecionamento HTTPS do Codespace para `/login` e `/redefinir-senha`. Login por e-mail/senha não depende de um callback OAuth; esses ajustes não corrigem chave ou senha inválidas.

## Regressões automatizadas

- `npm test`: inclui validação de configuração incompleta, exemplos, URL inválida, host de produção rejeitado em test, HTTPS e alias anon. Não faz chamadas reais.
- `npm run typecheck`, `node scripts/check-environment.cjs` e `npm run build`.
- `tests/login-ui.cjs`: exige app na porta 3100. Use `NEXT_PUBLIC_APP_ENV=test`, a URL de testes acima e uma chave pública fictícia como `sb_publishable_mock_login_only` **somente no build isolado destinado aos mocks**, sem contas reais. Compile e inicie com `npm run start -- --port 3100`. Em outro terminal, execute `node tests/login-ui.cjs`. O teste intercepta todas as APIs externas e valida senha inválida, chave inválida, falha de rede, falha de consulta de perfil e sucesso com redirecionamento. Não testa as permissões da página de destino, substituída por uma página de teste.
- Instale o Chromium com `npx playwright install chromium` ou informe um navegador instalado: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node tests/login-ui.cjs`.
- Para validar a configuração ausente, compile separadamente com URL e chaves vazias, reinicie o servidor e execute `LOGIN_EXPECT_UNCONFIGURED=1 node tests/login-ui.cjs`. O teste exige alerta e botão desabilitado, sem chamadas externas.
- Antes de voltar ao login real, remova a chave fictícia e reinicie/recompile com a chave do projeto de testes. Não reutilize um build de mocks para homologação real.

O lint mantém os 16 erros e 4 avisos anteriores, fora das linhas alteradas no login. Nenhuma migração, cópia de usuários, alteração em main ou publicação é necessária para repetir estes testes.
