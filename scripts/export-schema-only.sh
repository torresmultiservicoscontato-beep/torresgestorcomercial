#!/usr/bin/env bash
# Exporta SOMENTE estrutura. Não cria roles nem usa autenticação temporária da CLI.
set -euo pipefail
umask 077
fail() { printf '%s\n' "$1" >&2; exit 2; }
[[ $# -eq 1 ]] || fail 'Uso: export-schema-only.sh DIRETORIO_PROTEGIDO_FORA_DO_REPOSITORIO'
: "${PGHOST:?Configure o host oficial no runner seguro}"
: "${PGUSER:?Configure a role já autorizada no runner seguro}"
[[ ${PGPORT:-5432} == 5432 ]] || fail 'Use conexão direta ou Session Pooler na porta 5432.'
[[ ${PGDATABASE:-postgres} == postgres ]] || fail 'Banco inesperado.'
[[ -z ${PGPASSWORD:-} && -z ${PGSERVICE:-} && -z ${PGSERVICEFILE:-} && -z ${PGHOSTADDR:-} ]] || fail 'Use PGPASSFILE e endpoint explícito, sem senhas em variáveis/URL ou overrides de rota.'
case "$PGHOST" in
 db.sqlrhvxiluzgeldxcmyf.supabase.co) [[ "$PGUSER" != *.* ]] || fail 'Usuário inválido para conexão direta.' ;;
 *.pooler.supabase.com) [[ "$PGUSER" == *.sqlrhvxiluzgeldxcmyf ]] || fail 'Tenant do Session Pooler não é a origem esperada.' ;;
 *) fail 'Host não corresponde a um endpoint oficial esperado para a origem.' ;;
esac
[[ ${PGSSLMODE:-} == verify-full ]] || fail 'TLS verify-full obrigatório.'
: "${PGSSLROOTCERT:?Monte a CA oficial do endpoint}"
: "${PGPASSFILE:?Monte o arquivo de senha pelo cofre seguro}"
python3 - "$PGPASSFILE" "$PGSSLROOTCERT" "$1" <<'PY'
import os, pathlib, stat, subprocess, sys
password,ca,out = map(pathlib.Path,sys.argv[1:])
root=pathlib.Path(subprocess.check_output(['git','rev-parse','--show-toplevel'],text=True).strip()).resolve()
for p in (password,out):
 if p.resolve().is_relative_to(root):raise SystemExit('Segredo/backup deve ficar fora do checkout.')
if not password.is_file() or stat.S_IMODE(password.stat().st_mode) != 0o600:
 raise SystemExit('PGPASSFILE deve ser arquivo seguro com modo 0600.')
if not ca.is_file():raise SystemExit('CA não disponível.')
if out.exists():raise SystemExit('Destino local já existe; não sobrescrever backup anterior.')
PY
pg_dump --version | grep -Eq 'PostgreSQL\) 17\.' || fail 'Use PostgreSQL Client 17.'
# Só publique a exportação depois de revisar funções/configurações por segredos literais.
# Quatro schemas conhecidos: inventariar eventuais schemas adicionais antes do aceite.
mkdir -m 700 -- "$1"
export PGPORT=5432 PGDATABASE=postgres
export PGOPTIONS='-c default_transaction_read_only=on'
if ! pg_dump --format=custom --schema-only --schema=public --schema=private --schema=auth --schema=storage \
  --file="$1/schema-only.dump" 2>"$1/pg_dump.log"; then
  fail 'Exportação falhou; evidência protegida no diretório de saída. Não utilizar dump parcial.'
fi
pg_restore --list "$1/schema-only.dump" > "$1/catalog.txt"
(cd "$1" && sha256sum schema-only.dump > schema-only.sha256)
printf '%s\n' 'Estrutura exportada; nenhum dado de tabela ou senha de role foi solicitado. Revisão obrigatória antes de qualquer instalação.'
