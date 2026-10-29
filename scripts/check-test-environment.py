#!/usr/bin/env python3
"""Sonda somente leitura; nenhuma senha, sessão, linha comercial ou resposta bruta é exibida."""
import json
import os
import ssl
import sys
import urllib.error
import urllib.request

TEST_URL = 'https://bwoxqsbqbtrkfvrsswrq.supabase.co'
TABLES = ('preposto_perfis', 'perfis', 'perfil_representadas', 'prepostos', 'clientes',
          'visitas', 'vendas', 'agenda_eventos', 'representadas_catalogo', 'venda_anexos')

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

def verify_config(env):
    if env.get('NEXT_PUBLIC_APP_ENV') != 'test' or env.get('NEXT_PUBLIC_SUPABASE_URL', '').rstrip('/') != TEST_URL:
        raise ValueError('Recusado: configuração não corresponde exclusivamente ao projeto de testes.')
    key = env.get('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') or env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    if not key:
        raise ValueError('Chave pública de testes ausente.')
    return key

def classify(status, code=None):
    if status == 200:
        return 'ENDPOINT_REACHABLE_NOT_A_FUNCTIONAL_TEST'
    if status == 404 and code == 'PGRST205':
        return 'TABLE_NOT_IN_SCHEMA_CACHE'
    if status in (401, 403):
        return 'AUTHORIZATION_NOT_VALIDATED'
    return 'REQUEST_FAILED'

def run(env, opener=None):
    key = verify_config(env)  # Guard before any connection, even to a local URL.
    if opener is None:
        opener = urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=ssl.create_default_context()), NoRedirect())
    results = []
    for table in TABLES:
        request = urllib.request.Request(TEST_URL + '/rest/v1/' + table + '?select=*&limit=0',
            headers={'apikey': key, 'Authorization': 'Bearer ' + key})
        status, code = None, None
        try:
            with opener.open(request, timeout=20) as response:
                status = response.status
                response.read(0)  # Never collect row payloads.
        except urllib.error.HTTPError as error:
            status = error.code
            try:
                parsed = json.loads(error.read(16384))
                code = parsed.get('code') if parsed.get('code') == 'PGRST205' else None
            except (ValueError, AttributeError):
                pass
        except Exception:
            pass  # Do not print exceptions that could include headers or credentials.
        results.append({'table': table, 'http_status': status, 'result': classify(status, code)})
    return {'project_ref': 'bwoxqsbqbtrkfvrsswrq', 'rows_requested': 0,
            'results': results, 'functional_validation': 'NOT_EXECUTED'}

if __name__ == '__main__':
    try:
        report = run(os.environ)
        print(json.dumps(report, indent=2))
        sys.exit(0 if all(r['http_status'] == 200 for r in report['results']) else 1)
    except ValueError as error:
        print(str(error), file=sys.stderr)
        sys.exit(2)
