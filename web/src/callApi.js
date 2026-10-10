// callApi.js - Admin page -> Cloudflare Worker (phone backend)
// -------------------------------------------------------------
// VITE_API_URL (illa-naa VITE_TOKEN_URL - adhae Worker) URL-ku pogum.
// Local: worker-la `npm run dev` (http://localhost:8787). Admin key = ADMIN_TOKEN.

const API = (import.meta.env.VITE_API_URL || import.meta.env.VITE_TOKEN_URL || "").replace(/\/$/, "");
const KEY_STORAGE = "zcv-admin-key";

function storedKey() {
  try {
    return localStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

function askKey() {
  const key = window.prompt("Admin key (Worker ADMIN_TOKEN):");
  if (key) {
    try {
      localStorage.setItem(KEY_STORAGE, key.trim());
    } catch {}
  }
  return key?.trim() || null;
}

async function post(path, body, retried = false) {
  if (!API) throw new Error("web/.env-la VITE_API_URL (Worker URL) set pannunga");
  const key = storedKey() || askKey();
  if (!key) throw new Error("Admin key venum");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
  let res;
  try {
    res = await fetch(API + path, { method: "POST", headers, body: JSON.stringify(body) });
  } catch {
    throw new Error("Phone backend-a reach panna mudiyala");
  }
  // Key thappu-naa thirumba kelu (oru thadava)
  if (res.status === 401 && !retried) {
    try {
      localStorage.removeItem(KEY_STORAGE);
    } catch {}
    if (askKey()) return post(path, body, true);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Phone backend error " + res.status);
  return data;
}

// Customer number-ku Twilio call -> { callSid, to }
export const placeCall = (phone) => post("/api/call", { phone });

// Live call-ai cut pannu
export const hangupCall = (callSid) => post("/api/hangup", { callSid });

// Phone backend online-aa? -> { ok, twilio, number } illa null
export async function checkPhoneLine() {
  if (!API) return null;
  try {
    const res = await fetch(API + "/api/health");
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
