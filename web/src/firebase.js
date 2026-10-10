// firebase.js - Booking / call log-ஐ Firestore-la save panna
// -----------------------------------------------------------
// Firebase Console > Project Settings-la இருந்து config copy panni web/.env-la podu.
// Ovvoru business client-kum thaniya Firebase project-naa, .env மட்டும் maathina போதும்.

import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, getDocs, query, where, serverTimestamp,
  onSnapshot, doc, updateDoc, setDoc, arrayUnion, orderBy, limit,
} from "firebase/firestore";

// Values web/.env-la irundhu varum (VITE_FIREBASE_*).
// Browser-la Vite import.meta.env tharum; phone server (Node)-la process.env.
const env = import.meta.env ?? process.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Booking code = doc id-oda mudhal 6 letters (caller-ku solla, thirumba thedi kandupidikka)
export const codeOf = (id) => id.slice(0, 6).toUpperCase();

// saveBooking({ name: "Arun", phone: "98xxxxxxxx", people: 4, date: "2026-10-10", time: "20:00", slot: "20:00" })
export async function saveBooking(booking) {
  const ref = doc(collection(db, "bookings"));
  await setDoc(ref, {
    ...booking,
    code: codeOf(ref.id),
    status: "confirmed",
    createdAt: serverTimestamp(),
  });
  return ref;
}

// Booking-ai maathu (time, per, tables, notes, status...)
export function updateBooking(id, fields) {
  return updateDoc(doc(db, "bookings", id), { ...fields, updatedAt: serverTimestamp() });
}

// Indha phone number-oda ella bookings-um (cancelled include)
export async function getBookingsByPhone(phone) {
  const q = query(collection(db, "bookings"), where("phone", "==", phone));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, code: codeOf(d.id), ...d.data() }));
}

// Oru date-oda ella bookings-um (slot-wise free tables calculate panna)
export async function getBookingsForDate(date) {
  const q = query(collection(db, "bookings"), where("date", "==", date));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((b) => b.status !== "cancelled");
}

// Admin page: oru date-oda bookings-ai live-ஆ watch pannum.
// onChange(allBookings, newlyAdded) - pudhu booking vandha udane call aagum.
// Return pannra function-ai call panna listening nirkum.
export function watchBookingsForDate(date, onChange, onError) {
  const q = query(collection(db, "bookings"), where("date", "==", date));
  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const added = snap
        .docChanges()
        .filter((c) => c.type === "added")
        .map((c) => ({ id: c.doc.id, ...c.doc.data() }));
      onChange(all, added);
    },
    onError
  );
}

// Customers list-ku: ella bookings-um (pudhusu modhalla, max 500)
export function watchAllBookings(onChange, onError) {
  const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"), limit(500));
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

// status: "confirmed" | "seated" | "cancelled"
// (updatedAt podaadhu - admin page-la "changed" = caller details maathinadhu mattum)
export function setBookingStatus(id, status) {
  return updateDoc(doc(db, "bookings", id), { status });
}

// ---------- Phone call logs (server ezhudhum, admin page live-ஆ paakkum) ----------
// calls/{callSid}: { phone, direction, status, startedAt, endedAt, lines: [{role, text, at}] }

export function saveCall(callSid, fields) {
  return setDoc(doc(db, "calls", callSid), fields, { merge: true });
}

// role: "user" | "agent" | "tool"
export function appendCallLine(callSid, role, text) {
  return setDoc(
    doc(db, "calls", callSid),
    { lines: arrayUnion({ role, text, at: Date.now() }) },
    { merge: true }
  );
}

export function watchRecentCalls(onChange, onError) {
  const q = query(collection(db, "calls"), orderBy("startedAt", "desc"), limit(20));
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

export { serverTimestamp };
