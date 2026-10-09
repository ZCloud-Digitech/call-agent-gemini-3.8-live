// firebase.js - Booking / call log-ஐ Firestore-la save panna
// -----------------------------------------------------------
// Firebase Console > Project Settings-la இருந்து config copy panni web/.env-la podu.
// Ovvoru business client-kum thaniya Firebase project-naa, .env மட்டும் maathina போதும்.

import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp,
} from "firebase/firestore";

// Values web/.env-la irundhu varum (VITE_FIREBASE_*)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// saveBooking({ name: "Arun", phone: "98xxxxxxxx", people: 4, date: "2026-10-10", time: "20:00", slot: "20:00" })
export async function saveBooking(booking) {
  return addDoc(collection(db, "bookings"), {
    ...booking,
    status: "confirmed",
    createdAt: serverTimestamp(),
  });
}

// Oru date + slot-la already evlo per book aagirukkaanga
export async function getBookedSeats(date, slot) {
  const q = query(
    collection(db, "bookings"),
    where("date", "==", date),
    where("slot", "==", slot)
  );
  const snap = await getDocs(q);
  return snap.docs.reduce((n, d) => n + (Number(d.data().people) || 0), 0);
}
