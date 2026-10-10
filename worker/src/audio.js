// audio.js - Twilio <-> Gemini audio format convert (Worker version, Buffer illama)
// ----------------------------------------------------------------------------------
// Twilio phone audio: 8kHz, 8-bit μ-law, mono (base64)
// Gemini input:       16kHz, 16-bit PCM, mono
// Gemini output:      24kHz, 16-bit PCM, mono

function mulawDecodeSample(u) {
  u = ~u & 0xff;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  const sample = (((mantissa << 3) + 0x84) << exponent) - 0x84;
  return sign ? -sample : sample;
}

function mulawEncodeSample(s) {
  const BIAS = 0x84;
  const CLIP = 32635;
  const sign = s < 0 ? 0x80 : 0;
  if (sign) s = -s;
  if (s > CLIP) s = CLIP;
  s += BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (s & mask) === 0 && exponent > 0; exponent--, mask >>= 1);
  const mantissa = (s >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

// Twilio base64 μ-law 8k -> base64 PCM16 16k (Gemini-ku)
export function twilioToGemini(b64) {
  const mulaw = b64ToBytes(b64);
  const out = new Int16Array(mulaw.length * 2);
  let prev = mulawDecodeSample(mulaw[0] ?? 0xff);
  for (let i = 0; i < mulaw.length; i++) {
    const cur = mulawDecodeSample(mulaw[i]);
    out[2 * i] = (prev + cur) >> 1; // 8k -> 16k linear interpolation
    out[2 * i + 1] = cur;
    prev = cur;
  }
  return bytesToB64(new Uint8Array(out.buffer));
}

// Gemini base64 PCM16 24k -> base64 μ-law 8k (Twilio-ku)
export function geminiToTwilio(b64) {
  const bytes = b64ToBytes(b64);
  const pcm = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
  const n = Math.floor(pcm.length / 3);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const avg = (pcm[3 * i] + pcm[3 * i + 1] + pcm[3 * i + 2]) / 3; // 24k -> 8k
    out[i] = mulawEncodeSample(Math.round(avg));
  }
  return bytesToB64(out);
}
