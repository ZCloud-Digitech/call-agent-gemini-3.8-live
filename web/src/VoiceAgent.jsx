// VoiceAgent.jsx - Restaurant table booking voice agent (Gemini Live, Tanglish)
// -----------------------------------------------------------------------------
// Flow: Worker-kitta ephemeral token -> Live API WebSocket -> mic PCM anuppu ->
//       agent audio play. Caller naduvula pesinaa (barge-in) agent udane
//       nirutthum. Booking-ku agent tools call pannum -> Firestore.

import { useRef, useState } from "react";
import {
  GoogleGenAI, Modality, StartSensitivity, EndSensitivity,
} from "@google/genai";
import { startMic, AudioPlayer } from "./audio-utils";
import { RESTAURANT, buildInstructions, TOOLS } from "./restaurant";
import { createToolHandlers } from "./bookings";
import * as firebaseStore from "./firebase";

const toolHandlers = createToolHandlers(firebaseStore);
import BrandFooter from "./BrandFooter";
import Icon from "./Icon";

// 🔧 Worker URL + model - web/.env-la set pannu
const TOKEN_URL = import.meta.env.VITE_TOKEN_URL;
const MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-3.8-live";

// embedded: admin page "Voice test" tab-ukkulla (admin link, footer venaam)
export default function VoiceAgent({ embedded = false }) {
  const [status, setStatus] = useState("idle"); // idle | connecting | live
  const [transcript, setTranscript] = useState([]); // [{ role: "user"|"agent"|"system", text }]
  const [booking, setBooking] = useState(null);
  const [showSystem, setShowSystem] = useState(false);
  const sessionRef = useRef(null);
  const stopMicRef = useRef(null);
  const playerRef = useRef(null);

  // Transcription chunk-chunk-ஆ varum; same role-naa last line-la append pannu
  function addText(role, text) {
    setTranscript((t) => {
      const last = t[t.length - 1];
      if (last && last.role === role) {
        return [...t.slice(0, -1), { role, text: last.text + text }];
      }
      return [...t, { role, text }];
    });
  }

  async function handleToolCall(toolCall) {
    const functionResponses = [];
    for (const fc of toolCall.functionCalls || []) {
      if (fc.name === "end_call") {
        // Goodbye audio play aagi mudinja apram cut
        const wait = (playerRef.current?.remainingMs() || 0) + 500;
        setTimeout(stop, wait);
        functionResponses.push({ id: fc.id, name: fc.name, response: { ok: true } });
        continue;
      }
      let result;
      try {
        const handler = toolHandlers[fc.name];
        result = handler ? await handler(fc.args || {}) : { ok: false, reason: "Unknown tool" };
      } catch (err) {
        console.error("tool error:", fc.name, err);
        result = { ok: false, reason: "System error, konjam neram kalichu try pannunga." };
      }
      addText("system", `${fc.name}(${JSON.stringify(fc.args)}) → ${JSON.stringify(result)}`);
      if (fc.name === "save_booking" && result.ok) setBooking({ ...fc.args, id: result.bookingId });
      if (fc.name === "update_booking" && result.ok) setBooking({ ...result.updated, id: result.updated.bookingId, label: "Updated" });
      if (fc.name === "cancel_booking" && result.ok) setBooking({ ...result.cancelled, id: result.cancelled.bookingId, label: "Cancelled" });
      functionResponses.push({ id: fc.id, name: fc.name, response: result });
    }
    sessionRef.current?.sendToolResponse({ functionResponses });
  }

  function handleMessage(msg) {
    const sc = msg.serverContent;

    // ⚡ Barge-in: caller pesa aarambichaa server "interrupted" anuppum.
    // Queue-la irukkra agent audio-ஐ udane drop pannu.
    if (sc?.interrupted) {
      playerRef.current?.interrupt();
      addText("system", "Caller interrupted");
    }

    for (const part of sc?.modelTurn?.parts || []) {
      if (part.inlineData?.data) playerRef.current?.play(part.inlineData.data);
    }

    if (sc?.inputTranscription?.text) addText("user", sc.inputTranscription.text);
    if (sc?.outputTranscription?.text) addText("agent", sc.outputTranscription.text);

    if (msg.toolCall) handleToolCall(msg.toolCall);
  }

  async function start() {
    setStatus("connecting");
    setTranscript([]);
    setBooking(null);
    try {
      // 1) Worker-kitta ephemeral token
      const res = await fetch(TOKEN_URL, { method: "POST" });
      const { token, error } = await res.json();
      if (!res.ok || !token) throw new Error(error || "Token kidaikkala");

      // 2) SDK - ephemeral token-ஐ apiKey-ஆ kudukrom
      const ai = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: "v1alpha" },
      });

      playerRef.current = new AudioPlayer();

      // 3) Live API-ku WebSocket connect
      const session = await ai.live.connect({
        model: MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: buildInstructions(),
          tools: TOOLS,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          // Long call-la context limit thaandinaa session cut aagaama, pazhaya
          // audio-ஐ mattum slide panni eduthudum (system prompt apdiye irukkum)
          contextWindowCompression: { slidingWindow: {} },
          // VAD: caller pesa aarambicha udane agent nirutthum (barge-in).
          // START_SENSITIVITY_LOW = chinna noise-ku interrupt aagaadhu.
          realtimeInputConfig: {
            automaticActivityDetection: {
              startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
              endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
              prefixPaddingMs: 200,
              silenceDurationMs: 700,
            },
          },
        },
        callbacks: {
          onopen: () => setStatus("live"),
          onmessage: handleMessage,
          onerror: (e) => {
            console.error("live error:", e);
            alert("Error: " + (e?.message || e));
          },
          onclose: (e) => {
            if (e?.reason) addText("system", "Call closed: " + e.reason);
            stop();
          },
        },
      });
      sessionRef.current = session;

      // 4) Phone edutha maadhiri - agent mudhal-la greet pannattum
      session.sendClientContent({
        turns: [{ role: "user", parts: [{ text: "(Call connected. Greet the caller.)" }] }],
        turnComplete: true,
      });

      // 5) Mic open panni, ovvoru chunk-ஐயும் Gemini-ku anuppu
      stopMicRef.current = await startMic((base64) => {
        sessionRef.current?.sendRealtimeInput({
          audio: { data: base64, mimeType: "audio/pcm;rate=16000" },
        });
      });
    } catch (err) {
      console.error(err);
      stop();
      alert("Connect aagala: " + err.message);
    }
  }

  function stop() {
    stopMicRef.current?.();
    const session = sessionRef.current;
    stopMicRef.current = null;
    sessionRef.current = null;
    session?.close?.();
    playerRef.current?.stop?.();
    playerRef.current = null;
    setStatus("idle");
  }

  const live = status === "live";
  const shown = transcript.filter((l) => showSystem || l.role !== "system");

  const ui = (
    <div className="stack">
      <div className="card agent-panel">
        <div className={`agent-avatar ${live ? "live" : ""}`}>
          <Icon name="mic" size={24} />
        </div>
        <div className="list-main">
          <div className="strong" style={{ fontSize: 15 }}>Priya · {RESTAURANT.name}</div>
          <div className="faint small">
            {status === "idle" && "Start a browser call to test bookings, questions and interruptions. Headphones recommended."}
            {status === "connecting" && "Connecting to the agent..."}
            {live && "Live — speak naturally. You can interrupt the agent at any time."}
          </div>
        </div>
        {live ? (
          <button className="btn btn-danger btn-lg" onClick={stop}>
            <Icon name="phoneOff" size={16} /> End test call
          </button>
        ) : (
          <button className="btn btn-primary btn-lg" onClick={start} disabled={status === "connecting"}>
            <Icon name="mic" size={16} /> {status === "connecting" ? "Connecting..." : "Start test call"}
          </button>
        )}
      </div>

      {booking && (
        <div className="card">
          <div className="card-head">
            <h2 className="card-title">Booking result</h2>
            <span className={`badge ${booking.label === "Cancelled" ? "red" : "green"}`}>{booking.label || "Created"}</span>
          </div>
          <div className="kv">
            <div className="k">Booking ID</div><div className="mono" style={{ color: "var(--text)" }}>#{booking.id}</div>
            <div className="k">Guest</div><div>{booking.name}{booking.phone && ` · ${booking.phone}`}</div>
            <div className="k">When</div><div className="num">{booking.date} at {booking.time} · {booking.people} guests</div>
            {booking.notes && (<><div className="k">Notes</div><div>{booking.notes}</div></>)}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Transcript</h2>
          <label className="toggle">
            <input type="checkbox" checked={showSystem} onChange={(e) => setShowSystem(e.target.checked)} />
            System events
          </label>
        </div>
        <div className="transcript">
          {shown.length === 0 && <div className="empty">The conversation will appear here.</div>}
          {shown.map((line, i) => (
            <div key={i} className={`t-row ${line.role}`}>
              <div className={`t-speaker ${line.role}`}>{line.role === "agent" ? "Priya" : line.role === "user" ? "You" : "System"}</div>
              <div className="t-text">{line.text}</div>
              <div className="t-time" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (embedded) return ui;

  return (
    <div className="public">
      <div className="public-head">
        <div className="row" style={{ gap: 10 }}>
          <div className="ws-logo">{RESTAURANT.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}</div>
          <div>
            <div className="ws-name">{RESTAURANT.name}</div>
            <div className="ws-sub">AI booking assistant</div>
          </div>
        </div>
        <a href="/admin" className="btn btn-sm">Admin <Icon name="arrowRight" size={13} /></a>
      </div>
      {ui}
      <BrandFooter />
    </div>
  );
}
