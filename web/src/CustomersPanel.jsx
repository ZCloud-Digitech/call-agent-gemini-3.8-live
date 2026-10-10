// CustomersPanel.jsx - Already booking panna customers list + click-to-call
// --------------------------------------------------------------------------
// Bookings-la irundhu phone number vaariyaa group pannrom: peyar, ethana
// booking, adutha booking. Call click panna udane agent andha number-ku call pannum.

import { useEffect, useMemo, useState } from "react";
import { watchAllBookings } from "./firebase";
import { nowIST } from "./restaurant";
import Icon from "./Icon";
import { initials } from "./ui";

export default function CustomersPanel({ onCall, callingPhone }) {
  const [bookings, setBookings] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => watchAllBookings(setBookings, (err) => setError(err.message)), []);

  const customers = useMemo(() => {
    const today = nowIST().date;
    const byPhone = new Map();
    // bookings pudhusu modhalla varudhu -> mudhal-la paakkura peyar = latest peyar
    for (const b of bookings) {
      if (!b.phone) continue;
      const c = byPhone.get(b.phone) || { phone: b.phone, name: b.name, total: 0, cancelled: 0, last: null, next: null };
      c.total++;
      if (b.status === "cancelled") c.cancelled++;
      const when = `${b.date} ${b.time}`;
      if (!c.last || when > c.last) c.last = when;
      if (b.status !== "cancelled" && b.date >= today && (!c.next || when < c.next)) c.next = when;
      byPhone.set(b.phone, c);
    }
    return [...byPhone.values()].sort((a, b) => (b.last || "").localeCompare(a.last || ""));
  }, [bookings]);

  const q = search.trim().toLowerCase();
  const shown = q
    ? customers.filter((c) => c.phone.includes(q) || (c.name || "").toLowerCase().includes(q))
    : customers;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">All customers</h2>
          <div className="card-desc">{customers.length} people have booked with you</div>
        </div>
        <div className="input-icon">
          <Icon name="search" size={14} />
          <input
            className="input"
            placeholder="Search name or number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
          />
        </div>
      </div>
      {error && <div className="alert alert-red" style={{ margin: 16 }}>Couldn't load customers: {error}</div>}

      {shown.length === 0 ? (
        <div className="empty">{customers.length ? "No customers match your search." : "Customers appear here after their first booking."}</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Bookings</th>
                <th>Last visit</th>
                <th>Next booking</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.phone}>
                  <td>
                    <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                      <div className="avatar">{initials(c.name)}</div>
                      <div>
                        <div className="strong">{c.name || "—"}</div>
                        <div className="faint small num">{c.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="num">
                    {c.total}
                    {c.cancelled > 0 && <span className="faint small"> · {c.cancelled} cancelled</span>}
                  </td>
                  <td className="small muted num">{c.last || "—"}</td>
                  <td>{c.next ? <span className="badge blue">{c.next}</span> : <span className="faint">—</span>}</td>
                  <td className="right">
                    <button className="btn btn-sm" onClick={() => onCall(c.phone)} disabled={callingPhone === c.phone}>
                      <Icon name="phone" size={14} /> {callingPhone === c.phone ? "Calling..." : "Call"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
