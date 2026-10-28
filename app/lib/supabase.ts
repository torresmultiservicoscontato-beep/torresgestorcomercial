import { createClient } from "@supabase/supabase-js";

// Nunca usar credenciais ou URL de produção como fallback no código.
const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const projectPublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  "";

const appEnvironment = process.env.NEXT_PUBLIC_APP_ENV?.trim() || "";
const productionProjectRef = "sqlrhvxiluzgeldxcmyf";

if (
  appEnvironment === "test" &&
  projectUrl &&
  new URL(projectUrl).hostname === `${productionProjectRef}.supabase.co`
) {
  throw new Error("Configuração inválida: ambiente de testes não pode usar o Supabase de produção.");
}

export const supabaseUrl = projectUrl;
export const supabasePublishableKey = projectPublishableKey;
export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

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
