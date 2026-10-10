// BookingsPage.jsx - Date-wise bookings + slot capacity
// ------------------------------------------------------
// Firestore-la irundhu live-ஆ varum: agent pudhu booking save pannina udane
// beep + highlight-oda theriyum. Refresh venaam.

import { useEffect, useState } from "react";
import { RESTAURANT, nowIST } from "./restaurant";
import { allSlots, freeTablesInSlot, describe } from "./bookings";
import { watchBookingsForDate, setBookingStatus } from "./firebase";
import Icon from "./Icon";
import { BookingStatus, capacityLevel } from "./ui";

const TOTAL_TABLES = RESTAURANT.tables.reduce((n, t) => n + t.count, 0);

// Pudhu booking vandha chinna "ding"
function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

export default function BookingsPage({ onCall, callingPhone }) {
  const today = nowIST().date;
  const [date, setDate] = useState(today);
  const [bookings, setBookings] = useState([]);
  const [newIds, setNewIds] = useState([]); // highlight panna
  const [error, setError] = useState(null);

  useEffect(() => {
    let first = true; // mudhal snapshot = already irukkra bookings, beep venaam
    setError(null);
    return watchBookingsForDate(
      date,
      (all, added) => {
        setBookings(all);
        if (!first && added.length) {
          const ids = added.map((b) => b.id);
          setNewIds((cur) => [...cur, ...ids]);
          beep();
          setTimeout(() => setNewIds((cur) => cur.filter((id) => !ids.includes(id))), 10000);
        }
        first = false;
      },
      (err) => setError(err.message)
    );
  }, [date]);

  const active = bookings.filter((b) => b.status !== "cancelled");
  const sorted = [...bookings].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const guests = active.reduce((n, b) => n + (Number(b.people) || 0), 0);

  async function changeStatus(b, status) {
    if (status === "cancelled" && !confirm(`Cancel ${b.name}'s booking at ${b.time}?`)) return;
    try {
      await setBookingStatus(b.id, status);
    } catch (err) {
      alert("Couldn't update: " + err.message);
    }
  }

  return (
    <div className="stack">
      <div className="row">
        <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        {date !== today && (
          <button className="btn" onClick={() => setDate(today)}>Today</button>
        )}
        <div className="spacer" />
        <span className="faint small">
          {active.length} bookings · {guests} guests
        </span>
      </div>

      {error && <div className="alert alert-red">Couldn't load bookings: {error}</div>}

      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Reservations</h2>
            <div className="card-desc">New bookings from calls appear here instantly</div>
          </div>
        </div>
        {sorted.length === 0 ? (
          <div className="empty">No bookings for this date.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Guest</th>
                  <th>Party</th>
                  <th>Tables</th>
                  <th>Notes</th>
                  <th>Status</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((b) => (
                  <tr key={b.id} className={`${newIds.includes(b.id) ? "is-new" : ""} ${b.status === "cancelled" ? "is-cancelled" : ""}`}>
                    <td>
                      <div className="strong num">{b.time}</div>
                      <div className="mono">#{b.code || b.id.slice(0, 6).toUpperCase()}</div>
                    </td>
                    <td>
                      <div className="strong">
                        {b.name} {newIds.includes(b.id) && <span className="badge green plain">New</span>}
                      </div>
                      <div className="faint small num">{b.phone}</div>
                    </td>
                    <td className="num">{b.people}</td>
                    <td className="small muted">{(b.tables || []).map((s) => `${s}-seat`).join(" + ") || "—"}</td>
                    <td className="small muted" style={{ maxWidth: 220 }}>{b.notes || "—"}</td>
                    <td>
                      <BookingStatus status={b.status} />
                      {b.updatedAt && b.status !== "cancelled" && <div className="small" style={{ color: "var(--amber)", marginTop: 4 }}>Modified</div>}
                    </td>
                    <td className="right" style={{ whiteSpace: "nowrap" }}>
                      <div className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                        <button
                          className="btn btn-sm btn-icon"
                          title={`Call ${b.phone}`}
                          onClick={() => onCall(b.phone)}
                          disabled={callingPhone === b.phone}
                        >
                          <Icon name="phone" size={14} />
                        </button>
                        {b.status !== "cancelled" && b.status !== "seated" && (
                          <button className="btn btn-sm" onClick={() => changeStatus(b, "seated")}>
                            <Icon name="check" size={14} /> Seat
                          </button>
                        )}
                        {b.status !== "cancelled" && (
                          <button className="btn btn-sm btn-ghost" style={{ color: "var(--red)" }} onClick={() => changeStatus(b, "cancelled")}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Table capacity</h2>
            <div className="card-desc">{TOTAL_TABLES} tables available each hour</div>
          </div>
        </div>
        <div className="slots">
          {allSlots().map((slot) => {
            const free = freeTablesInSlot(active, slot);
            const freeCount = Object.values(free).reduce((n, x) => n + x, 0);
            const used = TOTAL_TABLES - freeCount;
            return (
              <div key={slot} className="slot">
                <div className="slot-top">
                  <span className="slot-time">{slot}</span>
                  <span className="faint small num">{used}/{TOTAL_TABLES}</span>
                </div>
                <div className={`bar ${capacityLevel(used, TOTAL_TABLES)}`}>
                  <span style={{ width: `${(used / TOTAL_TABLES) * 100}%` }} />
                </div>
                <div className="slot-meta">
                  {freeCount === 0 ? "Fully booked" : `Free: ${describe(free).replaceAll("-per", "-seat")}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
