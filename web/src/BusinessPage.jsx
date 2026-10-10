// BusinessPage.jsx - Business profile, tables, agent settings (read-only)
// Maathanum-naa: web/src/restaurant.js -> RESTAURANT object.

import { RESTAURANT } from "./restaurant";
import { BRAND } from "./brand";

export default function BusinessPage({ phoneNumber }) {
  const r = RESTAURANT;
  const totalTables = r.tables.reduce((n, t) => n + t.count, 0);
  const totalSeats = r.tables.reduce((n, t) => n + t.count * t.seats, 0);

  return (
    <div className="stack">
      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Business profile</h2>
              <div className="card-desc">What the agent tells callers</div>
            </div>
          </div>
          <div className="kv">
            <div className="k">Name</div><div>{r.name}</div>
            <div className="k">Location</div><div>{r.location}</div>
            <div className="k">Opening hours</div><div className="num">{r.openTime} – {r.closeTime}, daily</div>
            <div className="k">Cuisine</div><div>{r.cuisine}</div>
            <div className="k">Specials</div><div>{r.specials.join(", ")}</div>
            <div className="k">Parking</div><div>{r.parking}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Voice agent</h2>
              <div className="card-desc">How calls are handled</div>
            </div>
          </div>
          <div className="kv">
            <div className="k">Agent name</div><div>Priya</div>
            <div className="k">Languages</div><div>Tamil, English, Tanglish</div>
            <div className="k">Phone number</div><div className="num">{phoneNumber || "Not connected"}</div>
            <div className="k">Booking window</div><div className="num">{r.openTime} – {r.lastBookingTime}, 1-hour slots</div>
            <div className="k">Max party by phone</div><div className="num">{r.maxPartySize} guests (larger → manager callback)</div>
            <div className="k">Change / cancel cutoff</div><div className="num">{r.changeCutoffMinutes} minutes before booking</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Tables</h2>
            <div className="card-desc">{totalTables} tables · {totalSeats} seats per hour</div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Table size</th><th>Count</th><th>Seats</th></tr>
            </thead>
            <tbody>
              {r.tables.map((t) => (
                <tr key={t.seats}>
                  <td className="strong">{t.seats}-seat</td>
                  <td className="num">{t.count}</td>
                  <td className="num">{t.count * t.seats}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="faint small" style={{ margin: 0 }}>
        To update these settings, contact {BRAND.company}.
      </p>
    </div>
  );
}
