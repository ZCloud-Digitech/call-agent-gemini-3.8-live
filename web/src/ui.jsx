// ui.jsx - Admin pages share pannra chinna UI pieces

export const initials = (name) =>
  (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

// Firestore timestamp -> "10/10/26, 7:42 pm"
export const fmtDateTime = (ts) =>
  ts?.toDate ? ts.toDate().toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "";

// Firestore timestamp -> "7:42 pm"
export const fmtClock = (ts) =>
  ts?.toDate ? ts.toDate().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "";

export const fmtDuration = (s) => (s == null ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

const BOOKING = {
  confirmed: ["blue", "Confirmed"],
  seated: ["green", "Seated"],
  cancelled: ["red", "Cancelled"],
};
export function BookingStatus({ status }) {
  const [color, label] = BOOKING[status || "confirmed"] || ["", status];
  return <span className={`badge ${color}`}>{label}</span>;
}

export const ACTIVE_CALL = ["queued", "initiated", "ringing", "in-progress"];
const CALL = {
  queued: ["amber", "Starting"],
  initiated: ["amber", "Starting"],
  ringing: ["amber", "Ringing"],
  "in-progress": ["green", "Live"],
  completed: ["", "Completed"],
  busy: ["red", "Busy"],
  "no-answer": ["red", "No answer"],
  failed: ["red", "Failed"],
  canceled: ["", "Canceled"],
};
export function CallStatus({ status }) {
  const [color, label] = CALL[status] || ["", status || "Unknown"];
  return <span className={`badge ${color}`}>{label}</span>;
}

// Table capacity colour: free / filling / full
export function capacityLevel(used, total) {
  if (used >= total) return "full";
  return used / total >= 0.6 ? "mid" : "";
}
