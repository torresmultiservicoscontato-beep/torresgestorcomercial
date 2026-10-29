# Instalação vazia do ambiente de testes

## Escopo atual e estado verificado

Prioridade: estrutura completa em `bwoxqsbqbtrkfvrsswrq`, código `develop`, sem copiar usuários, hashes/senhas, clientes, visitas, vendas, agenda ou documentos. Os planos anteriores em docs/migracao-producao-testes são históricos e NÃO devem ser executados para este pedido. Produção `sqlrhvxiluzgeldxcmyf` e main ficam somente para consulta.

Estado: **NÃO IMPLANTADO; fluxo real bloqueado pela ausência do schema e de acesso DDL.** Nesta sessão nenhuma migração remota foi executada, nenhum usuário criado e nenhum dado copiado. O probe remoto limit=0 retornou PGRST205 para preposto_perfis, perfis, perfil_representadas, prepostos, clientes, visitas, vendas, agenda_eventos, representadas_catalogo e venda_anexos. Isso confirma ausência no schema cache visível ao cliente; catálogos administrativos são necessários para distinguir tabela inexistente de estrutura não exposta/reload pendente.

A chave pública e HTTPS de testes estão disponíveis e permitiram reproduzir o erro. Não há ferramenta administrativa Supabase disponibilizada nesta sessão, token Management API, conexão PostgreSQL/arquivo pgpass de origem/destino ou grants TCP. A API GitHub negou leitura dos nomes de Actions Secrets (403), portanto não foi possível reutilizar credenciais eventualmente existentes lá. Não se presume que inexistam em outro cofre.

## Causa estrutural

`supabase/schema.sql` só cria clientes e visitas. A migração de preposto_perfis também depende de prepostos, perfis e usuario_e_admin; copiá-la isoladamente não resolve a instalação.

A auditoria estática do snapshot versionado aponta 27 tabelas e 66 nomes de funções exigidos, mas faltam CREATE TABLE de 14 tabelas e definições de 31 funções no conjunto SQL versionado. Há 22 arquivos com versão duplicada 20261016. Arquivos com mesmo dia também não estão necessariamente em ordem de dependência. Nenhum `supabase db push`/ordenação alfabética desse conjunto é uma instalação reproduzível e validada.

O snapshot TypeScript não registra todos os defaults, constraints, triggers, policies, grants, owners ou corpos de funções. Ele é usado para detectar lacunas, NUNCA para inventar DDL ou afirmar equivalência de segurança com produção. A paridade remota ainda não foi atestada.

## Ferramentas preparadas

- `npm run schema:audit`: identifica lacunas estáticas e versões repetidas, sem acessar rede.
- `npm run schema:contract`: atualiza supabase/tests/required-schema.sql a partir dos nomes/colunas do snapshot; isso gera consulta de diagnóstico, não uma migração.
- `npm run test:environment`: valida guardas anti-produção/saída sem credenciais e sincronização desse contrato.
- `npm run schema:probe`: GET limit=0 em dez tabelas de testes, sem obter linhas ou invocar RPCs. Recusa ambiente/URL diferentes antes de qualquer request. HTTP 200 não é teste funcional e 401/403 não é classificado como tabela ausente.
- `supabase/tests/required-schema.sql`: catálogo READ ONLY das 27 tabelas, colunas, 66 nomes de funções, RLS/policies/grant SELECT e schemas gerenciados. Objetos presentes ainda exigem revisão de assinaturas e predicados; esse SQL não aplica correções.
- `scripts/export-schema-only.sh`: exportação oficial pg_dump 17 somente de estrutura em conexão já autorizada. Retém ACL/owners no arquivo, recusa destino incorreto, senha em variável, ausência de TLS verify-full, pgpass sem modo 0600 ou saída dentro do checkout. Não lê o conteúdo do pgpass nem cria roles. Gera archive custom, catálogo e SHA-256 em diretório protegido. Nenhum dado de tabela ou senha global de role é solicitado. O arquivo inclui estrutura dos schemas gerenciados apenas para revisão, não para replay integral.

## Acesso que falta para executar

É necessário disponibilizar (A) exportação schema-only confiável da origem e (B) uma conexão capaz de executar DDL SOMENTE no destino. A senha original de postgres da origem não é exigência se houver outra credencial já autorizada com permissões suficientes para exportar estrutura.

Usar cofre/runner efêmero para montar PGPASSFILE (0600) e CA, com endpoint/usuário não secretos fornecidos separadamente. O proxy de segredos HTTPS não fornece automaticamente uma senha real à libpq. Não colocar senha em NEXT_PUBLIC, chat, Git, URL de comando ou workflow. Autorizar TCP/TLS apenas para os Session Poolers confirmados. Para uma alternativa administrativa HTTPS, a conexão/Management API precisa estar efetivamente disponível e permitir leitura do schema da origem e DDL no destino; não basta o aplicativo conectado em outro chat.

Não usar a CLI sem senha contra produção como atalho: ela pode criar role temporária. Não criar roles, mudar RLS, redefinir senha, habilitar BYPASSRLS ou copiar usuários para obter o schema. Exportação schema-only foi ensaiada localmente com role não privilegiada, SELECT e RLS habilitada; os privilégios reais ainda precisam de inspeção. Se não houver acesso de leitura existente, o limite deve ser resolvido pelo administrador sem alterar produção por este procedimento.

## Procedimento de instalação após liberar o acesso

1. Confirmar no controle oficial a referência de ambos os projetos, host/tenant/porta dos poolers e versões. O instalador futuro deve aceitar exclusivamente bwoxqsbqbtrkfvrsswrq como destino. current_database=postgres não prova identidade. Fazer diagnóstico READ ONLY no destino antes de DDL.
2. Confirmar inventário de dados pré-existentes no destino (Auth e módulos) sem mostrar valores. Se houver contas ou registros de testes já criados, preservar e apresentar plano aditivo; não apagar banco/usuários para torná-lo vazio. Criar backup protegido da estrutura/configurações de testes antes de qualquer mudança.
3. Exportar schema-only com PostgreSQL Client 17, usando a conexão de origem já autorizada. No runner aprovado, com PGHOST/PGUSER/PGPORT/PGDATABASE, PGPASSFILE e CA configurados com segurança, executar `bash scripts/export-schema-only.sh DIRETORIO_PROTEGIDO_FORA_DO_CHECKOUT`. A exportação deve usar um snapshot consistente de catálogo. Inventariar e incluir separadamente schemas customizados além de public/private/auth/storage se existirem. Não usar dump de dados.
4. Revisar o catálogo e DDL em área privada: funções podem conter URLs/segredos literais. Não publicar arquivo bruto antes de remover/substituir configurações específicas de produção. Separar objetos de aplicação das tabelas internas de Auth/Storage, extensões e roles gerenciadas que já existem no Supabase de destino. Preservar customizações de triggers Auth e policies Storage por diff contra a mesma versão da plataforma.
5. Transformar a exportação revisada em baseline canônico versionado para instalação nova: tipos, sequências, tabelas, colunas/defaults, PK/FK/constraints, funções/views, índices, owners/GRANTs/default privileges, triggers e RLS/policies. Manter todos os esquemas/overloads/dependências. Resolver owners existentes com mapeamento explícito; sem NO-ACL que elimine permissões. Inspecionar SECURITY DEFINER/search_path e grants EXECUTE para impedir promoção de perfil ou acesso cruzado. Não criar roles privilegiadas para reproduzir owners.
6. Esse baseline representa o schema FINAL da origem: não reaplicar automaticamente as migrations históricas já incorporadas. Versionar histórico/ordem única em nova linha de bootstrap e ensaiar em Supabase local/descartável da mesma versão. Para destino parcial, gerar migrações aditivas específicas a partir do diff real, sem DROP/limpeza genérica. O baseline final e essas migrações ainda NÃO podem ser gerados com fidelidade sem o schema fonte.
7. Revisar jobs/webhooks/pg_cron/pg_net/Edge Functions e referências externas. Recriar apenas equivalentes isolados de testes, sem ativar integrações/SMTP de produção, copiar secrets Vault ou chaves de assinatura. Configurar providers Auth e callbacks com credenciais próprias de testes.
8. Executar DDL aprovado somente no projeto de testes, com transação/ON_ERROR_STOP quando possível, interrompendo no primeiro erro. Não aplicar schema gerenciado auth/storage integralmente nem desabilitar RLS para validar a aplicação. Registrar hash do baseline e versão no histórico de testes. Ao final solicitar reload do schema cache por NOTIFY pgrst, 'reload schema', exclusivamente no destino.
9. Recriar somente a configuração dos buckets necessários (por exemplo vendas-documentos) como privados, com limites/MIME e políticas equivalentes para usuários autenticados. Não copiar storage.objects nem binários. Confirmar Storage/RLS com uploads fictícios em testes.
10. Executar o contrato administrativo de metadados e comparar o schema sem dados da origem/destino com diferenças de plataforma/configuração explicitamente aprovadas. Verificar que usuários e dados de produção não foram importados. A equivalência não é comprovada apenas pela presença das tabelas ou por zero erros do instalador.

## Aceite funcional obrigatório no destino

Usar somente usuários fictícios NOVOS, criados pelo fluxo de signup real, e dados sintéticos. A aplicação usa e-mail/senha com signInWithPassword. Configurar provedor e-mail e confirmação de cadastro em Auth do destino, SMTP/inbox de testes e URLs de redirect do Codespaces (/login, /redefinir-senha); não usar contas/senhas reais e não alterar a confirmação de produção.

- Primeiro representante: signup → confirmação de e-mail quando exigida → login → primeiro acesso → salvar perfis/perfil_representadas → painel → sair/entrar novamente. Perfil padrão usuario; não se promover a admin pelo payload do navegador.
- Segundo representante: mesmos passos. Verificar que cada um só acessa seus clientes, visitas, vendas, rotas, agenda, despesas, relatórios e documentos, tanto na UI como com requests autenticados. A tentativa anon e acesso cruzado devem falhar.
- Novo preposto: signup → preposto_perfis → solicitação/aceite de vínculo com representante → painéis e módulos permitidos. Testar vínculo inativo e permissões negar visualização/cadastro/edição/exclusão conforme o caso, sem uso de service_role nos testes da aplicação.
- Exercitar CRUD por UI/RPC: representadas, produtos, clientes, visitas/vendas/itens/lotes, agenda, despesas, comissões/recebimentos, relatórios/favoritos e documentos. Testar regras transacionais, FKs e erros, além de paginação. Registrar resultados distintos de testes simulados.
- Storage: upload/download/remoção de documento fictício como usuário comum, privacidade do bucket e negação entre operações. Não usar chave administrativa como evidência de RLS funcional.
- Console sem erros não tratados, sem logout/loop em falhas de schema; requests exclusivamente ao projeto de testes. Recompilar Next após alterar NEXT_PUBLIC; nunca inserir secrets administrativos nesses campos.
- Marcar como não executado qualquer fluxo bloqueado por configuração. Não liberar o ambiente com signup passando, mas perfil/RPC/Storage falhando. Limpar somente registros/contas sintéticos identificados durante o ensaio, por procedimento autorizado no destino, deixando as estruturas intactas. Não executar limpeza genérica.

## Correções do aplicativo e evidência local

AppShell agora exibe falha e permite repetir sem deslogar quando a leitura do perfil/schema falha; não renderiza conteúdo protegido. Primeiro acesso de representante e preposto não converte falha do banco em cadastro ausente nem apresenta formulário antes da verificação. Rejeições assíncronas são tratadas. Isso melhora diagnóstico e impede acesso indevido, mas NÃO instala tabelas.

Testes de interface antigos usavam storage key de sessão do projeto de produção. Foram alinhados ao ref de testes. O CI foi ajustado para compilar, instalar Chromium e iniciar o servidor antes dos testes de navegador. Continua exigindo lint, sem silenciar regras.

Verificado nesta execução: build, typecheck, 10 arquivos de testes Node, 3 testes do probe e 6 arquivos de testes de UI com APIs SIMULADAS; contrato SQL ensaiado em PostgreSQL 17.11 local sem rede, detectando objetos ausentes/RLS desabilitada; dump schema-only da fixture sem TABLE DATA. O lint mantém 16 erros e 4 avisos preexistentes. O pipeline remoto não foi executado nem declarado aprovado.

NÃO verificado: exportação real de produção, instalação DDL no destino, cadastro/Auth/perfil/painel com backend real, equivalência das policies e módulos/Storage reais. Enquanto faltarem schema fonte e execução administrativa no destino, a implantação permanece bloqueada.

## Recuperação

Se uma transação de DDL falhar, não continuar com aplicação parcial. Comparar catálogo/histórico e restaurar somente o backup de estrutura/configurações de testes quando necessário e autorizado. Considerar compensação para operações não transacionais e buckets criados. Não apagar usuários ou dados existentes para repetir. Nunca apontar rollback, NOTIFY ou instalação para produção. Guardar logs privados sem credenciais e registrar os hashes do baseline e das migrações aplicadas.
