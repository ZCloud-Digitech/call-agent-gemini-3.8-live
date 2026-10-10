# 04 — Client-kitta eppadi charge pannradhu, payment eppadi vaangradhu

Unga cost ≈ **₹7 / nimisham** (outbound India) illa ≈ **₹3.5 / nimisham** (inbound).
Keezha irukkura prices **suggestion** mattum — unga market, competition paathu decide pannunga.

## Pricing models

### A. Monthly plan + included minutes (recommended)

Client-ku predictable bill; ungalukku fixed income.

| Plan | Price / month | Included minutes | Unga cost (₹7/min worst case) | Margin |
|---|---|---|---|---|
| Starter | ₹4,999 | 300 | ₹2,100 + ₹110 number | ~₹2,800 (56%) |
| Growth | ₹9,999 | 800 | ₹5,600 + ₹110 | ~₹4,300 (43%) |
| Pro | ₹19,999 | 2,000 | ₹14,000 + ₹110 + ₹480 CF | ~₹5,400 (27%) |
| Extra minutes | ₹12 / min | — | ₹7 | ₹5 / min |

Pro-la margin kammi → adhukku inbound-heavy clients / Indian provider rates venum.

### B. Pay-per-minute (prepaid wallet)

- Client ₹1000, ₹5000 recharge pannuvaanga; ovvoru call nimisham-ku ₹12–15 kazhiyum.
- ₹1000 recharge @ ₹12/min = 83 nimisham client-ku; unga cost ~₹580 → margin ~₹420.
- Small shops-ku nalladhu; neenga balance track pannanum (keezha "Usage tracking").

### C. Per booking

- Agent edutha ovvoru confirmed booking-ku ₹10–20.
- Client-ku value clear-a theriyum; aana booking aagaadha enquiry calls-oda cost ungaludhu.

### One-time setup fee

₹9,999 – ₹24,999: prompt customize (menu, timing, rules), number setup, admin page,
2 weeks testing. Custom features (WhatsApp, POS integration) thaniya.

**GST:** service-ku 18% GST (registration irundhaa invoice-la add pannunga). CA-kitta confirm pannunga.

## Payment eppadi vaangradhu

| Vazhi | Edhukku | Notes |
|---|---|---|
| **Razorpay Subscriptions** | Monthly plans (A) | Auto-debit (UPI AutoPay / card), GST invoice automatic |
| Razorpay / Cashfree Payment Links | Setup fee, recharge (B) | WhatsApp-la link anuppunga |
| Direct UPI / bank transfer | First few clients | Invoice manual-a; track pannradhu kashtam |

Payment gateway signup-ku business KYC (PAN, bank, GST optional) venum.

## Usage tracking (client-ku bill panna)

Ovvoru call-um Firestore `calls`-la `durationSec`-oda save aagudhu (Twilio status
callback). Adha vachu:

- Month-ku motham nimisham = `durationSec` sum ÷ 60
- Admin page-la "This month: 312 min / 300 included" maadhiri usage card add pannalaam
- Gemini real cost-um `usageMetadata` log pannina kaattalaam ([03](03-token-optimization.md))

Ippo code-la indha usage card illa — venumna add pannalaam.

## Pala clients handle pannradhu

Ippo setup = **oru restaurant-ku oru deployment** (oru Worker + oru Firebase project + oru Twilio number).

| Clients | Approach |
|---|---|
| 1–5 | Ovvoru client-kum thaniya Worker (`wrangler.toml` name maathi) + Firebase project. Simple, data separate. |
| 5+ | Multi-tenant: orae Worker, client-wise Twilio number → client config, Firestore-la `clients/{id}/bookings`. Admin login per client venum. Periya rework. |

## Client-kitta solla vendiya limits

- AI 100% perfect illa — noisy call-la Tamil mis-hear aagalaam; important booking-ku SMS confirm nalladhu.
- Gemini / Twilio rates maarinaa unga price-um revise pannra clause contract-la vainga.
- Customer data (phone numbers, conversations) Firebase-la store aagudhu — privacy policy venum.
