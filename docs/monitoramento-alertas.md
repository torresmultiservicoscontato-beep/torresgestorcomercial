# Monitoramento e alertas — Torres Gestor Comercial

## Implementado
O workflow `.github/workflows/monitoring.yml` verifica a cada três horas:
- API de autenticação Supabase da produção, via endpoint `/auth/v1/health`, sem credenciais e sem consultar dados pessoais.
- Disponibilidade HTTP da aplicação, quando configurado o repositório GitHub **variable** `PROD_APP_URL` com a URL HTTPS oficial.
- Existência de backup bem-sucedido nas últimas **30 horas**, somente após definir a variável `BACKUP_MONITOR_ENABLED=true` e concluir ao menos um backup validado.

Falhas geram ou atualizam o issue de título `[Monitoramento] Falha de disponibilidade ou backup` no próprio GitHub. A função não exibe secrets nem tenta corrigir dados de produção automaticamente.

## Para ativar efetivamente
1. Revisar e promover `monitoring.yml` para a branch padrão `main`. Agendamentos GitHub Actions somente executam na branch padrão. O workflow na `develop` **não constitui monitoramento ativo**.
2. Em **Settings > Secrets and variables > Actions > Variables**, cadastrar `PROD_APP_URL` com a URL HTTPS do site de produção (assim que confirmada).
3. Executar manualmente o workflow em `main` e inspecionar o resultado em Actions.
4. **Não** ativar `BACKUP_MONITOR_ENABLED` enquanto o workflow de backup não estiver operacional. Após um backup validado, configurar `BACKUP_MONITOR_ENABLED=true`.
5. Ativar notificações de GitHub Issues para os responsáveis pelo repositório (Watch > Custom > Issues, ou e-mail GitHub). Issues não enviam automaticamente e-mail ou WhatsApp a pessoas não inscritas.
6. Acompanhar incidentes abertos. Após resolver causa raiz, fechar issue; reincidências após fechamento gerarão novo issue.

## Limitações
- Intervalo programado de três horas, sujeito a atrasos e indisponibilidade do GitHub Actions.
- Verificação de disponibilidade não demonstra funcionamento de login, autorização RLS, pagamento ou upload.
- A API Auth saudável não garante PostgreSQL saudável; complementar com testes de ponta a ponta usando conta de monitor de privilégios mínimos em fase posterior.
- O alerta de backup verifica **conclusão da rotina**, não comprova integridade de restauração. Manter os ensaios de recuperação independentes.
- Falhas do próprio workflow (ex.: falta de permissão para criar issue) devem ser observadas em Actions e notificações de Actions.
- Não publicar endereço interno, tokens ou dados pessoais nos incidentes.
