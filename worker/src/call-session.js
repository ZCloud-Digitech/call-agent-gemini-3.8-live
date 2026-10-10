// call-session.js - Durable Object: oru phone call = oru CallSession
// --------------------------------------------------------------------
// Twilio media stream WebSocket <-> Gemini Live WebSocket bridge.
// Booking tools = web/src/bookings.js (browser agent use pannra adhae logic),
// database = Firestore REST (firestore.js).

import { buildInstructions, TOOLS } from "../../web/src/restaurant.js";
import { createToolHandlers } from "../../web/src/bookings.js";
import { createFirestore } from "./firestore.js";
import { twilioToGemini, geminiToTwilio } from "./audio.js";
import { indianMobile, streamToken } from "./twilio.js";

const GEMINI_WS =
  "https://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

export class CallSession {
  constructor(state, env) {
    this.env = env;
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("WebSocket only", { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.bridge(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  bridge(twilio) {
    const env = this.env;
    const db = createFirestore(env);
    const toolHandlers = createToolHandlers(db);

    let streamSid = null;
    let callSid = null;
    let gemini = null;
    let geminiReady = false;
    let closed = false;
    let tag = "call";
    let lineRole = null;
    let line = "";

    const log = (...a) => console.log(`[${tag}]`, ...a);
    const safe = (p) => Promise.resolve(p).catch((e) => console.error(`[${tag}] firestore:`, e.message));
    const sendTwilio = (obj) => {
      try { twilio.send(JSON.stringify(obj)); } catch {}
    };
    const sendGemini = (obj) => {
      try { gemini?.send(JSON.stringify(obj)); } catch {}
    };

    // Transcript-ai role-wise serthu oru line-ஆ save
    const flushLine = () => {
      const text = line.trim();
      if (text) {
        log(lineRole === "user" ? "🧑" : "🤖", text);
        if (callSid) safe(db.appendCallLine(callSid, lineRole, text));
      }
      line = "";
      lineRole = null;
    };
    const addText = (role, text) => {
      if (lineRole !== role) flushLine();
      lineRole = role;
      line += text;
    };

    const hangup = () => {
      if (closed) return;
      closed = true;
      flushLine();
      try { gemini?.close(1000, "call ended"); } catch {}
      // <Connect><Stream> WebSocket close aanaa TwiML mudinjidum -> call cut
      try { twilio.close(1000, "call ended"); } catch {}
      log("📴 Call ended");
    };

    async function handleToolCall(toolCall) {
      const functionResponses = [];
      for (const fc of toolCall.functionCalls || []) {
        if (fc.name === "end_call") {
          // Goodbye audio play aagi mudinja apram Twilio "mark" thirumba varum -> appo cut
          sendTwilio({ event: "mark", streamSid, mark: { name: "hangup" } });
          setTimeout(hangup, 15000); // mark varaadhaalum safety
          functionResponses.push({ id: fc.id, name: fc.name, response: { ok: true } });
          continue;
        }
        let result;
        try {
          const handler = toolHandlers[fc.name];
          result = handler ? await handler(fc.args || {}) : { ok: false, reason: "Unknown tool" };
        } catch (err) {
          console.error(`[${tag}] tool error:`, fc.name, err);
          result = { ok: false, reason: "System error, konjam neram kalichu try pannunga." };
        }
        flushLine();
        const summary = `${fc.name}(${JSON.stringify(fc.args)}) → ${JSON.stringify(result)}`;
        log("🔧", summary);
        if (callSid) safe(db.appendCallLine(callSid, "tool", summary));
        functionResponses.push({ id: fc.id, name: fc.name, response: result });
      }
      sendGemini({ toolResponse: { functionResponses } });
    }

    function onGeminiMessage(msg) {
      if (msg.setupComplete) {
        geminiReady = true;
        log("🟢 Gemini ready");
        // Phone edutha maadhiri - agent mudhal-la greet pannattum
        sendGemini({
          clientContent: {
            turns: [{ role: "user", parts: [{ text: "(Call connected. Greet the caller.)" }] }],
            turnComplete: true,
          },
        });
        return;
      }

      const sc = msg.serverContent;
      // ⚡ Barge-in: caller pesa aarambichaa Twilio buffer-la irukkra agent audio-ai clear
      if (sc?.interrupted) {
        sendTwilio({ event: "clear", streamSid });
        flushLine();
        log("✋ interrupted");
      }
      for (const part of sc?.modelTurn?.parts || []) {
        if (part.inlineData?.data) {
          sendTwilio({ event: "media", streamSid, media: { payload: geminiToTwilio(part.inlineData.data) } });
        }
      }
      if (sc?.inputTranscription?.text) addText("user", sc.inputTranscription.text);
      if (sc?.outputTranscription?.text) addText("agent", sc.outputTranscription.text);
      if (sc?.turnComplete) flushLine();

      if (msg.toolCall) handleToolCall(msg.toolCall);
      if (msg.goAway) log("Gemini goAway", JSON.stringify(msg.goAway));
    }

    async function startGemini(callerPhone) {
      const res = await fetch(`${GEMINI_WS}?key=${env.GEMINI_API_KEY}`, { headers: { Upgrade: "websocket" } });
      if (!res.webSocket) throw new Error(`Gemini connect fail (${res.status}): ${await res.text()}`);
      gemini = res.webSocket;
      gemini.accept();

      gemini.addEventListener("message", (e) => {
        let msg;
        try {
          msg = JSON.parse(typeof e.data === "string" ? e.data : new TextDecoder().decode(e.data));
        } catch {
          return;
        }
        onGeminiMessage(msg);
      });
      gemini.addEventListener("close", (e) => {
        log("Gemini closed", e.code, e.reason || "");
        hangup();
      });
      gemini.addEventListener("error", (e) => log("❌ Gemini error", e.message || e));

      sendGemini({
        setup: {
          model: `models/${env.GEMINI_MODEL || "gemini-3.8-live"}`,
          generationConfig: { responseModalities: ["AUDIO"] },
          systemInstruction: { parts: [{ text: buildInstructions({ callerPhone }) }] },
          tools: TOOLS,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          contextWindowCompression: { slidingWindow: {} },
          realtimeInputConfig: {
            automaticActivityDetection: {
              startOfSpeechSensitivity: "START_SENSITIVITY_LOW",
              endOfSpeechSensitivity: "END_SENSITIVITY_LOW",
              prefixPaddingMs: 200,
              silenceDurationMs: 700,
            },
          },
        },
      });
    }

    twilio.addEventListener("message", async (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }

      switch (msg.event) {
        case "start": {
          streamSid = msg.start.streamSid;
          callSid = msg.start.callSid || null;
          tag = callSid?.slice(-6) || "call";
          const params = msg.start.customParameters || {};

          // /twilio/voice kudutha token match aagalanaa - Twilio illa, block
          if (!callSid || params.token !== (await streamToken(env, callSid))) {
            log("⛔ Stream token thappu - closing");
            hangup();
            return;
          }

          const callerPhone = indianMobile(params.from);
          log(`▶️ Stream started, caller ID: ${callerPhone || "unknown"}`);
          safe(db.saveCall(callSid, { status: "in-progress" }, ["agentConnectedAt"]));
          try {
            await startGemini(callerPhone);
          } catch (err) {
            log("❌", err.message);
            hangup();
          }
          break;
        }
        case "media":
          // Gemini setup mudiyura varaikkum vara audio drop (greeting appo thaan varum)
          if (geminiReady && !closed) {
            sendGemini({
              realtimeInput: { audio: { data: twilioToGemini(msg.media.payload), mimeType: "audio/pcm;rate=16000" } },
            });
          }
          break;
        case "mark":
          if (msg.mark?.name === "hangup") hangup();
          break;
        case "stop":
          hangup();
          break;
      }
    });
    twilio.addEventListener("close", hangup);
    twilio.addEventListener("error", hangup);
  }
}
