// CallsPanel.jsx - Number type panni call, live transcript, call history
// ----------------------------------------------------------------------
// "Call" -> /api/call (Vite proxy -> phone server -> Twilio). Transcript phone
// server Firestore "calls"-la ezhudhum; inga onSnapshot vachu live-ஆ varum.

import { useEffect, useRef, useState } from "react";
import { watchRecentCalls } from "./firebase";
import { hangupCall } from "./callApi";
import Icon from "./Icon";
import { ACTIVE_CALL, CallStatus, fmtDateTime, fmtDuration } from "./ui";

const SPEAKER = { agent: "Priya", user: "Customer", tool: "System" };
const lineTime = (at) =>
  at ? new Date(at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "";

// onCall(phone) -> Admin call start pannum; selectedId / onSelect -> endha call kaattanum
export default function CallsPanel({ onCall, callingPhone, selectedId, onSelect }) {
  const [phone, setPhone] = useState("");
  const [calls, setCalls] = useState([]);
  const [error, setError] = useState(null);
  const [ending, setEnding] = useState(false);
  const [showSystem, setShowSystem] = useState(false);
  const transcriptRef = useRef(null);

  useEffect(() => watchRecentCalls(setCalls, (err) => setError("Couldn't load calls: " + err.message)), []);

  const selected = calls.find((c) => c.id === selectedId) || calls[0];
  const live = selected && ACTIVE_CALL.includes(selected.status);
  const lines = (selected?.lines || []).filter((l) => showSystem || l.role !== "tool");

  // Pudhu line vandha transcript keezha scroll
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [selected?.id, lines.length]);

  function startCall(e) {
    e.preventDefault();
    setError(null);
    onCall(phone);
  }

  async function endCall() {
    if (!selected) return;
    setEnding(true);
    try {
      await hangupCall(selected.id);
    } catch (err) {
      setError("Couldn't end call: " + err.message);
    } finally {
      setEnding(false);
    }
  }

  return (
    <div className="stack">
      <form onSubmit={startCall} className="card card-pad row">
        <div style={{ marginRight: 8 }}>
          <div className="card-title">New call</div>
          <div className="card-desc">The agent calls this number and handles the conversation</div>
        </div>
        <div className="spacer" />
        <div className="input-icon">
          <Icon name="phone" size={14} />
          <input
            type="tel"
            className="input"
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ width: 200 }}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={!!callingPhone || !phone.trim()}>
          {callingPhone ? "Calling..." : "Start call"}
        </button>
      </form>

      {error && <div className="alert alert-red">{error}</div>}

      <div className="calls-grid">
        <div className="card call-list">
          <div className="card-head">
            <h2 className="card-title">History</h2>
            <span className="faint small">{calls.length} recent</span>
          </div>
          {calls.length === 0 && <div className="empty">No calls yet.</div>}
          {calls.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`call-item ${selected?.id === c.id ? "active" : ""}`}
            >
              <span className="dir-icon">
                <Icon name={c.direction === "inbound" ? "incoming" : "outgoing"} size={14} />
              </span>
              <div className="list-main">
                <div className="list-title num">{c.phone || "Unknown number"}</div>
                <div className="list-sub">
                  {fmtDateTime(c.startedAt)}
                  {c.durationSec != null && ` · ${fmtDuration(c.durationSec)}`}
                </div>
              </div>
              <CallStatus status={c.status} />
            </div>
          ))}
        </div>

        <div className="card">
          {selected ? (
            <>
              <div className="card-head">
                <div>
                  <h2 className="card-title num">{selected.phone || "Unknown number"}</h2>
                  <div className="card-desc">
                    {selected.direction === "inbound" ? "Incoming" : "Outgoing"} call · {fmtDateTime(selected.startedAt)}
                    {selected.durationSec != null && ` · ${fmtDuration(selected.durationSec)}`}
                  </div>
                </div>
                <div className="row">
                  <label className="toggle">
                    <input type="checkbox" checked={showSystem} onChange={(e) => setShowSystem(e.target.checked)} />
                    System events
                  </label>
                  <CallStatus status={selected.status} />
                  {live && (
                    <button className="btn btn-danger btn-sm" onClick={endCall} disabled={ending}>
                      <Icon name="phoneOff" size={14} /> {ending ? "Ending..." : "End call"}
                    </button>
                  )}
                </div>
              </div>
              <div ref={transcriptRef} className="transcript">
                {lines.length === 0 && (
                  <div className="empty">
                    {live ? "Waiting for the conversation to start..." : "No transcript for this call."}
                  </div>
                )}
                {lines.map((l, i) => (
                  <div key={i} className={`t-row ${l.role}`}>
                    <div className={`t-speaker ${l.role}`}>{SPEAKER[l.role] || l.role}</div>
                    <div className="t-text">{l.text}</div>
                    <div className="t-time">{lineTime(l.at)}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty">Select a call to see its transcript.</div>
          )}
        </div>
      </div>
    </div>
  );
}
