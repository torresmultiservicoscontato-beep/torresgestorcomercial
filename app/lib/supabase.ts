import { createClient } from "@supabase/supabase-js";

const projectUrl = "https://sqlrhvxiluzgeldxcmyf.supabase.co";
const projectPublishableKey = "sb_publishable_5SE836jPHpLJ3d3r9U380w_2_0lcRLj";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? projectUrl;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  projectPublishableKey;

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
