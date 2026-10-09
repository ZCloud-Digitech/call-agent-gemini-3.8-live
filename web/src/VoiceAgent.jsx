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
import { toolHandlers } from "./bookings";

// 🔧 Worker URL + model - web/.env-la set pannu
const TOKEN_URL = import.meta.env.VITE_TOKEN_URL;
const MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-3.8-live";

export default function VoiceAgent() {
  const [status, setStatus] = useState("idle"); // idle | connecting | live
  const [transcript, setTranscript] = useState([]); // [{ role: "user"|"agent"|"system", text }]
  const [booking, setBooking] = useState(null);
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
      addText("system", `🔧 ${fc.name}(${JSON.stringify(fc.args)}) → ${JSON.stringify(result)}`);
      if (fc.name === "save_booking" && result.ok) setBooking({ ...fc.args, id: result.bookingId });
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
      addText("system", "✋ (interrupted)");
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

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <h2 style={{ textAlign: "center" }}>🎙️ {RESTAURANT.name} - Booking Assistant</h2>
      <p style={{ textAlign: "center" }}>
        {status === "idle" && "Pesa ready. Button press pannu. (Headphones best)"}
        {status === "connecting" && "Connect aagudhu..."}
        {status === "live" && "🟢 Live - ippo pesu! Naduvula pesinaalum nirutthum."}
      </p>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        {status === "live" ? (
          <button onClick={stop} style={btn("#e74c3c")}>Call-ஐ nிறுthu</button>
        ) : (
          <button onClick={start} disabled={status === "connecting"} style={btn("#27ae60")}>
            Pesa aarambi
          </button>
        )}
      </div>

      {booking && (
        <div style={{ background: "#e8f8ef", border: "1px solid #27ae60", borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <b>✅ Booking #{booking.id}</b>
          <div>{booking.name} · {booking.phone}</div>
          <div>{booking.date} · {booking.time} · {booking.people} per</div>
          {booking.notes && <div>📝 {booking.notes}</div>}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {transcript.map((line, i) => (
          <div key={i} style={bubble(line.role)}>
            {line.role === "user" && "🧑 "}
            {line.role === "agent" && "🤖 "}
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}

const btn = (bg) => ({
  background: bg, color: "#fff", border: "none", borderRadius: 10,
  padding: "14px 28px", fontSize: 18, cursor: "pointer",
});

const bubble = (role) => ({
  alignSelf: role === "user" ? "flex-end" : role === "agent" ? "flex-start" : "center",
  background: role === "user" ? "#dbeafe" : role === "agent" ? "#f1f5f9" : "transparent",
  color: role === "system" ? "#888" : "#111",
  fontSize: role === "system" ? 12 : 15,
  padding: role === "system" ? 0 : "8px 12px",
  borderRadius: 10,
  maxWidth: "85%",
  wordBreak: "break-word",
});
