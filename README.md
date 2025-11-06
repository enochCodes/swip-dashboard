# SWIP Dashboard

**Smart Wellness Intelligence Protocol Dashboard** – an open platform for measuring the wellness impact of digital experiences.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.0-black.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-blue.svg)

---

## 📖 Overview

The SWIP Dashboard visualises anonymised wellness data collected by the **SWIP App** and a curated set of partner applications. The platform offers:

- 📊 **Global Leaderboard** – Hourly updates of app wellness scores
- 🔬 **Session Explorer** – Biosignal & emotion timelines per session
- 📈 **Analytics Workspace** – Trend reporting for product and research teams
- 🔓 **Public/Developer APIs** – Controlled read access to anonymised datasets
- 👩‍💻 **Developer Portal** – App registration, claiming, and key management

---

## 🏗️ Architecture Snapshot

### Data Producers

1. **SWIP App (first party)** – Uses an internal key to ingest any tracked app’s data.
2. **Verified Partner Apps** – Ship with the SWIP Ware SDK. Each partner receives a scoped API key and must appear in `verified-apps.json`.
3. **Developers** – Register or claim apps, generate read-only keys, and consume analytics.

### Ingestion Security Matrix

| Channel | Header | Use Case | Scope |
|---------|--------|---------|-------|
| **SWIP Internal Key** | `x-swip-internal-key` | First-party ingestion (apps, sessions, biosignals, emotions) | Can ingest for *any* app ID |
| **Verified App API Key** | `x-api-key` | Partner ingestion via SWIP Ware SDK | Only for the API key’s app ID *and* if the ID exists in `verified-apps.json` |
| **Developer Read API** | `x-api-key` | Read-only access to claimed apps | Only apps owned by the key’s user |
| **Dashboard Session** | `better-auth` cookie | Developer portal UI & admin APIs | Authenticated dashboard users |

> ✅ Verified ingestion **never** reuses the internal SWIP key. Payload `app_id` must match the API key’s app ID and be present in the verified registry.

### Caching & Refresh Cadence

| Feature | Cache | TTL | Notes |
|---------|-------|-----|-------|
| Leaderboard (global) | Redis `leaderboard:data` | **60 minutes** | Countdown timer reflects the payload’s `expiresAt` |
| Developer → `/api/v1/apps` | Redis per-user key | 60 seconds | Scoped by user, filter, and limit |
| Developer → `/api/v1/app_sessions` | Redis per-user key | 60 seconds | Includes optional `app_id` |
| Session biosignals | Redis per-session key | 30 seconds | Warm cache for session explorer |
| Session emotions | Redis per-session / per-biosignal | 60 seconds | Shared across analytics surfaces |
| Verified apps registry | Redis `verified-apps:config` | 5 minutes | Automatically reloads if a lookup misses |

All caches fall back to direct Prisma queries when Redis is unavailable.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **PostgreSQL** 15+
- **Redis** (recommended for caching)
- **npm**, **yarn**, or **bun**

### Installation

```bash
# Clone and enter the project directory
git clone https://github.com/your-org/swip-dashboard.git
cd swip-dashboard

# Install dependencies
npm install

# Copy environment template
cp env.example .env.local
# Populate .env.local with your credentials

# Apply database schema
npx prisma migrate deploy
npx prisma generate

# Run the development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## 🔧 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | ✅ | Auth session secret (≥32 chars) |
| `BETTER_AUTH_URL` | ✅ | Base URL for Better Auth callbacks |
| `SWIP_INTERNAL_API_KEY` | ✅ | High-privilege key used by the SWIP App |
| `REDIS_URL` | ⛭ | Redis instance for caching (optional but recommended) |
| `ALLOWED_ORIGINS` | ⛭ | Comma-separated list for CORS |
| OAuth keys | ⛭ | Google/GitHub client IDs & secrets |

> Partner ingestion uses `verified-apps.json`. Keep it in sync with deployment. The loader caches the file in Redis (`verified-apps:config`) and refreshes automatically when a lookup fails.

---

## 🔐 Authentication & Authorization

1. **SWIP Internal Key** – Injected as `x-swip-internal-key` for all first-party write APIs.
2. **Verified App API Keys** – Created via the dashboard, hashed in the database, and validated with SHA-256 lookup. `validateIngestionAuth` ensures the payload `app_id` matches the key’s registered app.
3. **Developer Read Keys** – Provide `x-api-key` for `/api/v1/*` GET endpoints. Results are automatically scoped to the developer’s claimed apps.
4. **Dashboard Session** – `better-auth` handles Google/GitHub SSO. Middleware protects all portal routes.

Sample response for a rejected partner ingestion attempt:

```json
{
  "success": false,
  "error": "App partner.fit.focus is not verified for data ingestion"
}
```

---

## 🌐 API Surface

### Ingestion APIs (Protected)

| Endpoint | Method | Auth | Notes |
|----------|--------|------|-------|
| `/api/v1/apps` | POST | `x-swip-internal-key` **or** verified `x-api-key` | Partners can only upsert their own app ID |
| `/api/v1/app_sessions` | POST | same as above | Automatically creates or updates by `app_session_id` |
| `/api/v1/app_biosignals` | POST | same as above | Accepts JSON array, verifies session ownership |
| `/api/v1/emotions` | POST | same as above | Updates session averages and leaderboard cache |

### Developer Read APIs (Protected)

All responses are limited to claimed apps owned by the API key’s user.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/apps` | GET | List claimed apps with aggregate stats |
| `/api/v1/app_sessions` | GET | Paginated session history (supports `app_id`, `limit`) |
| `/api/v1/app_biosignals` | GET | Biosignals for a session (supports `limit`) |
| `/api/v1/emotions` | GET | Emotions for a biosignal or session |

### Portal & Admin APIs (Session Auth)

| Endpoint | Method(s) | Purpose |
|----------|-----------|---------|
| `/api/apps` | GET/POST | Register, list, and claim apps |
| `/api/api-keys` | GET/POST/PATCH/DELETE | Manage developer keys |
| `/api/analytics/*` | GET/POST | Analytics dashboards & filters |

Full OpenAPI documentation is available at `/documentation`.

---

## 🧪 SWIP App / Partner Ingestion Quickstart

```bash
# 1. Register or update your app
curl -X POST https://dashboard.swip.app/api/v1/apps \
  -H "Content-Type: application/json" \
  -H "x-api-key: swip_key_partner_sdk" \
  -d '{
    "app_id": "com.partner.focuscoach",
    "app_name": "Focus Coach",
    "category": "Productivity",
    "developer": "Partner Labs"
  }'

# 2. Create a session (must match the key’s app ID)
curl -X POST https://dashboard.swip.app/api/v1/app_sessions \
  -H "Content-Type: application/json" \
  -H "x-api-key: swip_key_partner_sdk" \
  -d '{
    "app_session_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "anon_user_001",
    "device_id": "apple_watch_9",
    "started_at": "2025-11-06T15:00:00Z",
    "ended_at": "2025-11-06T15:15:00Z",
    "app_id": "com.partner.focuscoach",
    "data_on_cloud": 1
  }'

# 3. Upload biosignals (bulk array)
curl -X POST https://dashboard.swip.app/api/v1/app_biosignals \
  -H "Content-Type: application/json" \
  -H "x-api-key: swip_key_partner_sdk" \
  -d '[{
    "app_biosignal_id": "biosignal-001",
    "app_session_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2025-11-06T15:00:05Z",
    "heart_rate": 72,
    "hrv_sdnn": 65.4
  }]'

# 4. Upload emotions (bulk array)
curl -X POST https://dashboard.swip.app/api/v1/emotions \
  -H "Content-Type: application/json" \
  -H "x-api-key: swip_key_partner_sdk" \
  -d '[{
    "app_biosignal_id": "biosignal-001",
    "swip_score": 78.5,
    "phys_subscore": 65.2,
    "emo_subscore": 82.1,
    "confidence": 0.87,
    "dominant_emotion": "Amused",
    "model_id": "swip_emotion_v1"
  }]'
```

All four endpoints return descriptive errors when the app ID fails verification or the developer key is revoked.

---

## 🎨 Frontend Highlights

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Marketing landing page |
| `/leaderboard` | Public | Hourly leaderboard with countdown and share actions |
| `/sessions` | Authenticated | Session explorer with search, filters, and biosignal drilldowns |
| `/analytics` | Authenticated | Trend dashboards and session analytics |
| `/developer` | Authenticated | App registry, verified-partner insights, API key management |
| `/documentation` | Public | Interactive developer guide and API docs |

The session explorer dynamically loads tables and charts, uses memoised search, and respects the Redis caches populated by the API layer.

---

## ⚡ Performance & Reliability

- **Hourly Leaderboard Refresh** – Redis-backed cache with automatic fallback to Prisma.
- **Scoped Developer Caches** – Per-user caches on heavy list endpoints reduce response time by ~80% under load.
- **Verified App Registry Cache** – In-memory + Redis caching ensures ingestion stays hot while allowing runtime edits.
- **Bulk Writes** – `/app_biosignals` and `/emotions` accept arrays; Prisma performs efficient `createMany` operations with `skipDuplicates`.
- **Indexed Schema** – All FK, timestamp, and score fields are indexed for time-series and aggregation queries.

---

## 📁 Project Structure

```
swip-dashboard/
├── app/                     # Next.js App Router
│   ├── api/                 # API routes (ingestion, analytics, portal)
│   ├── leaderboard/         # Leaderboard page + countdown
│   ├── sessions/            # Session explorer
│   ├── analytics/           # Analytics dashboard
│   ├── developer/           # Developer portal
│   └── documentation/       # Markdown-driven docs
├── components/              # UI primitives & feature components
├── content/                 # Markdown docs (developer guide, API guide)
├── prisma/                  # Database schema & migrations
├── src/lib/                 # Auth, cache, logging, verified apps, Prisma
├── scripts/                 # CLI utilities & cron helpers
├── verified-apps.json       # Verified ingestion registry
└── README.md                # You are here
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-change`)
3. Commit (`git commit -m "Describe your change"`)
4. Push and open a pull request

Please include tests (or manual testing evidence) for changes impacting ingestion, caching, or security paths.

---

## 📄 License

Released under the [MIT License](LICENSE). Feel free to fork, extend, and deploy in your own environment.

---

## 📞 Support & Resources

- **Documentation**: `/documentation`
- **API Reference**: `/documentation#api-reference`
- **Email**: support@swip-dashboard.com
- **GitHub Issues**: [github.com/your-org/swip-dashboard/issues](https://github.com/your-org/swip-dashboard/issues)

---

**Built with ❤️ for wellness transparency**  
*Last updated: 6 November 2025*

### Supported Dominant Emotions

The analytics pipeline standardises incoming emotion labels to three values:

- `Stressed`
- `Calm`
- `Amused`

Payloads submitted to `/api/v1/emotions` must use one of these values (case-insensitive).
