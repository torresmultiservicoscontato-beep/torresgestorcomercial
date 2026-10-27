# Índices e resumo de clientes — 27/10/2026

## Alterações

- Dez índices: seis para filtros por operação/responsável e ordenação das listas de clientes, visitas e vendas ativas; dois para última visita e próxima frequência pendente; dois para vínculos de vendas com clientes e itens de comissão com ordens.
- `carregar_resumo_clientes(text[], date)` retorna endereço, rota e duas datas, uma linha por cliente visível. Usa buscas ordenadas com `LIMIT 1` em vez de transferir todo o histórico.
- O frontend substitui três consultas de detalhes por uma RPC por lote de até 200 clientes. Mantém a data local enviada pelo navegador, a ordem da lista e os valores nulos. Falhas interrompem o carregamento, sem exibir resumo parcial como completo.
- A função é `SECURITY INVOKER`, com `search_path` vazio, acesso somente para `authenticated` e RLS preservada nas três tabelas. Não modifica políticas ou permissões de negócio.

## Validação e limites

- Build de produção e testes Node aprovados; ESLint do módulo alterado aprovado.
- `tests/resumo-clientes.sql`: 1.101 visitas temporárias, equivalência com consultas diretas sob RLS para os perfis existentes e usuário desconhecido; entrada vazia, IDs repetidos, limite por lote e bloqueio de anônimo. Tudo revertido com ROLLBACK.
- Dez índices válidos/prontos confirmados no catálogo.
- `tests/indices-planos.sql`: oito padrões de consulta possuem caminhos indexados sem ordenação separada. Desativa sequencial e Sort apenas na transação do diagnóstico. Não é benchmark: em tabelas pequenas o otimizador pode preferir varredura sequencial ou outro índice equivalente, e não se exige um índice específico no teste.
- A base tinha 9 clientes, 3 visitas e 3 vendas. Nenhum percentual de ganho de latência é alegado. Medir novamente com volume representativo antes de remover índices antigos ou fazer outras otimizações.
- Migração com lock_timeout de 3s e statement_timeout de 30s, apropriada ao volume atual. Em bases grandes, planejar criação concorrente dos índices fora de uma transação.
- A listagem principal ainda carrega dados com o limite existente da API. Esta alteração evita truncar o histórico usado nas duas datas, mas não implementa paginação no servidor para todas as listas.

## Diagnóstico ainda pendente

Os avisos de chaves estrangeiras sem índice caíram de 21 para 19. Os demais vínculos devem ser avaliados conforme uso, evitando indexar tudo indiscriminadamente. Permanecem 35 avisos de funções de autenticação reavaliadas por linha, 26 de políticas permissivas sobrepostas e avisos de índices sem uso registrado; a base pequena não permite concluir que estes índices sejam dispensáveis.

O diagnóstico de segurança também aponta funções antigas com permissões de execução e duas sem search_path fixo, além da proteção de senhas vazadas desativada. A revisão dessas funções permanece uma tarefa separada; esta alteração não declara a auditoria completa.

Referências: [otimização](https://supabase.com/docs/guides/database/query-optimization), [índices de chaves estrangeiras](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [RLS InitPlan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), [políticas sobrepostas](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies), [search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).

## Aplicação

A migração foi aplicada no projeto conectado. Para atualizar a aplicação no Codespaces, parar o servidor e executar `git pull --rebase --autostash origin main && npm run build && npm run dev`. Não é necessário executar SQL manualmente nesse projeto.

Para reverter o frontend, restaurar o módulo anterior. A função e os índices são aditivos e compatíveis com o código anterior; sua remoção deve ocorrer somente depois da reversão de todos os clientes.
