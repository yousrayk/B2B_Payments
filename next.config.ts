import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

/**
 * Ensures `.env.local` is merged into `process.env` before the app bundle runs.
 * Fixes cases where server code reads Supabase vars as undefined even though
 * the file exists (ordering / cwd edge cases on Windows).
 */
(function loadEnvLocalIntoProcessEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  let raw = fs.readFileSync(envPath, "utf8");
  raw = raw.replace(/^\uFEFF/, "");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();

    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }

    process.env[key] = val;
  }
})();

const nextConfig: NextConfig = {};

export default nextConfig;
