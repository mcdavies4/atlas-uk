# Atlas UK 🚴
**London same-day courier dispatch bot — WhatsApp & Telegram**

Senders describe their delivery → Claude extracts details → Atlas estimates price in £ → connects them to a verified London courier.

---

## Stack
- **Runtime**: Node.js 18+
- **Framework**: Express
- **AI**: Claude Sonnet (Anthropic)
- **Database**: Supabase (Postgres)
- **Channels**: WhatsApp Business Cloud API + Telegram Bot API
- **Hosting**: Railway

---

## Key Differences from Nigeria Version
- Pricing in £ (GBP) based on London zone benchmarks
- London zone map (Central / Inner / Outer) using area names and postcodes
- Hire & Reward insurance verification for riders (UK legal requirement)
- UK-tone conversation flow
- Business sender detection (restaurants, pharmacies, florists etc)
- `channel` and `sender_type` fields tracked on every delivery

---

## Setup

### 1. Clone & install
```bash
npm install
cp .env.example .env
```

### 2. Supabase
Run `supabase/migrations/001_initial_schema.sql` in your Supabase SQL editor.

### 3. Fill .env
```
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_VERIFY_TOKEN=atlas_uk_verify_token
TELEGRAM_BOT_TOKEN=...
ANTHROPIC_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 4. Deploy to Railway
Push to GitHub → new Railway project → add env vars → deploy.

### 5. Register WhatsApp Webhook
Webhook URL: `https://your-railway-url.up.railway.app/webhook`

Telegram webhook is registered automatically on startup.

---

## London Pricing (£)
| Route | Price |
|-------|-------|
| Within Central London | £8 |
| Central ↔ Inner London | £12 |
| Central ↔ Outer London | £18 |
| Within Inner London | £10 |
| Inner ↔ Outer London | £15 |
| Within Outer London | £12 |

Size multipliers: Small ×1.0 · Medium ×1.3 · Large ×1.7 · XL ×2.2
Express surcharge: ×1.4

---

## Rider Requirements (UK)
Riders must have **Hire & Reward insurance** before being verified.
Set `hire_reward_insurance = true` and `verified = true` in the admin dashboard.

## Rider WhatsApp Commands
| Command | Action |
|---------|--------|
| `AVAILABLE` | Go online |
| `OFFLINE` | Go offline |
| `STATUS` | Check status |
