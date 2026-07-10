import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { join } from "path";

// Workaround: Next.js 16 Turbopack silently truncates .env.local values that
// contain '--' (e.g. Anthropic API keys). Manually inject any missing vars here.
function patchEnvFromDotLocal() {
  const required = ["ANTHROPIC_API_KEY"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length === 0) return;

  try {
    const envPath = join(process.cwd(), ".env.local");
    const raw = readFileSync(envPath, "utf8");
    for (const key of missing) {
      // Match bare or quoted value; stop at newline
      const m = raw.match(new RegExp(`^${key}=["']?([^"'\\r\\n]+)["']?`, "m"));
      if (m?.[1]) process.env[key] = m[1];
    }
  } catch {
    // .env.local not present — that's fine in CI/production
  }
}

patchEnvFromDotLocal();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
