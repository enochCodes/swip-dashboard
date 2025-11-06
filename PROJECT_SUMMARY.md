# SWIP Dashboard – Project Summary (Updated 6 Nov 2025)

## 🎯 Project Overview

**SWIP Dashboard** is an open-source wellness transparency platform. It ingests biosignal and emotion data from the **SWIP App** and a curated list of verified partner apps, then exposes anonymised analytics to developers and the public.

- **Version**: 1.0.0  
- **Status**: ✅ Production Ready  
- **License**: MIT

---

## 🏗️ Architecture

### Ingestion Sources

1. **SWIP App (first party)** – Uses `x-swip-internal-key` to ingest apps, sessions, biosignals, and emotions for *any* tracked app ID.
2. **Verified Partner Apps** – Communicate via the SWIP Ware SDK and a scoped `x-api-key`. Payload `app_id` must match the key’s app and exist in `verified-apps.json`.
3. **Developers** – Register/claim apps, generate read-only keys, and consume analytics via the dashboard or APIs.

### Core Middleware & Libraries

- `validateIngestionAuth` – Shared guard for POST `/api/v1/*` endpoints. Supports internal key and verified partner keys.
- `verified-apps.ts` – Loads `/verified-apps.json`, caches it in Redis (`verified-apps:config`, TTL 5 min), and refreshes on cache misses.
- `cache.ts` – Helper for JSON caches (`getCachedJson`, `setCachedJson`, `deleteCacheKey`).
- `redis-leaderboard.ts` – Recomputes leaderboard hourly and stores `expiresAt` used by the front-end countdown.

---

## 📊 Data Model

```
User (Dashboard accounts)
  ├── App (Wellness apps)
  │   ├── AppSession (Tracked usage sessions)
  │   │   ├── AppBiosignal (Wearable metrics)
  │   │   │   └── Emotion (AI detections)
  │   └── ApiKey (Per-app keys for ingestion/read)
  └── LeaderboardSnapshot (Redis-backed cache, optional)
```

- `App.createdVia` differentiates portals (`portal`), SWIP App (`swip_app`), and partner SDK (`sdk`).
- `ApiKey` stores `lookupHash` (SHA-256) for constant-time validation and exposes the app’s internal/external IDs during auth.

---

## 🚀 API Overview

### Ingestion (Protected)

| Endpoint | Method | Auth | Notes |
|----------|--------|------|-------|
| `/api/v1/apps` | POST | `x-swip-internal-key` or verified `x-api-key` | Partner keys can only upsert their own app ID |
| `/api/v1/app_sessions` | POST | same | Creates/updates by `app_session_id` |
| `/api/v1/app_biosignals` | POST | same | Bulk array, verifies session ↔ app ownership |
| `/api/v1/emotions` | POST | same | Bulk array, recomputes SWIP averages |

### Developer Read (Protected)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/apps` | GET | Owner-scoped list with SWIP stats |
| `/api/v1/app_sessions` | GET | Paginated sessions (`limit`, `app_id`) |
| `/api/v1/app_biosignals` | GET | Session biosignals (with optional limit) |
| `/api/v1/emotions` | GET | Biosignal or session-level emotions |

### Public Docs & Portal APIs

- `/documentation` – Interactive docs (Swagger + Markdown guide)
- `/api/apps`, `/api/api-keys`, `/api/analytics/*` – Session-authenticated developer portal endpoints

---

## ✨ Key Features

1. **Hourly Global Leaderboard**  
   - Redis cache keyed by `leaderboard:data` (TTL 60 min)  
   - Countdown component reads `expiresAt` from the payload  
   - Shareable snapshots (PNG export) and partner highlights

2. **Session Explorer**  
   - Cached GET endpoints for sessions, biosignals, emotions  
   - Optimised client search using deferred filtering  
   - Bulk upload support for ingestion workflows

3. **Developer Portal**  
   - App registration and claiming  
   - API key lifecycle (generate, revoke, reactivate, delete)  
   - Verified partner insights & ingestion audit trail

4. **Verified Apps Registry**  
   - JSON file + Redis cache  
   - Auto-refresh on key mismatch  
   - Distinguishes SWIP first-party app from partner IDs

- **Emotion Standardisation** – Ingestion normalises dominant emotions to `Stressed`, `Calm`, or `Amused`

---

## 🔐 Security Highlights

- `