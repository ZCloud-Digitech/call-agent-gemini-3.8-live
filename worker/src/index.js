/**
 * Cloudflare Worker - Gemini Live ephemeral token server
 * -------------------------------------------------------
 * Browser-la Google API key-ஐ direct வைக்கக்கூடாது. Idhu Worker
 * un REAL key-ஐ safe-ஆ vachu, browser-ku SHORT-LIFE ephemeral
 * token மட்டும் தரும். Adhu vachu thaan browser Gemini Live-kooda
 * WebSocket-ஆ pesum.
 *
 * Deploy:
 *   npx wrangler secret put GEMINI_API_KEY
 *   npx wrangler deploy
 */

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*", // production-la un site URL mattum podu
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST")
      return new Response("POST only", { status: 405, headers: cors });

    // Gemini ephemeral auth token kekkrom (browser-la safe-ஆ use panna)
    // Token ~30 nimisham valid, oரே session-ku மட்டும்.
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1alpha/auth_tokens?key=" +
        env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Oru call-ku mattum, 1 nimisham-kulla connect aaganum, 30 nimisham max.
          // NOTE: bidiGenerateContentSetup lock podaadhe - adhu client anuppura
          // systemInstruction + tools-ஐ override panni generic agent aakidum.
          uses: 1,
          expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
        }),
      }
    );

    if (!r.ok) {
      const txt = await r.text();
      return new Response(JSON.stringify({ error: txt }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const data = await r.json();
    // data.name = ephemeral token (browser idhை use pannum)
    return new Response(JSON.stringify({ token: data.name }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};
