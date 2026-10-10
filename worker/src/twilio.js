// twilio.js - Twilio REST calls + request security (Worker version)

const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const auth = (env) => "Basic " + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);

// "9876543210" / "+91 98765 43210" -> "+919876543210"; thappu-naa null
export function toE164(phone) {
  const raw = String(phone || "").trim();
  const d = raw.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(d)) return "+91" + d;
  if (raw.startsWith("+") && d.length >= 10 && d.length <= 15) return "+" + d;
  return null;
}

// "+919876543210" -> "9876543210"; India mobile illa-naa null
export function indianMobile(from) {
  const d = String(from || "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

export async function makeCall(env, origin, phone) {
  const missing = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_NUMBER"].filter((k) => !env[k]);
  if (missing.length) throw new Error("Worker secrets set aagala: " + missing.join(", "));
  const to = toE164(phone);
  if (!to) throw new Error("Phone number thappu (10 digit India mobile illa +countrycode venum)");

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json`, {
    method: "POST",
    headers: { Authorization: auth(env), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams([
      ["To", to],
      ["From", env.TWILIO_NUMBER],
      ["Url", `${origin}/twilio/voice`],
      ["Method", "POST"],
      ["StatusCallback", `${origin}/twilio/status`],
      ["StatusCallbackMethod", "POST"],
      ["StatusCallbackEvent", "initiated"],
      ["StatusCallbackEvent", "ringing"],
      ["StatusCallbackEvent", "answered"],
      ["StatusCallbackEvent", "completed"],
    ]),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Twilio error " + res.status);
  return { callSid: data.sid, to };
}

export async function endCall(env, callSid) {
  if (!/^CA[0-9a-f]{32}$/i.test(callSid || "")) throw new Error("Call ID thappu");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls/${callSid}.json`,
    {
      method: "POST",
      headers: { Authorization: auth(env), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ Status: "completed" }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Twilio error " + res.status);
}

async function hmac(algo, secret, message) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: algo }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", key, enc.encode(message));
}

// Twilio-dhaan anuppuchaa nu check (X-Twilio-Signature):
// HMAC-SHA1(auth token, URL + sorted param name+value), base64
export async function isFromTwilio(env, url, params, signature) {
  if (!signature || !env.TWILIO_AUTH_TOKEN) return false;
  const data = url + [...params.keys()].sort().map((k) => k + params.get(k)).join("");
  const expected = b64(await hmac("SHA-1", env.TWILIO_AUTH_TOKEN, data));
  return expected === signature;
}

// Media stream WebSocket-ku per-call token (Twilio signature WS-la check panna kashtam)
export async function streamToken(env, callSid) {
  const sig = new Uint8Array(await hmac("SHA-256", env.TWILIO_AUTH_TOKEN || env.GEMINI_API_KEY, "stream:" + callSid));
  return [...sig.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
