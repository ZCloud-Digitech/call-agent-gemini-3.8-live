// OverviewPage.jsx - Inniku summary: KPIs, adutha bookings, recent calls, capacity

import { useEffect, useState } from "react";
import { RESTAURANT, nowIST } from "./restaurant";
import { allSlots, freeTablesInSlot } from "./bookings";
import { watchBookingsForDate, watchRecentCalls } from "./firebase";
import Icon from "./Icon";
import { CallStatus, fmtClock, fmtDuration, capacityLevel } from "./ui";

const TOTAL_TABLES = RESTAURANT.tables.reduce((n, t) => n + t.count, 0);

export default function OverviewPage({ onCall, callingPhone, onOpenCall, go }) {
  const today = nowIST();
  const [bookings, setBookings] = useState([]);
  const [calls, setCalls] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => watchBookingsForDate(today.date, setBookings, (e) => setError(e.message)), [today.date]);
  useEffect(() => watchRecentCalls(setCalls, (e) => setError(e.message)), []);

  const active = bookings.filter((b) => b.status !== "cancelled");
  const guests = active.reduce((n, b) => n + (Number(b.people) || 0), 0);
  const seated = bookings.filter((b) => b.status === "seated").length;
  const todayCalls = calls.filter((c) => c.startedAt?.toDate?.().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === today.date);
  const answered = todayCalls.filter((c) => ["completed", "in-progress"].includes(c.status)).length;

  const upcoming = active
    .filter((b) => b.status !== "seated" && b.time >= today.time)
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, 6);

  return (
    <div className="stack">
      {error && <div className="alert alert-red">Couldn't load data: {error}</div>}

      <div className="kpis">
        <Kpi icon="calendar" label="Bookings today" value={active.length} foot={`${bookings.length - active.length} cancelled`} />
        <Kpi icon="users" label="Guests expected" value={guests} foot={`${seated} seated`} />
        <Kpi icon="phone" label="Calls today" value={todayCalls.length} foot={`${answered} answered`} />
        <Kpi
          icon="chair"
          label="Peak slot usage"
          value={`${Math.max(0, ...allSlots().map((s) => TOTAL_TABLES - sum(freeTablesInSlot(active, s))))}/${TOTAL_TABLES}`}
          foot="tables in busiest hour"
        />
      </div>

      <div className="grid-3-1">
        <div className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Upcoming today</h2>
              <div className="card-desc">Next reservations from {today.time}</div>
            </div>
            <button className="btn btn-sm" onClick={() => go("bookings")}>View all</button>
          </div>
          {upcoming.length === 0 ? (
            <div className="empty">No more bookings today.</div>
          ) : (
            upcoming.map((b) => (
              <div key={b.id} className="list-row">
                <span className="time-chip">{b.time}</span>
                <div className="list-main">
                  <div className="list-title">{b.name}</div>
                  <div className="list-sub">
                    {b.people} guests{b.notes ? ` · ${b.notes}` : ""}
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-icon"
                  title={`Call ${b.phone}`}
                  onClick={() => onCall(b.phone)}
                  disabled={callingPhone === b.phone}
                >
                  <Icon name="phone" size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Capacity</h2>
              <div className="card-desc">Tables booked per hour</div>
            </div>
          </div>
          <div style={{ padding: "8px 0" }}>
            {allSlots().map((slot) => {
              const used = TOTAL_TABLES - sum(freeTablesInSlot(active, slot));
              return (
                <div key={slot} className="cap-row">
                  <span className="cap-time">{slot}</span>
                  <div className={`bar ${capacityLevel(used, TOTAL_TABLES)}`}>
                    <span style={{ width: `${(used / TOTAL_TABLES) * 100}%` }} />
                  </div>
                  <span className="cap-num">{used}/{TOTAL_TABLES}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Recent calls</h2>
            <div className="card-desc">Latest conversations handled by the agent</div>
          </div>
          <button className="btn btn-sm" onClick={() => go("calls")}>Open calls</button>
        </div>
        {calls.length === 0 ? (
          <div className="empty">No calls yet.</div>
        ) : (
          calls.slice(0, 5).map((c) => (
            <div key={c.id} className="list-row clickable" onClick={() => onOpenCall(c.id)}>
              <span className="dir-icon">
                <Icon name={c.direction === "inbound" ? "incoming" : "outgoing"} size={14} />
              </span>
              <div className="list-main">
                <div className="list-title">{c.phone || "Unknown number"}</div>
                <div className="list-sub">
                  {c.direction === "inbound" ? "Incoming" : "Outgoing"} · {fmtClock(c.startedAt)}
                  {c.durationSec != null && ` · ${fmtDuration(c.durationSec)}`}
                  {c.lines?.length ? ` · ${c.lines.filter((l) => l.role !== "tool").length} messages` : ""}
                </div>
              </div>
              <CallStatus status={c.status} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const sum = (obj) => Object.values(obj).reduce((n, x) => n + x, 0);

function Kpi({ icon, label, value, foot }) {
  return (
    <div className="card kpi">
      <div className="kpi-label">
        <Icon name={icon} size={14} /> {label}
      </div>
      <div className="kpi-value num">{value}</div>
      {foot && <div className="kpi-foot">{foot}</div>}
    </div>
  );
}
