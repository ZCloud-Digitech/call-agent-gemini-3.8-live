# 02 — Free-a evlo call pesalam?

Short answer: **Twilio thavira ellam free tier-la odum.** Twilio-ku trial credit
mattum; adhu mudinjaa paid account venum.

## Ovvoru service-oda free limit

| Service | Free limit | 3-min call-la evlo use aagum | Day-ku max calls (free) |
|---|---|---|---|
| Gemini API free tier | Model "free of charge", aana rate limits irukku | — | AI Studio-la unga limit paarunga* |
| Cloudflare Durable Objects | 100,000 requests/day | Twilio 20ms-ku oru audio message = 9,000 msgs → 20:1 ratio = ~450 requests | **~220 calls/day** |
| | 13,000 GB-s/day | 180 sec × 128 MB = 22.5 GB-s | ~570 calls/day |
| Firebase Firestore | 20,000 writes/day | ~30 writes (transcript lines, status, booking) | ~650 calls/day |
| | 50,000 reads/day | ~20 reads (availability checks) + admin page | admin page open-a irundhaa adhigam |
| Twilio | Trial credit (amount Console-la theriyum) | Outbound India 3 min ≈ $0.16 | Credit / $0.16 |

**Bottleneck = Cloudflare requests (~220 calls/day).** Adhukku mela Workers Paid
($5/month, 1M requests included → ~2,200 three-min calls/month, apram romba cheap).

\* Live API free tier limits (concurrent sessions, requests/day) pricing page-la illa.
Unga project-oda real limits: https://aistudio.google.com/rate-limit — oru nerathula
evlo calls (concurrency) mudiyum nu andha page-la paarunga.

## Free tier-la gavanikka vendiyadhu

1. **Twilio trial:** verify panna numbers-ku mattum call pogum; call aarambathula
   "trial account" message varum. Real customers-ku upgrade kandippa venum.
2. **Gemini free tier = testing-ku mattum.** Free tier-la anuppura data Google products
   improve panna use aagalaam nu Google terms solludhu — customer phone numbers,
   conversations irukkuradhaala real clients-ku **paid tier** (billing enable) use pannunga.
   Terms: https://ai.google.dev/gemini-api/terms
3. **Cloudflare free CPU limit:** call naduvula cut aagi `npm run logs`-la "exceeded CPU"
   vandhaa Workers Paid venum.
4. **Firestore test mode** 30 naal-la expire aagum (Firebase Console warning kaattum).
   Adhukku munnadi proper security rules podanum.

## Testing budget

| Stage | Selavu |
|---|---|
| Browser "Test agent" (phone illama) | Gemini free tier → ₹0 |
| Unga phone-ku 20 test calls × 3 min | Twilio trial credit-la (~$3.2) |
| First client pilot, 1 month, ~300 calls | ~₹6,000–7,000 (01 paarunga) |
