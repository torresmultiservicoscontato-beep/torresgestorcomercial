# Backup e recuperação — Torres Gestor Comercial

## Estado atual
- Organização Supabase no plano **Free**: sem backup automático gerenciado.
- O workflow `.github/workflows/backup-production.yml` foi adicionado **somente a `develop`** e não roda por agendamento até chegar à branch padrão (`main`).
- **Ainda não executado:** secrets do GitHub, cópia real, restauração do banco e restauração física de documentos.
- Produção: `sqlrhvxiluzgeldxcmyf`; testes: `bwoxqsbqbtrkfvrsswrq`.
- A cópia do banco inclui dados pessoais e autenticação: **nunca descompactar em área compartilhada ou subir dump desprotegido para o GitHub**.

## Ativação
Criar ambiente GitHub Actions `production-backup` e cadastrar **secrets de ambiente**, não variáveis `NEXT_PUBLIC`:
1. `PROD_DATABASE_URL`: string de conexão PostgreSQL de produção (preferir usuário de backup com acesso mínimo suficiente). Nunca adicionar ao repositório.
2. `PROD_SUPABASE_SERVICE_ROLE_KEY`: chave secreta do Storage de produção, usada só no runner para leitura do bucket privado.
3. `BACKUP_PASSPHRASE`: senha aleatória robusta guardada **fora do GitHub também**, em cofre separado. Perder esta senha inviabiliza recuperação.
A URL e o projeto de origem são validados pelo workflow. Conferir autorização de acesso antes de configurar.
Abrir PR de `develop` para `main`; revisar riscos e ativar somente depois de cadastrar secrets e testar manualmente. Agendamento: diariamente às 04:00 UTC (01:00 em Brasília, com UTC-3). Retenção: artefato GitHub de 30 dias; para recuperação em desastre do GitHub, manter segunda cópia criptografada fora do GitHub (ainda não implementada).

## Verificar cópia produzida
- Fazer download do artefato criptografado de uma execução concluída.
- Executar `sha256sum -c backup.enc.sha256` e armazenar a senha fora da linha de comando/histórico.
- Em máquina controlada, usar `gpg --decrypt backup.enc | tar -xz` (senha no prompt).
- Validar `pg_restore --list snapshot/database/production.dump`.
- Executar `python3 scripts/verify_storage_backup.py snapshot/storage` para conferir todos os hashes.
- Registrar data, resultado, tamanho, contagem de documentos e identificação da execução.
- O `pg_restore --list` **não comprova restauração**; apenas integridade de catálogo.

## Ensaio de recuperação (sem produção)
1. Criar/selecionar **destino descartável**, separado do Supabase de produção e do ambiente de homologação usado por outras pessoas. Não restaurar no projeto real.
2. Revisar o dump para objetos administrados pelo Supabase (auth, storage, extensions, roles) e dependências. Planejar restauração com ferramenta e versão PostgreSQL compatíveis.
3. Restaurar `production.dump` nesse destino com `pg_restore`; registrar erros, conflitos e quantidades de tabelas e funções. Verificar também login, políticas RLS e permissões de usuário.
4. Restaurar os arquivos do diretório `snapshot/storage/objects` via API de upload para o bucket **do destino**, nunca copiando apenas as linhas `storage.objects`. Conferir downloads e SHA-256 em amostra e, idealmente, 100% dos arquivos.
5. Verificar integridade de referências `venda_anexos` → objetos do Storage, incluindo a abertura dos anexos na aplicação isolada.
6. Destruir o ambiente temporário de recuperação e as cópias descompactadas de forma controlada. Não disponibilizar usuários reais para testes.
7. Registrar tempo de recuperação (RTO), ponto de recuperação (RPO) e resultado **APROVADO/REPROVADO**. Repetir mensalmente.

**ATENÇÃO:** Restaurar dados de produção em outro projeto cria uma cópia de dados pessoais e credenciais hash de usuários. Não fazê-lo no projeto de homologação com acesso amplo. Usar destino descartável, acesso restrito e autorizar qualquer custo do projeto temporário antes de criar.

## Falhas e limitações
- O agendamento GitHub Actions não é garantia de execução no horário exato. Verificar execuções e alertas.
- Um job falhado **não** gera backup válido. Monitorar diariamente.
- O Storage exportado é um retrato por listagem/download, sem snapshot transacional atômico. Se houver uploads e exclusões simultâneos, banco e Storage podem divergir; validar referências e planejar retenção/versionamento de objetos.
- GitHub Artifacts não é cofre off-site de longo prazo. Planejar armazenamento externo cifrado e cópia redundante.
- A expiração de backups em 30 dias não equivale a uma política de retenção legal. Definir LGPD, RPO e RTO com o responsável pela operação.
- Nenhuma política de backup foi ativada na produção apenas por adicionar este arquivo.
