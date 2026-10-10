/**
 * Cloudflare Worker - Voice agent backend
 * ----------------------------------------
 *   POST /                 browser "Test agent"-ku Gemini ephemeral token
 *   POST /twilio/voice     Twilio call webhook -> TwiML (media stream connect)
 *   POST /twilio/status    Twilio call status (ringing, completed...)
 *   WS   /twilio/stream    call audio -> CallSession Durable Object (Gemini bridge)
 *   GET  /api/health       admin sidebar "Phone line online"
 *   POST /api/call         admin "Call" button   (Authorization: Bearer ADMIN_TOKEN)
 *   POST /api/hangup       admin "End call"      (Authorization: Bearer ADMIN_TOKEN)
 *
 * Secrets: worker/.dev.vars (local) -> `npm run secrets` (Cloudflare-ku push)
 * Deploy:  npm run deploy
 */

import { createFirestore } from "./firestore.js";
import { makeCall, endCall, isFromTwilio, streamToken } from "./twilio.js";

export { CallSession } from "./call-session.js";

const cors = {
  "Access-Control-Allow-Origin": "*", // admin page vera domain-la irundhaalum; API ADMIN_TOKEN vachu protect
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const xml = (body) => new Response(body, { headers: { "Content-Type": "text/xml" } });

const escapeXml = (s) =>
  String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);

// Twilio-ku theriyura public URL. Local (wrangler dev + ngrok)-la PUBLIC_URL =
// ngrok URL; Cloudflare-la set pannalanaa request URL-ae (workers.dev).
const publicOrigin = (env, url) => (env.PUBLIC_URL || url.origin).replace(/\/$/, "");

// Admin API: "Authorization: Bearer <ADMIN_TOKEN>" correct-aa?
function isAdmin(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  return request.headers.get("Authorization") === `Bearer ${env.ADMIN_TOKEN}`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = publicOrigin(env, url);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    try {
      // ---------- Twilio media stream (WebSocket) -> Durable Object ----------
      if (path === "/twilio/stream") {
        const stub = env.CALLS.get(env.CALLS.newUniqueId());
        return stub.fetch(request);
      }

      // ---------- Twilio webhooks ----------
      if (request.method === "POST" && (path === "/twilio/voice" || path === "/twilio/status")) {
        const params = new URLSearchParams(await request.text());
        // Twilio sign panna URL = public URL (ngrok-la Worker-ku localhost-aa theriyum)
        const signedUrl = origin + path + url.search;
        if (!(await isFromTwilio(env, signedUrl, params, request.headers.get("X-Twilio-Signature")))) {
          console.warn("⛔ Twilio signature thappu:", path);
          return new Response("Forbidden", { status: 403 });
        }
        const db = createFirestore(env);
        const callSid = params.get("CallSid");

        if (path === "/twilio/status") {
          const status = params.get("CallStatus");
          if (callSid && status) {
            const fields = { status };
            const done = ["completed", "busy", "no-answer", "failed", "canceled"].includes(status);
            if (done && params.get("CallDuration")) fields.durationSec = Number(params.get("CallDuration"));
            ctx.waitUntil(db.saveCall(callSid, fields, done ? ["endedAt"] : []).catch((e) => console.error(e.message)));
          }
          return new Response(null, { status: 204 });
        }

        // /twilio/voice: outbound-naa customer = To, incoming-naa From
        const outbound = (params.get("Direction") || "").startsWith("outbound");
        const customer = (outbound ? params.get("To") : params.get("From")) || "";
        console.log(`📞 ${outbound ? "Outgoing call to" : "Incoming call from"} ${customer} (${callSid})`);
        ctx.waitUntil(
          db
            .saveCall(callSid, { phone: customer, direction: outbound ? "outbound" : "inbound", status: "in-progress" }, ["startedAt"])
            .catch((e) => console.error(e.message))
        );

        const token = await streamToken(env, callSid);
        return xml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${origin.replace(/^http/, "ws")}/twilio/stream">
      <Parameter name="from" value="${escapeXml(customer)}" />
      <Parameter name="token" value="${token}" />
    </Stream>
  </Connect>
</Response>`);
      }

      // ---------- Admin API ----------
      if (path === "/api/health") {
        return json({ ok: true, twilio: !!env.TWILIO_ACCOUNT_SID, number: env.TWILIO_NUMBER || null });
      }

      if (path === "/api/call" || path === "/api/hangup") {
        if (request.method !== "POST") return json({ error: "POST only" }, 405);
        if (!env.ADMIN_TOKEN) return json({ error: "Worker-la ADMIN_TOKEN secret set pannala" }, 500);
        if (!isAdmin(request, env)) return json({ error: "Admin key thappu" }, 401);
        const body = await request.json().catch(() => ({}));

        if (path === "/api/hangup") {
          await endCall(env, body.callSid);
          return json({ ok: true });
        }

        const { callSid, to } = await makeCall(env, origin, body.phone);
        ctx.waitUntil(
          createFirestore(env)
            .saveCall(callSid, { phone: to, direction: "outbound", status: "queued", lines: [] }, ["startedAt"])
            .catch((e) => console.error(e.message))
        );
        return json({ callSid, to });
      }

      // ---------- Browser "Test agent" ephemeral token ----------
      if (request.method === "POST" && (path === "/" || path === "/token")) {
        return await ephemeralToken(env);
      }

      if (request.method === "GET" && path === "/") return new Response("Voice agent backend running ✅");
      return new Response("Not found", { status: 404 });
    } catch (err) {
      console.error(path, err);
      return json({ error: err.message || String(err) }, path.startsWith("/api/") ? 400 : 500);
    }
  },
};

async function ephemeralToken(env) {
  if (!env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY set aagala (worker/.dev.vars check pannu)" }, 500);

  const body = JSON.stringify({
    // Oru call-ku mattum, 1 nimisham-kulla connect aaganum, 30 nimisham max.
    // NOTE: bidiGenerateContentSetup lock podaadhe - adhu client anuppura
    // systemInstruction + tools-ஐ override panni generic agent aakidum.
    uses: 1,
    expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
  });

  // Network blip-ku 2 thadava try pannu
  let r;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      r = await fetch("https://generativelanguage.googleapis.com/v1alpha/auth_tokens?key=" + env.GEMINI_API_KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      break;
    } catch (err) {
      console.error(`Google fetch failed (attempt ${attempt}):`, err);
      if (attempt === 2)
        return json({ error: "Worker-ala Google server-a reach panna mudiyala (network). Detail: " + (err?.message || err) }, 502);
    }
  }
  if (!r.ok) return json({ error: await r.text() }, 500);
  const data = await r.json();
  return json({ token: data.name });
}
