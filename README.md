# Atlas 🚀
**Abuja's AI-powered WhatsApp logistics dispatch bot**

Senders describe their delivery in natural language → Claude extracts the details → Atlas estimates the price → connects them to a verified rider.

---

## Stack
- **Runtime**: Node.js 18+
- **Framework**: Express
- **AI**: Claude Sonnet (Anthropic)
- **Database**: Supabase (Postgres)
- **Channel**: WhatsApp Business Cloud API (Meta)
- **Hosting**: Railway

---

## Setup

### 1. Clone & install
```bash
git clone <your-repo>
cd atlas
npm install
cp .env.example .env
```

### 2. Supabase
1. Create a new project at supabase.com
2. Go to **SQL Editor** and run the full contents of `supabase/migrations/001_initial_schema.sql`
3. Copy your **Project URL** and **service_role key** from Settings → API

### 3. WhatsApp Business API
1. Go to [Meta for Developers](https://developers.facebook.com)
2. Create an App → Add **WhatsApp** product
3. Get your **Phone Number ID** and generate a **permanent access token**
4. Set your verify token to match `WHATSAPP_VERIFY_TOKEN` in your `.env`

### 4. Anthropic
1. Get your API key from [console.anthropic.com](https://console.anthropic.com)

### 5. Fill in .env
```
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_VERIFY_TOKEN=atlas_webhook_verify_token_change_this
ANTHROPIC_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 6. Deploy to Railway
1. Push to GitHub
2. New project on [railway.app](https://railway.app) → Deploy from GitHub repo
3. Add all environment variables in Railway's Variables tab
4. Copy your Railway public URL (e.g. `https://atlas-production.up.railway.app`)

### 7. Register WhatsApp Webhook
In Meta Developer Console:
- Webhook URL: `https://your-railway-url.up.railway.app/webhook`
- Verify token: same as `WHATSAPP_VERIFY_TOKEN`
- Subscribe to: **messages**

---

## Project Structure
```
atlas/
├── src/
│   ├── index.js              # Express server entry point
│   ├── bot/
│   │   ├── webhook.js        # Meta webhook handler
│   │   └── conversation.js   # State machine (IDLE → COLLECTING → CONFIRMING → SELECTING_RIDER)
│   ├── ai/
│   │   └── claude.js         # NLU extraction via Claude API
│   ├── pricing/
│   │   └── engine.js         # Zone-based Abuja pricing logic
│   ├── riders/
│   │   └── matcher.js        # Filter available riders by zone
│   ├── jobs/
│   │   └── manager.js        # Create + update delivery jobs in Supabase
│   └── utils/
│       ├── whatsapp.js       # Send WhatsApp messages
│       ├── supabase.js       # Supabase client
│       └── session.js        # Conversation state persistence
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql
```

---

## Conversation Flow
```
User: "Hi"
Bot:  Welcome to Atlas! Tell me about your delivery...

User: "Pick up a bag from Wuse 2, deliver to Gwarinpa"
Bot:  ✅ Summary: Wuse 2 → Gwarinpa · Medium · ₦2,500 · Reply YES to continue

User: "YES"
Bot:  🏍️ Available riders: 1. Emeka Dispatch ⭐4.8 | 2. Chidi Swift ⭐4.9 ...

User: "2"
Bot:  🎉 Booked! Job ID: A3F2B1C0 · Contact Chidi: wa.me/2348055555555
```

---

## Managing Riders
Add riders directly in Supabase → `riders` table. Set `verified = true` for them to appear.

**Coverage zones:** `central`, `inner`, `outer`, or `all`

---

## Pricing Zones (Abuja)
| Zone     | Areas |
|----------|-------|
| Central  | Maitama, Wuse, Wuse 2, Garki, Asokoro, Jabi, Utako... |
| Inner    | Gwarinpa, Life Camp, Kado, Lokogoma, Apo, Gudu, Karu, Nyanya... |
| Outer    | Kubwa, Lugbe, Gwagwalada, Zuba, Airport Road... |

Base rates: Central↔Central ₦1,500 · Central↔Inner ₦2,500 · Central↔Outer ₦4,000

---

## Phase 2 Roadmap
- [ ] Rider availability toggle via WhatsApp command
- [ ] Auto-broadcast jobs to riders (first to accept wins)
- [ ] Admin web dashboard (React + Supabase)
- [ ] Job status tracking + sender notifications
- [ ] Paystack payment integration
- [ ] Telegram channel support
