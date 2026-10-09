// bookings.js - Agent call pannra tools-oda real logic
// ----------------------------------------------------
// Ovvoru function-um { ok, ... } return pannum; adhu apdiye Gemini-ku pogum,
// adha vachu agent caller-kitta pesum.

import { RESTAURANT } from "./restaurant";
import { saveBooking, getBookedSeats } from "./firebase";

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const slotOf = (time) => time.slice(0, 2) + ":00"; // 1-hour slots

function todayIST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

// Common validation - error-naa string, ok-naa null
function validate({ date, time, people }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return "Date format thappu (YYYY-MM-DD venum).";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || "")) return "Time format thappu (HH:MM 24-hour venum).";
  if (date < todayIST()) return "Andha date already poiduchu.";
  const t = toMin(time);
  if (t < toMin(RESTAURANT.openTime) || t > toMin(RESTAURANT.lastBookingTime))
    return `Booking ${RESTAURANT.openTime} - ${RESTAURANT.lastBookingTime} kulla mattum.`;
  const p = Number(people);
  if (!Number.isInteger(p) || p < 1) return "Ethana per nu sariya theriyala.";
  if (p > RESTAURANT.maxPartySize)
    return `${RESTAURANT.maxPartySize} per-ku mela - manager callback venum.`;
  return null;
}

async function seatsLeft(date, time) {
  const booked = await getBookedSeats(date, slotOf(time));
  return RESTAURANT.seatsPerSlot - booked;
}

async function checkAvailability({ date, time, people }) {
  const err = validate({ date, time, people });
  if (err) return { ok: false, available: false, reason: err };

  if ((await seatsLeft(date, time)) >= people) return { ok: true, available: true };

  // Pakkathula irukka slots-la free edhu nu paaru (±2 hours)
  const alternatives = [];
  const base = toMin(slotOf(time));
  for (const d of [60, -60, 120, -120]) {
    const alt = toHHMM(base + d);
    if (validate({ date, time: alt, people })) continue;
    if ((await seatsLeft(date, alt)) >= people) alternatives.push(alt);
  }
  return { ok: true, available: false, alternatives };
}

async function bookTable({ name, phone, date, time, people, notes = "" }) {
  const digits = String(phone || "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  if (!/^[6-9]\d{9}$/.test(digits))
    return { ok: false, reason: "Phone number 10 digit valid mobile number-ஆ illa." };
  if (!name?.trim()) return { ok: false, reason: "Peyar venum." };

  const err = validate({ date, time, people });
  const largeParty = Number(people) > RESTAURANT.maxPartySize;
  if (err && !largeParty) return { ok: false, reason: err };

  // Save pannra munnadi thirumba check - naduvula vera yaaraavadhu book pannirukalaam
  if (!largeParty && (await seatsLeft(date, time)) < people)
    return { ok: false, reason: "Indha slot ippo full aagiduchu. check_availability thirumba pannu." };

  const ref = await saveBooking({
    name: name.trim(),
    phone: digits,
    date,
    time,
    slot: slotOf(time),
    people: Number(people),
    notes: largeParty ? `LARGE PARTY - callback. ${notes}`.trim() : notes,
  });
  return { ok: true, bookingId: ref.id.slice(0, 6).toUpperCase() };
}

// Gemini function name -> handler
export const toolHandlers = {
  check_availability: checkAvailability,
  save_booking: bookTable,
};
