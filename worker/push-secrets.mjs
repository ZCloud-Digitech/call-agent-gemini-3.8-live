// push-secrets.mjs - worker/.dev.vars-la irukkra secrets-ai Cloudflare-ku anuppum
//   npm run secrets
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const KEYS = ["GEMINI_API_KEY", "FIREBASE_PROJECT_ID", "FIREBASE_API_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_NUMBER", "ADMIN_TOKEN"];

const vars = {};
for (const line of readFileSync(".dev.vars", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && KEYS.includes(m[1]) && m[2]) vars[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const missing = KEYS.filter((k) => !vars[k]);
if (missing.length) console.warn("⚠️  .dev.vars-la illa (skip):", missing.join(", "));

const file = join(tmpdir(), `secrets-${Date.now()}.json`);
writeFileSync(file, JSON.stringify(vars));
try {
  execSync(`npx wrangler secret bulk "${file}"`, { stdio: "inherit" });
  console.log("✅ Pushed:", Object.keys(vars).join(", "));
} finally {
  unlinkSync(file);
}
