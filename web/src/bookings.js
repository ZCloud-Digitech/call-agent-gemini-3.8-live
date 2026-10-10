// bookings.js - Agent call pannra tools-oda real logic
// ----------------------------------------------------
// Ovvoru function-um { ok, ... } return pannum; adhu apdiye Gemini-ku pogum,
// adha vachu agent caller-kitta pesum.
//
// Availability table-wise: ovvoru 1-hour slot-kum RESTAURANT.tables full-ஆ
// irukku; ovvoru booking-um adhukku assign aana tables-ai edukkum.

import { RESTAURANT, nowIST } from "./restaurant.js";

// Database "store" - createToolHandlers(store) set pannum. Venum functions:
//   saveBooking(data) -> { id }, getBookingsForDate(date), getBookingsByPhone(phone),
//   updateBooking(id, fields)
// Browser / Node: ./firebase.js;  Cloudflare Worker: worker/src/firestore.js
let store = null;
const codeOf = (id) => id.slice(0, 6).toUpperCase();

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const slotOf = (time) => time.slice(0, 2) + ":00"; // 1-hour slots

// Ella booking slots: openTime, +1h, ... lastBookingTime
export function allSlots() {
  const slots = [];
  for (let m = toMin(RESTAURANT.openTime); m <= toMin(RESTAURANT.lastBookingTime); m += 60)
    slots.push(toHHMM(m));
  return slots;
}

function validateDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return "Date format thappu (YYYY-MM-DD venum).";
  if (date < nowIST().date) return "Andha date already poiduchu.";
  return null;
}

function validatePeople(people) {
  const p = Number(people);
  if (!Number.isInteger(p) || p < 1) return "Ethana per nu sariya theriyala.";
  if (p > RESTAURANT.maxPartySize)
    return `${RESTAURANT.maxPartySize} per-ku mela - manager callback venum.`;
  return null;
}

// Common validation - error-naa string, ok-naa null
function validate({ date, time, people }) {
  const dErr = validateDate(date);
  if (dErr) return dErr;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || "")) return "Time format thappu (HH:MM 24-hour venum).";
  const t = toMin(time);
  if (t < toMin(RESTAURANT.openTime) || t > toMin(RESTAURANT.lastBookingTime))
    return `Booking ${RESTAURANT.openTime} - ${RESTAURANT.lastBookingTime} kulla mattum.`;
  const now = nowIST();
  if (date === now.date && t <= toMin(now.time)) return "Inniku andha time already poiduchu.";
  return validatePeople(people);
}

// free = { 2: 6, 4: 6, ... } (seats -> evlo table free)
// Party-ku tables pick pannu: fit aagra chinna single table; illa-naa tables join.
function allocate(free, people) {
  const f = { ...free };
  const sizes = Object.keys(f).map(Number).sort((a, b) => a - b);
  const picked = [];
  let left = people;
  while (left > 0) {
    const fit = sizes.find((s) => s >= left && f[s] > 0);
    if (fit) {
      picked.push(fit);
      f[fit]--;
      return picked;
    }
    const biggest = [...sizes].reverse().find((s) => f[s] > 0);
    if (!biggest) return null; // podhumaana tables illa
    picked.push(biggest);
    f[biggest]--;
    left -= biggest;
  }
  return picked;
}

export function freeTablesInSlot(bookings, slot) {
  const free = Object.fromEntries(RESTAURANT.tables.map((t) => [t.seats, t.count]));
  for (const b of bookings) {
    if (b.slot !== slot) continue;
    // Pazhaya bookings-la tables field illa - ippo allocate panni kazhi
    const used = b.tables || allocate(free, Number(b.people) || 0) || [];
    for (const s of used) if (free[s] > 0) free[s]--;
  }
  return free;
}

// { 2: 6, 4: 1 } -> "6 x 2-per, 1 x 4-per" (agent pesa easy)
export const describe = (free) =>
  Object.entries(free)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} x ${s}-per`)
    .join(", ") || "full";
const describeTables = (tables) => tables.map((s) => `${s}-per table`).join(" + ");

async function listAvailableSlots({ date, people }) {
  const dErr = validateDate(date);
  if (dErr) return { ok: false, reason: dErr };
  if (people != null) {
    const pErr = validatePeople(people);
    if (pErr) return { ok: false, reason: pErr };
  }

  const now = nowIST();
  const bookings = await store.getBookingsForDate(date);
  const slots = allSlots()
    .filter((s) => date !== now.date || toMin(s) > toMin(now.time))
    .map((time) => {
      const free = freeTablesInSlot(bookings, time);
      const slot = { time, freeTables: describe(free) };
      if (people != null) slot.fitsParty = !!allocate(free, Number(people));
      return slot;
    });

  if (!slots.length) return { ok: true, slots: [], note: "Inniku booking time mudinjiduchu." };
  return { ok: true, date, slots };
}

async function checkAvailability({ date, time, people }) {
  const err = validate({ date, time, people });
  if (err) return { ok: false, available: false, reason: err };

  const bookings = await store.getBookingsForDate(date);
  const tables = allocate(freeTablesInSlot(bookings, slotOf(time)), Number(people));
  if (tables) return { ok: true, available: true, tables: describeTables(tables) };

  return { ok: true, available: false, alternatives: alternativesFor(bookings, date, time, people) };
}

// Same naal-la free-ஆ irukkra pakkathu slots (nearest first)
function alternativesFor(bookings, date, time, people) {
  const base = toMin(slotOf(time));
  return allSlots()
    .filter((s) => s !== slotOf(time) && !validate({ date, time: s, people }))
    .filter((s) => allocate(freeTablesInSlot(bookings, s), Number(people)))
    .sort((a, b) => Math.abs(toMin(a) - base) - Math.abs(toMin(b) - base))
    .slice(0, 3);
}

const normPhone = (phone) =>
  String(phone || "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
const PHONE_ERR = { ok: false, reason: "Phone number 10 digit valid mobile number-ஆ illa." };

// Indha number-oda innum varappogura (cancel aagaadha) bookings
async function upcomingByPhone(phone) {
  const now = nowIST();
  const all = await store.getBookingsByPhone(phone);
  return all
    .filter((b) => b.status !== "cancelled" && b.status !== "seated")
    .filter((b) => b.date > now.date || (b.date === now.date && b.time >= now.time))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

// Agent-ku solla easy-aana booking summary
const summary = (b) => ({
  bookingId: b.code,
  name: b.name,
  date: b.date,
  time: b.time,
  people: b.people,
  tables: b.tables?.length ? describeTables(b.tables) : "manager callback",
  notes: b.notes || "",
});

// Booking time-ku cutoff nimisham munnadi vara mattum call-la maatha/cancel panna mudiyum
function tooLateToChange(b) {
  const now = nowIST();
  if (b.date !== now.date) return false;
  return toMin(b.time) - toMin(now.time) < RESTAURANT.changeCutoffMinutes;
}

async function bookTable({ name, phone, date, time, people, notes = "", allow_second_booking = false }) {
  const digits = normPhone(phone);
  if (!/^[6-9]\d{9}$/.test(digits)) return PHONE_ERR;
  if (!name?.trim()) return { ok: false, reason: "Peyar venum." };

  const largeParty = Number(people) > RESTAURANT.maxPartySize;
  const err = validate({ date, time, people });
  if (err && !largeParty) return { ok: false, reason: err };

  // Same number-la same naal already booking irukka? Caller-kitta kekkaama double booking venaam
  if (!allow_second_booking) {
    const sameDay = (await upcomingByPhone(digits)).filter((b) => b.date === date);
    if (sameDay.length)
      return {
        ok: false,
        duplicate: true,
        existing: sameDay.map(summary),
        reason:
          "Indha number-la indha naal-ku already booking irukku. Caller-kitta kelu: adha maathanumaa (update_booking), illa innoru thaniya booking venumaa (appo allow_second_booking=true)?",
      };
  }

  let tables = [];
  if (!largeParty) {
    // Save pannra munnadi thirumba check - naduvula vera yaaraavadhu book pannirukalaam
    const bookings = await store.getBookingsForDate(date);
    tables = allocate(freeTablesInSlot(bookings, slotOf(time)), Number(people));
    if (!tables)
      return { ok: false, reason: "Indha slot ippo full aagiduchu. check_availability thirumba pannu." };
  }

  const ref = await store.saveBooking({
    name: name.trim(),
    phone: digits,
    date,
    time,
    slot: slotOf(time),
    people: Number(people),
    tables,
    // Agent already notes-la pottirundhaa thirumba podaadhe
    notes: largeParty && !/LARGE PARTY/i.test(notes) ? `LARGE PARTY - callback. ${notes}`.trim() : notes,
  });
  return {
    ok: true,
    bookingId: codeOf(ref.id),
    tables: largeParty ? "manager callback" : describeTables(tables),
  };
}

async function findBookings({ phone }) {
  const digits = normPhone(phone);
  if (!/^[6-9]\d{9}$/.test(digits)) return PHONE_ERR;
  const list = await upcomingByPhone(digits);
  if (!list.length) return { ok: true, found: 0, bookings: [] };
  return { ok: true, found: list.length, bookings: list.map(summary) };
}

// phone + bookingId rendum match aanaa mattum booking-ai tharum
async function ownBooking(phone, bookingId) {
  const digits = normPhone(phone);
  if (!/^[6-9]\d{9}$/.test(digits)) return { error: PHONE_ERR };
  const list = await upcomingByPhone(digits);
  const code = String(bookingId || "").trim().toUpperCase();
  const b = code ? list.find((x) => x.code === code) : list.length === 1 ? list[0] : null;
  if (!b)
    return {
      error: {
        ok: false,
        reason: list.length
          ? "Endha booking nu theriyala - bookingId venum (find_bookings result-la irukku)."
          : "Indha number-la varappogura booking edhuvum illa.",
      },
    };
  if (tooLateToChange(b))
    return {
      error: {
        ok: false,
        tooLate: true,
        reason: `Booking time-ku ${RESTAURANT.changeCutoffMinutes} nimisham kulla call-la maatha mudiyaadhu. Restaurant manager-kitta direct-ah pesa sollu.`,
      },
    };
  return { booking: b };
}

async function cancelBooking({ phone, bookingId }) {
  const { booking, error } = await ownBooking(phone, bookingId);
  if (error) return error;
  await store.updateBooking(booking.id, { status: "cancelled" });
  return { ok: true, cancelled: summary(booking) };
}

// Time / date / per maathu, illa special request add pannu
async function changeBooking({ phone, bookingId, date, time, people, add_request }) {
  const { booking: b, error } = await ownBooking(phone, bookingId);
  if (error) return error;

  const next = {
    date: date || b.date,
    time: time || b.time,
    people: people != null ? Number(people) : Number(b.people),
  };
  const fields = {};

  const moved = next.date !== b.date || next.time !== b.time || next.people !== Number(b.people);
  if (moved) {
    const err = validate(next);
    if (err) return { ok: false, reason: err };
    // Indha booking-oda pazhaya tables-ai free-ஆ eduthukittu check pannu
    const others = (await store.getBookingsForDate(next.date)).filter((x) => x.id !== b.id);
    const tables = allocate(freeTablesInSlot(others, slotOf(next.time)), next.people);
    if (!tables)
      return {
        ok: false,
        available: false,
        reason: "Andha time / per-ku table illa. Pazhaya booking apdiye irukku.",
        alternatives: alternativesFor(others, next.date, next.time, next.people),
      };
    Object.assign(fields, next, { slot: slotOf(next.time), tables });
  }

  if (add_request?.trim()) {
    fields.notes = [b.notes, add_request.trim()].filter(Boolean).join("; ");
  }

  if (!Object.keys(fields).length) return { ok: false, reason: "Enna maathanum nu sollala." };
  await store.updateBooking(b.id, fields);
  return { ok: true, updated: summary({ ...b, ...fields }) };
}

// Gemini function name -> handler.  const toolHandlers = createToolHandlers(store)
export function createToolHandlers(dbStore) {
  store = dbStore;
  return toolHandlers;
}

const toolHandlers = {
  list_available_slots: listAvailableSlots,
  check_availability: checkAvailability,
  save_booking: bookTable,
  find_bookings: findBookings,
  cancel_booking: cancelBooking,
  update_booking: changeBooking,
};
