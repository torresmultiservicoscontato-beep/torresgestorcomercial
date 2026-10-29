import { createClient } from "@supabase/supabase-js";

// Nunca usar credenciais ou URL de produção como fallback no código.
const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const projectPublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  "";

const appEnvironment = process.env.NEXT_PUBLIC_APP_ENV?.trim() || "";
const projectHosts: Record<string, string> = {
  test: "bwoxqsbqbtrkfvrsswrq.supabase.co",
  production: "sqlrhvxiluzgeldxcmyf.supabase.co",
};

function validarConfiguracao(): string | null {
  if (!projectUrl || !projectPublishableKey) {
    return "Acesso indisponível: configure a URL e a chave pública do Supabase deste ambiente.";
  }
  if (!projectHosts[appEnvironment]) {
    return "Configuração inválida: defina NEXT_PUBLIC_APP_ENV como test ou production.";
  }
  try {
    const url = new URL(projectUrl);
    const hostname = url.hostname;
    if (hostname !== projectHosts[appEnvironment] || url.protocol !== "https:" ||
        url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) {
      return "Supabase configurado não corresponde ao ambiente informado.";
    }
  } catch {
    return "NEXT_PUBLIC_SUPABASE_URL inválida.";
  }
  if (/^(COLE_|SUA_CHAVE)/i.test(projectPublishableKey)) {
    return "Configure a chave pública real do projeto de testes; o valor do exemplo não é uma chave válida.";
  }
  return null;
}

export const supabaseUrl = projectUrl;
export const supabasePublishableKey = projectPublishableKey;
export const supabaseConfigurationError = validarConfiguracao();
export const supabaseConfigured = supabaseConfigurationError === null;

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function criarSupabaseIsolado() {
  if (!supabaseConfigured) return null;

  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
