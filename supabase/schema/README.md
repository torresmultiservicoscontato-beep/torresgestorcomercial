# Reprodução segura do esquema de produção no ambiente de testes

Procedimento ativo de instalação vazia e diagnóstico: [docs/ambiente-testes.md](../../docs/ambiente-testes.md). Não executar db push nos arquivos históricos sem resolver a baseline e as versões duplicadas.

Status: **snapshot tipado obtido**, dump SQL completo **pendente**.

## Ambientes
- Origem (produção): `sqlrhvxiluzgeldxcmyf`.
- Destino (testes): `bwoxqsbqbtrkfvrsswrq`.
- O arquivo `production-types.snapshot.ts` contém apenas metadados tipados. Não contém registros, mas **não é restaurável como esquema SQL**.

## Procedimento para obter a cópia completa
O dump deve ser gerado por uma conexão autorizada diretamente com o PostgreSQL de produção. **Não inserir nem compartilhar senhas em issues, chats ou commits.** Usar o mecanismo oficial de conexão do Supabase (pooler/session ou conexão direta, conforme IPv4/IPv6) e uma ferramenta `pg_dump` compatível com o servidor PostgreSQL 17.

1. Obter de forma segura a connection string de produção no painel Supabase, sem registrá-la no repositório.
2. Com `PGDATABASE`/`PGHOST`/`PGUSER`/`PGPASSWORD` configurados localmente, executar (ambiente protegido):
   ```bash
   pg_dump --schema-only --no-owner --no-privileges --schema=public --schema=private --file=torres-schema-only.sql
   ```
   Em vez de usar `--no-privileges` na restauração final, revisar e exportar também os GRANTs necessários; este comando é apenas a base estrutural.
3. Revisar cuidadosamente referências a recursos específicos de produção, `SECURITY DEFINER`, `search_path`, políticas RLS, funções, extensões, triggers e objetos dependentes de `auth` e `storage`.
4. Não exportar/restaurar registros da produção; isso inclui `auth.users`, `storage.objects` e tabelas comerciais.
5. Aplicar em testes somente depois de um ensaio de restauração e validação. Instalar bucket `vendas-documentos` e policies de Storage compatíveis, mas não copiar os documentos reais.
6. Validar a aplicação com usuários e dados fictícios, além de verificar contagem de objetos, RLS, RPCs, grants e execução dos fluxos de clientes, visitas e vendas.
7. Versionar os ajustes necessários como migrations reaplicáveis e documentar qualquer divergência.

**Não executar esse procedimento apontando a conexão de destino para produção.** O snapshot tipado não deve ser utilizado para recriar as tabelas diretamente, porque não inclui os controles de segurança.
