// audio-utils.js - Gemini Live-ku mic capture + playback helpers
// ---------------------------------------------------------------
// Gemini Live ketkradhu: PCM 16-bit, 16kHz, mono (input)
// Gemini Live anupradhu: PCM 16-bit, 24kHz, mono (output)
// Browser default audio idhai match pannaadhu, so convert panni anupprom.

// Float32 audio -> Int16 PCM -> base64 (Gemini-ku anuppa)
function floatToBase64PCM(float32) {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// base64 PCM -> Float32 (agent குரலை play panna)
function base64PCMToFloat(base64) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 0x8000;
  return float32;
}

// --- Mic capture: ovvoru chunk-um base64 PCM-ஆ onChunk-ku anuppum ---
export async function startMic(onChunk) {
  const ctx = new AudioContext({ sampleRate: 16000 });
  // echoCancellation: speaker-la agent குரல் thirumba mic-la vandhu agent-ஏ
  // "interrupt" aagaama irukka. Best result-ku headphones use pannu.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    onChunk(floatToBase64PCM(input));
  };

  source.connect(processor);
  processor.connect(ctx.destination);

  // stop panna indha function-ஐ return pannrom
  return () => {
    processor.disconnect();
    source.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    ctx.close();
  };
}

// --- Playback: agent audio chunks-ஐ queue panni smooth-ஆ play pannum ---
export class AudioPlayer {
  constructor() {
    this.ctx = new AudioContext({ sampleRate: 24000 });
    this.nextTime = 0;
    this.sources = new Set(); // queue-la irukka / play aagra chunks
  }
  play(base64) {
    if (this.ctx.state === "suspended") this.ctx.resume();
    const float32 = base64PCMToFloat(base64);
    const buffer = this.ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);
    src.onended = () => this.sources.delete(src);
    this.sources.add(src);
    const now = this.ctx.currentTime;
    this.nextTime = Math.max(this.nextTime, now);
    src.start(this.nextTime);
    this.nextTime += buffer.duration;
  }
  // Caller naduvula pesinaa: play aagradhaiyum, queue-la irukkradhaiyum udane nirutthu
  interrupt() {
    for (const src of this.sources) {
      try { src.stop(); } catch {}
    }
    this.sources.clear();
    this.nextTime = 0;
  }
  // Innum evlo neram audio play aaganum (ms) - end_call-ku munnadi wait panna
  remainingMs() {
    return Math.max(0, (this.nextTime - this.ctx.currentTime) * 1000);
  }
  stop() {
    this.interrupt();
    this.ctx.close();
  }
}
