// Verificação estática para impedir apontamento indevido do CI e fallback em produção.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const client = fs.readFileSync(path.join(__dirname, "../app/lib/supabase.ts"), "utf8");
const ci = fs.readFileSync(path.join(__dirname, "../.github/workflows/ci.yml"), "utf8");
assert.match(client, /projectHosts/);
assert.match(client, /hostname !== projectHosts\[appEnvironment\]/);
assert.doesNotMatch(client, /const projectUrl\s*=\s*["']https:\/\//);
assert.match(ci, /NEXT_PUBLIC_APP_ENV: test/);
assert.match(ci, /NEXT_PUBLIC_SUPABASE_URL: https:\/\/bwoxqsbqbtrkfvrsswrq\.supabase\.co/);
assert.doesNotMatch(ci, /NEXT_PUBLIC_SUPABASE_URL: https:\/\/sqlrhvxiluzgeldxcmyf\.supabase\.co/);
console.log("OK: isolamento entre ambientes e CI validado.");
