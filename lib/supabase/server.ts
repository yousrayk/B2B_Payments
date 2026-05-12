import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { loadEnvConfig } from "@next/env";
import { cookies } from "next/headers";
import {
  describeEnvLocalPresence,
  describeParsedEnvKeys,
  loadEnvLocalRuntime,
  readEnvLocalFiles,
} from "@/lib/load-env-local";

function trimVal(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/**
 * Prefer values read straight from `.env.local` so we are not blocked by
 * Turbopack inlining `NEXT_PUBLIC_*` into empty strings.
 */
function env(
  fileEnv: Record<string, string>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const fromFile = trimVal(fileEnv[key]);
    if (fromFile) return fromFile;
    const fromProc = trimVal(process.env[key]);
    if (fromProc) return fromProc;
  }
  return undefined;
}

function getSupabaseUrl(fileEnv: Record<string, string>): string | undefined {
  return env(
    fileEnv,
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
  );
}

/** Supports classic anon JWT or newer publishable key (`sb_publishable_...`). */
function getSupabaseAnonKey(
  fileEnv: Record<string, string>,
): string | undefined {
  return env(
    fileEnv,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
  );
}

export async function createSupabaseServerClient() {
  const isDev = process.env.NODE_ENV !== "production";
  loadEnvConfig(process.cwd(), isDev, undefined, true);

  const fileEnv = readEnvLocalFiles();
  loadEnvLocalRuntime();

  const url = getSupabaseUrl(fileEnv);
  const anonKey = getSupabaseAnonKey(fileEnv);

  if (!url || !anonKey) {
    const hint =
      process.env.NODE_ENV === "development"
        ? ` ${describeEnvLocalPresence()} ${describeParsedEnvKeys(fileEnv)}`
        : "";
    throw new Error(
      "Missing Supabase env: set NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local at the project root (same folder as package.json). Restart dev after editing." +
        hint,
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component; ignore if middleware/session refresh
          // cannot set cookies in this context.
        }
      },
    },
  });
}
