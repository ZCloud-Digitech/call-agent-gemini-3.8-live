# 03 — Token optimization (Gemini cost kuraikka)

Gemini = call cost-la ~30%. Twilio thaan periya selavu, adhanala mudhalla **call
neratha kuraikkradhu** dhaan best saving (adhu rendaiyum kuraikkum).

## 1. Mudhalla measure pannunga

Gemini Live ovvoru response-layum `usageMetadata` anuppum (input/output tokens,
modality-wise). Adha `calls/{callSid}`-la save panna, ovvoru call-oda **real Gemini
cost** admin page-la kaattalaam. Ippo code-la idhu illa — adutha step-a add pannalaam
(`worker/src/call-session.js` → `onGeminiMessage`-la `msg.usageMetadata`).

Measure pannama optimize panna, 01-la irukkura "prompt/context" line guess dhaan.

## 2. Already panniyirukkradhu

| Setting | Enga | Enna saving |
|---|---|---|
| `contextWindowCompression: slidingWindow` | `call-session.js` setup | Long call-la pazhaya audio context drop aagum; ovvoru turn-um full history bill aagaadhu |
| Booking rules prompt-la, tools-la logic | `restaurant.js`, `bookings.js` | Model yosikka vendiyadhu kammi; tool result short JSON |
| `end_call` tool | prompt | Goodbye sonnadhum call cut → silence-ku kaasu illa |

## 3. Easy wins (code-la maathalaam)

1. **Max call length** — 5 nimisham aanaa Priya wrap-up panni `end_call`. Romba neram
   pesura / hold-la vachu marandha calls-oda cost cap aagum.
   (`call-session.js`-la timer + prompt rule.)
2. **System prompt-a kuraikka** — ippo prompt ~2,600 + tools ~850 = ~3,400 tokens (approx, characters ÷ 3.5 vachu).
   Ovvoru turn-um idhu input-a count aagalaam. Examples-a 2–3 aa kuraichaa, repeat
   aagura rules-a merge panna ~30–40% kuraiyum. Test panni dhaan kuraikkanum —
   examples eduthaa off-topic / Tamil handling weak aagalaam.
3. **Tool results short-a** — `list_available_slots` ellaa slots-um anuppudhu (12).
   Party size therinjaa `fitsParty: true` slots mattum anuppalaam.
4. **Output transcription** — admin transcript-ku venum; venaam-naa
   `outputAudioTranscription` off panna konjam text output kuraiyum.

## 4. Advanced (careful-a test pannanum)

- **Silence-a anuppaama irukkradhu** — Twilio full call audio-vum anuppum; caller
  pesaadha neram audio input-um bill aagudhu. Energy check vachu silence frames-a
  skip panni `audioStreamEnd` anuppalaam. Risk: Gemini VAD end-of-speech miss
  pannalaam, interruption weak aagalaam.
- **Cheaper model** — `gemini-2.5-flash-native-audio` audio rate adhae ($3 / $12),
  text konjam cheap. Saving chinnadhu; Tanglish quality test pannanum.

## 5. Twilio side saving (adhigam saving)

| Idea | Saving |
|---|---|
| Inbound-a encourage pannunga (customer call pannradhu) | Outbound India ~$0.05/min vs inbound ~$0.0085/min (US rates) |
| Ring timeout 20–25 sec | Answer pannaadha call-ku neram waste illa |
| Reminder-ku call badhila WhatsApp/SMS | Call-ai vida romba cheap; confirm panna mattum call |
| Indian provider (Exotel/Plivo) rates compare | India calls-ku Twilio-vai vida cheap-a irukkalaam — quote vaangunga |
