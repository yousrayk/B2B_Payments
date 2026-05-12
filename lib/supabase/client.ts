import { createBrowserClient } from "@supabase/ssr";

function pickEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const raw = process.env[key];
    if (raw === undefined) continue;
    const v = raw.trim();
    if (v.length > 0) return v;
  }
  return undefined;
}

function getSupabaseUrl(): string | undefined {
  return pickEnv("NEXT_PUBLIC_SUPABASE_URL");
}

function getSupabaseAnonKey(): string | undefined {
  return pickEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );
}

export function createSupabaseBrowserClient() {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and anon/publishable key (NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
    );
  }

  return createBrowserClient(url, anonKey);
}
