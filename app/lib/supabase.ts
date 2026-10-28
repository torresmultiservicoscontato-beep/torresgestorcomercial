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

if (projectUrl || projectPublishableKey) {
  if (!projectHosts[appEnvironment]) {
    throw new Error("Defina NEXT_PUBLIC_APP_ENV como test ou production.");
  }

  let hostname: string;
  try {
    hostname = new URL(projectUrl).hostname;
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL inválida.");
  }

  if (hostname !== projectHosts[appEnvironment]) {
    throw new Error("Supabase configurado não corresponde ao ambiente informado.");
  }
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
