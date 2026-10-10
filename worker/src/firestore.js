// firestore.js - Firestore REST API (Cloudflare Worker-la Firebase SDK work aagaadhu)
// ------------------------------------------------------------------------------------
// web/src/firebase.js-oda adhae functions + adhae data shape. Admin page (Firebase
// SDK) ezhudhuradhum, Worker ezhudhuradhum orae Firestore-la thaan.
// Rules test mode-la irukkanum (web SDK maadhiriye API key mattum use pannrom).

const codeOf = (id) => id.slice(0, 6).toUpperCase();

// Firestore auto-id maadhiri 20-char random id
function autoId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return [...bytes].map((b) => chars[b % chars.length]).join("");
}

// JS value <-> Firestore REST value
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: toFields(v) } };
}
const toFields = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toValue(v)]));

function fromValue(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromValue);
  if ("mapValue" in v) return fromFields(v.mapValue.fields || {});
  return null;
}
const fromFields = (fields) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fromValue(v)]));

export function createFirestore(env) {
  const project = env.FIREBASE_PROJECT_ID;
  const key = env.FIREBASE_API_KEY;
  if (!project || !key) throw new Error("FIREBASE_PROJECT_ID / FIREBASE_API_KEY set aagala");
  const root = `projects/${project}/databases/(default)/documents`;
  const base = `https://firestore.googleapis.com/v1/${root}`;

  async function req(path, body) {
    const res = await fetch(`${base}${path}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error("Firestore: " + (data.error?.message || res.status));
    return data;
  }

  // field == value query
  async function where(collection, field, value) {
    const rows = await req(":runQuery", {
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: toValue(value) } },
      },
    });
    return rows
      .filter((r) => r.document)
      .map((r) => ({ id: r.document.name.split("/").pop(), ...fromFields(r.document.fields || {}) }));
  }

  // Merge write (doc illa-naa create). serverTime: server timestamp podra fields,
  // append: lines array-la add panna items
  async function write(path, fields = {}, { serverTime = [], append = null } = {}) {
    const w = {
      update: { name: `${root}/${path}`, fields: toFields(fields) },
      updateMask: { fieldPaths: Object.keys(fields) },
    };
    const transforms = serverTime.map((f) => ({ fieldPath: f, setToServerValue: "REQUEST_TIME" }));
    if (append) transforms.push({ fieldPath: append.field, appendMissingElements: { values: append.items.map(toValue) } });
    if (transforms.length) w.updateTransforms = transforms;
    await req(":commit", { writes: [w] });
  }

  return {
    // ---- bookings (web/src/bookings.js store) ----
    async saveBooking(booking) {
      const id = autoId();
      await write(`bookings/${id}`, { ...booking, code: codeOf(id), status: "confirmed" }, { serverTime: ["createdAt"] });
      return { id };
    },
    async getBookingsForDate(date) {
      return (await where("bookings", "date", date)).filter((b) => b.status !== "cancelled");
    },
    async getBookingsByPhone(phone) {
      return (await where("bookings", "phone", phone)).map((b) => ({ code: codeOf(b.id), ...b }));
    },
    updateBooking(id, fields) {
      return write(`bookings/${id}`, fields, { serverTime: ["updatedAt"] });
    },

    // ---- call logs (admin page Calls) ----
    saveCall(callSid, fields, serverTime = []) {
      return write(`calls/${callSid}`, fields, { serverTime });
    },
    appendCallLine(callSid, role, text) {
      return write(`calls/${callSid}`, {}, { append: { field: "lines", items: [{ role, text, at: Date.now() }] } });
    },
  };
}
