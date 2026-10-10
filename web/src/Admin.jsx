// Admin.jsx - Z Cloud Voice admin app (http://localhost:5173/admin)
// ------------------------------------------------------------------
// Sidebar layout. Pages: Overview, Bookings, Calls, Customers, Test agent,
// Business. URL hash-la page irukkum (#/calls) - refresh pannaalum adhe page.
//
// ⚠️ Login illa - URL therinja yaar venaalum paakalaam. Public-ஆ deploy pannra
// munnadi Firebase Auth + Firestore rules podanum.

import { useEffect, useState } from "react";
import { RESTAURANT } from "./restaurant";
import { BRAND } from "./brand";
import Icon from "./Icon";
import OverviewPage from "./OverviewPage";
import BookingsPage from "./BookingsPage";
import CallsPanel from "./CallsPanel";
import CustomersPanel from "./CustomersPanel";
import VoiceAgent from "./VoiceAgent";
import BusinessPage from "./BusinessPage";
import { placeCall, checkPhoneLine } from "./callApi";

const NAV = [
  { key: "overview", label: "Overview", icon: "dashboard", title: "Overview", sub: "Today at a glance" },
  { key: "bookings", label: "Bookings", icon: "calendar", title: "Bookings", sub: "Reservations and table capacity" },
  { key: "calls", label: "Calls", icon: "phone", title: "Calls", sub: "Outbound calls, live transcripts and history" },
  { key: "customers", label: "Customers", icon: "users", title: "Customers", sub: "Everyone who has booked with you" },
  { key: "agent", label: "Test agent", icon: "mic", title: "Test agent", sub: "Talk to your agent from the browser" },
  { key: "business", label: "Business", icon: "store", title: "Business", sub: "Profile, tables and agent settings" },
];

const initials = (name) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function useHashPage() {
  const read = () => {
    const key = window.location.hash.replace(/^#\/?/, "");
    return NAV.some((n) => n.key === key) ? key : "overview";
  };
  const [page, setPage] = useState(read);
  useEffect(() => {
    const onChange = () => setPage(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return [page, (key) => (window.location.hash = "/" + key)];
}

export default function Admin() {
  const [page, go] = useHashPage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState(null);
  const [callingPhone, setCallingPhone] = useState(null);
  const [callError, setCallError] = useState(null);
  const [line, setLine] = useState(undefined); // undefined = checking, null = offline

  // Phone server online-aa nu 20 second-ku oru thadava check
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const r = await checkPhoneLine();
      if (alive) setLine(r);
    };
    check();
    const t = setInterval(check, 20000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => setMenuOpen(false), [page]);

  // Endha page-la irundhum click-to-call
  async function callCustomer(phone) {
    setCallError(null);
    setCallingPhone(phone);
    try {
      const { callSid } = await placeCall(phone);
      setSelectedCallId(callSid);
      go("calls"); // live transcript kaattu
    } catch (err) {
      setCallError(`Couldn't call ${phone}: ${err.message}`);
    } finally {
      setCallingPhone(null);
    }
  }

  function openCall(id) {
    setSelectedCallId(id);
    go("calls");
  }

  const current = NAV.find((n) => n.key === page);
  const contact = BRAND.website || (BRAND.email && `mailto:${BRAND.email}`) || (BRAND.whatsapp && `https://wa.me/${BRAND.whatsapp}`);

  return (
    <div className="app">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="workspace">
          <div className="ws-logo">{initials(RESTAURANT.name)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="ws-name">{RESTAURANT.name}</div>
            <div className="ws-sub">Voice agent workspace</div>
          </div>
        </div>

        <nav className="nav">
          <div className="nav-label">Workspace</div>
          {NAV.slice(0, 4).map((n) => (
            <a key={n.key} href={`#/${n.key}`} className={`nav-item ${page === n.key ? "active" : ""}`}>
              <Icon name={n.icon} />
              {n.label}
            </a>
          ))}
          <div className="nav-label">Agent</div>
          {NAV.slice(4).map((n) => (
            <a key={n.key} href={`#/${n.key}`} className={`nav-item ${page === n.key ? "active" : ""}`}>
              <Icon name={n.icon} />
              {n.label}
            </a>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="line-status" title={line?.number ? `Twilio ${line.number}` : ""}>
            <span className={`dot ${line ? "on" : line === null ? "off" : ""}`} />
            {line === undefined ? "Checking phone line..." : line ? "Phone line online" : "Phone line offline"}
          </div>
          <div className="cta">
            <div className="cta-title">AI call agents for your business</div>
            <div className="cta-text">
              {BRAND.company} builds Tamil &amp; English voice agents for bookings, enquiries and follow-ups.
            </div>
            {contact ? (
              <a className="cta-link" href={contact} target="_blank" rel="noreferrer">
                Contact {BRAND.company} <Icon name="arrowRight" size={13} />
              </a>
            ) : (
              <div className="cta-link">Contact {BRAND.company}</div>
            )}
          </div>
          <div className="powered">Powered by {BRAND.company}</div>
        </div>
      </aside>
      <div className={`backdrop ${menuOpen ? "show" : ""}`} onClick={() => setMenuOpen(false)} />

      <main className="main">
        <header className="page-header">
          <div className="row" style={{ flexWrap: "nowrap", minWidth: 0 }}>
            <button className="btn btn-ghost btn-icon menu-btn" onClick={() => setMenuOpen(true)} aria-label="Menu">
              <Icon name="menu" size={18} />
            </button>
            <div style={{ minWidth: 0 }}>
              <h1 className="page-title">{current.title}</h1>
              <div className="page-sub">{current.sub}</div>
            </div>
          </div>
        </header>

        <div className="content">
          {callError && (
            <div className="alert alert-red" style={{ marginBottom: 16 }}>
              <span>{callError}</span>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setCallError(null)} aria-label="Dismiss">
                <Icon name="x" />
              </button>
            </div>
          )}

          {page === "overview" && <OverviewPage onCall={callCustomer} callingPhone={callingPhone} onOpenCall={openCall} go={go} />}
          {page === "bookings" && <BookingsPage onCall={callCustomer} callingPhone={callingPhone} />}
          {page === "calls" && (
            <CallsPanel onCall={callCustomer} callingPhone={callingPhone} selectedId={selectedCallId} onSelect={setSelectedCallId} />
          )}
          {page === "customers" && <CustomersPanel onCall={callCustomer} callingPhone={callingPhone} />}
          {page === "agent" && <VoiceAgent embedded />}
          {page === "business" && <BusinessPage phoneNumber={line?.number} />}
        </div>
      </main>
    </div>
  );
}
