# 01 — Oru call-ku evlo selavu?

Oru call-la 4 per-ku kaasu pogudhu: **Gemini** (AI voice), **Twilio** (phone line),
**Cloudflare** (backend), **Firebase** (bookings DB). Rates USD-la, $1 = ₹96 nu vachu calculate pannirukken.

## Rates (October 2026)

| Service | Item | Rate |
|---|---|---|
| Gemini `gemini-3.8-live` (paid tier) | Audio input (caller pesuradhu) | $3.00 / 1M tokens ≈ **$0.005 / min** |
| | Audio output (Priya pesuradhu) | $12.00 / 1M tokens ≈ **$0.018 / min** |
| | Text input (prompt, tool results) | $0.75 / 1M tokens |
| | Text output | $4.50 / 1M tokens |
| Twilio | Outbound → India mobile | **$0.0496 / min** |
| | Inbound → US local number | $0.0085 / min |
| | Media Streams (audio-va Worker-ku anuppa) | $0.0044 / min |
| | US phone number | $1.15 / month |
| Cloudflare | Durable Objects | Free plan: 100k requests + 13,000 GB-s / day |
| Firebase | Firestore (Spark) | Free: 50k reads, 20k writes / day |

## Oru 3-nimisha booking call

Assumption: call 3 nimisham, adhula Priya ~1.5 nimisham pesuvaanga.

### Outbound (namma customer-ku call pannradhu, India mobile)

| Item | Calculation | USD | ₹ |
|---|---|---|---|
| Gemini audio in | 3 min × $0.005 | 0.015 | 1.4 |
| Gemini audio out | 1.5 min × $0.018 | 0.027 | 2.6 |
| Gemini prompt/context (estimate*) | ~40k text tokens × $0.75/1M | 0.030 | 2.9 |
| Twilio call | 3 min × $0.0496 | 0.149 | 14.3 |
| Twilio Media Streams | 3 min × $0.0044 | 0.013 | 1.3 |
| Cloudflare + Firebase | free limits-kulla | 0 | 0 |
| **Total** | | **≈ $0.23** | **≈ ₹22** |

\* Live API ovvoru turn-kum system prompt + conversation context-a input-a
count pannalaam. Indha line oru estimate; real number-ku [03](03-token-optimization.md)-la
sonna maadhiri usage log pannanum.

**Per minute ≈ ₹7.** Adhula Twilio ₹5.2, Gemini ₹2.3.

### Inbound (customer US Twilio number-ku call pannradhu)

| Item | USD | ₹ |
|---|---|---|
| Gemini (adhae) | 0.072 | 6.9 |
| Twilio inbound 3 × $0.0085 | 0.026 | 2.4 |
| Media Streams | 0.013 | 1.3 |
| **Total** | **≈ $0.11** | **≈ ₹10.6** |

Aana India customer US number-ku call panna avangalukku international charge.
Real India business-ku Indian number venum (Exotel / Plivo / Twilio India) —
avanga rates thaniya check pannanum, indha doc-la illa.

## ₹1000-ku ethana call?

| Call type | Per call | ₹1000-ku |
|---|---|---|
| Outbound, 3 min | ₹22 | **~45 calls** (~135 min) |
| Outbound, 2 min | ₹15 | ~66 calls |
| Outbound, 5 min | ₹37 | ~27 calls |
| Inbound (US number), 3 min | ₹10.6 | ~94 calls |

Plus Twilio number ₹110/month (fixed).

## Monthly example

Oru restaurant: day-ku 20 inbound + 10 reminder outbound calls, avg 3 min.

| | Calls/month | Cost |
|---|---|---|
| Inbound (Indian number, rate assume ~US maadhiri) | 600 | 600 × ₹10.6 ≈ ₹6,360 |
| Outbound reminders | 300 | 300 × ₹22 ≈ ₹6,600 |
| Number | 1 | ₹110 |
| Cloudflare Workers Paid (900 calls-ku free plan podhaadhu, 02 paarunga) | | ~₹480 ($5) |
| **Total** | 900 calls / 2,700 min | **≈ ₹13,550 / month** |

## Sources

- Gemini pricing: https://ai.google.dev/gemini-api/docs/pricing
- Gemini audio tokens (32 tokens/sec input): https://ai.google.dev/gemini-api/docs/tokens
- Twilio India: https://www.twilio.com/en-us/voice/pricing/in
- Twilio US: https://www.twilio.com/en-us/voice/pricing/us
- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/platform/pricing/
- Firebase: https://firebase.google.com/pricing
