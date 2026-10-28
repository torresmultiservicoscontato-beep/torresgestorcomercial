#!/usr/bin/env python3
"""Exporta binários do Supabase Storage com autenticação server-side.

Uso: python3 scripts/backup_storage.py <url> <bucket> <output-dir>
Definir SUPABASE_SERVICE_ROLE_KEY no ambiente. NUNCA usar no browser.
"""
import hashlib
import json
import os
from pathlib import Path
import sys
from urllib.error import HTTPError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

url, bucket, output = sys.argv[1:]
key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
root = Path(output)
root.mkdir(parents=True, exist_ok=True)
base = url.rstrip("/")
host = urlparse(base).hostname
if host != "sqlrhvxiluzgeldxcmyf.supabase.co":
    raise SystemExit("Backup recusado: URL não é a produção conhecida.")

headers = {"apikey": key, "Authorization": f"Bearer {key}"}

def request(path, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    h = {**headers, **({"Content-Type": "application/json"} if payload is not None else {})}
    req = Request(base + path, data=data, headers=h)
    with urlopen(req, timeout=120) as response:
        return response.read()

files = []
def walk(prefix=""):
    offset = 0
    while True:
        entries = json.loads(request("/storage/v1/object/list/" + quote(bucket, safe=""), {
            "prefix": prefix, "limit": 100, "offset": offset, "sortBy": {"column": "name", "order": "asc"}
        }))
        for entry in entries:
            name = entry["name"]
            path = f"{prefix}/{name}" if prefix else name
            if entry.get("id") is None:
                walk(path)
            else:
                raw = request("/storage/v1/object/authenticated/" + quote(bucket, safe="") + "/" + quote(path, safe="/"))
                dst = root / "objects" / path
                # Proteção contra traversal, inclusive nomes malformados.
                if not dst.resolve().is_relative_to((root / "objects").resolve()):
                    raise ValueError("Caminho inválido do Storage")
                dst.parent.mkdir(parents=True, exist_ok=True)
                dst.write_bytes(raw)
                files.append({"path": path, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()})
        if len(entries) < 100:
            break
        offset += 100

walk()
(root / "manifest.json").write_text(json.dumps({
    "bucket": bucket, "files": files, "count": len(files)
}, indent=2, ensure_ascii=False) + "\n")
print(f"Backup Storage: {len(files)} objetos.")
