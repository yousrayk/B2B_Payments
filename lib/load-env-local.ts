import "server-only";

import fs from "fs";
import path from "path";

function normalizeKey(key: string): string {
  return key.replace(/^\uFEFF/, "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

export function parseEnvContent(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = content.replace(/^\uFEFF/, "");

  for (const line of raw.split(/\r\n|\n|\r/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = normalizeKey(trimmed.slice(0, eq));
    let val = trimmed.slice(eq + 1).trim();

    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }

    if (key) out[key] = val;
  }

  return out;
}

/**
 * Reads `.env.local` from disk into a plain object (does not depend on
 * `process.env` mutations). Use when Next/Turbopack inlines empty `NEXT_PUBLIC_*`.
 */
export function readEnvLocalFiles(): Record<string, string> {
  const merged: Record<string, string> = {};
  const candidates = [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), "..", ".env.local"),
  ];

  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    try {
      const parsed = parseEnvContent(fs.readFileSync(envPath, "utf8"));
      Object.assign(merged, parsed);
    } catch {
      // ignore single-file errors
    }
  }

  return merged;
}

/** Merge parsed `.env.local` into `process.env` for libs that only read env. */
export function loadEnvLocalRuntime(): void {
  const merged = readEnvLocalFiles();
  for (const [k, v] of Object.entries(merged)) {
    process.env[k] = v;
  }
}

export function describeEnvLocalPresence(): string {
  const primary = path.join(process.cwd(), ".env.local");
  const parent = path.join(process.cwd(), "..", ".env.local");
  const primaryOk = fs.existsSync(primary);
  const parentOk = fs.existsSync(parent);
  return `cwd=${process.cwd()} .env.local here=${primaryOk} (${primary}) parent=${parentOk}`;
}

/** Safe dev-only hint: variable names parsed from disk (no secret values). */
export function describeParsedEnvKeys(fileEnv: Record<string, string>): string {
  const keys = Object.keys(fileEnv).sort();
  return `parsedEnvKeys=${keys.length ? keys.join(", ") : "(none — file read returned no KEY=value pairs)"}`;
}
