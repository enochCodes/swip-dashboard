# SWIP Dashboard – Final Architecture (Updated 2025-11-06)

## 🎯 Core Principles

- **Controlled Ingestion:** Only the SWIP App and a vetted list of partner apps may write wellness data. Everyone else has read-only access.
- **App Identity First:** App IDs unify ingestion, storage, analytics, and authorisation. Partner keys are scoped to a single app ID.
- **Secure by Default:** Every write path is authenticated; public-facing users only consume anonymised aggregate data.

---

## 🔐 Authentication Matrix

| Channel | Header | Purpose | Scope |
|---------|--------|---------|-------|
| **SWIP Internal Key** | `x-swip-internal-key` | First-party ingestion (apps, sessions, biosignals, emotions) | May ingest data for *any* app ID |
| **Verified App API Key** | `x-api-key` | Partner ingestion via SWIP Ware SDK | Must match the key’s app ID and appear in the verified registry |
| **Developer Read API Key** | `x-api-key` | Read-only analytics APIs | Only apps owned (claimed) by the requesting developer |
| **Dashboard Session** | `better-auth` cookie | Developer portal, API key management, analytics UI | Authenticated dashboard users |

> **Important:** Partner ingestion never reuses the internal SWIP key. `validateIngestionAuth` looks up the developer key, refreshes the verified apps registry if needed, and rejects writes if `payload.app_id !== apiKey.appExternalId`.

---

## 📦 Verified Apps Registry

- Source of truth lives in `/verified-apps.json`.
- `src/lib/verified-apps.ts` loads the file, caches it in-memory, and also stores it in Redis (`verified-apps:config`, TTL 5 minutes).
- When a lookup misses (app not found in cache), the loader reloads the JSON file and refreshes the Redis entry before returning the validation result.

```json
{
  "swip_app_id": "ai.synheart.swip",
  "verified_apps": [
    "ai.synheart.swip",
    "com.partner.focuscoach",
    "com.partner.mindgarden"
  ]
}
```

---

## 🛠️ Ingestion Workflows

### 1. SWIP App (First-Party)

```
Mobile SWIP App
  ↓ (x-swip-internal-key)
POST /api/v1/apps               → Upserts app (claimable=true)
POST /api/v1/app_sessions       → Creates/updates by app_session_id
POST /api/v1/app_biosignals     → Bulk insert biosignals
POST /api/v1/emotions           → Bulk insert emotions + recompute averages
```

- Internal key grants universal ingest rights.
- Sessions and emotions trigger average score recalculations and warm the leaderboard cache.
- Emotion payloads are normalised to **Stressed**, **Calm**, or **Amused** during ingestion; any other value is rejected.

### 2. Partner Apps (SWIP Ware SDK)

```
Partner SDK
  ↓ (x-api-key)
validateIngestionAuth()
  ↳ validateDeveloperApiKey()
  ↳ load verified-apps registry (refresh on miss)
  ↳ verifyAppIdMatch(payload.app_id)
POST /api/v1/apps               → Only for the partner’s app ID
POST /api/v1/app_sessions       → Requires matching app_id
POST /api/v1/app_biosignals     → Validates session ownership
POST /api/v1/emotions           → Validates session + biosignal
```

- If the API key references an app ID not present in the verified registry, the request fails (`403`) with a descriptive error.
- When Swip adds a new partner ID, no redeploy is required; updating `verified-apps.json` is enough.

---

## 🧠 Developer Read APIs

- `validateDeveloperApiKey` returns the key metadata (internal `appId`, external `app.appId`, user id).
- `GET /api/v1/*` endpoints enforce ownership by filtering on `ownerId` and `claimable=false`.
- Pagination & limits are clamped (1–100) to protect the database and improve cache hit ratios.

---

## ⚙️ Redis & Response Caching

| Feature | Cache Key | TTL | Notes |
|---------|-----------|-----|-------|
| Leaderboard data | `leaderboard:data` | 60 minutes | Stores entries, metadata, and `expiresAt` used by the countdown |
| Developer apps list | `developer:apps:${userId}:category:${category||all}:limit:${limit}` | 60 seconds | Warmed before Prisma query |
| Developer sessions list | `developer:sessions:${userId}:app:${appId||all}:limit:${limit}` | 60 seconds | Cached with query params |
| Session biosignals | `session:${sessionId}:biosignals:limit:${limit}` | 30 seconds | Used by explorer & analytics |
| Session emotions | `session:${sessionId}:emotions` / `biosignal:${id}:emotions` | 60 seconds | Shared across views |
| Verified apps registry | `verified-apps:config` | 5 minutes | Reloads automatically on mismatch |

`src/lib/cache.ts` centralises JSON serialization, TTL handling, and error logging. All caches gracefully degrade when Redis is unavailable.

---

## 📊 Leaderboard Lifecycle

1. `getLeaderboardData()` retrieves cached data or falls back to Prisma aggregation.
2. `calculateAndCacheLeaderboard()` recomputes metrics, stores the payload in Redis, and records `expiresAt = now + 60 minutes`.
3. The countdown component reads `expiresAt`, showing an hh:mm:ss timer until the next recalculation.
4. A background cron job (optional) can call `forceRecalculateLeaderboard()` to refresh proactively.

---

## 🧱 Database Highlights

```prisma
model App {
  id           String   @id @default(cuid())
  name         String
  appId        String?  @unique
  category     String?
  developer    String?
  createdVia   String   @default("portal") // portal | swip_app | sdk
  ownerId      String?
  claimable    Boolean  @default(false)
  claimedAt    DateTime?
  avgSwipScore Float?
  appSessions  AppSession[]
  apiKeys      ApiKey[]
}

model ApiKey {
  id         String   @id @default(cuid())
  keyHash    String
  lookupHash String   @unique
  preview    String
  appId      String
  userId     String
  revoked    Boolean  @default(false)
  lastUsed   DateTime?
  app        App      @relation(fields: [appId], references: [id])
  user       User     @relation(fields: [userId], references: [id])
}

model AppSession {
  id            String        @id @default(cuid())
  appSessionId  String        @unique
  appInternalId String
  userId        String?
  deviceId      String?
  startedAt     DateTime
  endedAt       DateTime?
  dataOnCloud   Int           @default(0)
  avgSwipScore  Float?
  duration      Int?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  app           App           @relation(fields: [appInternalId], references: [id])
  biosignals    AppBiosignal[]
}
```

Key indices:

- `App.appId`, `App.createdVia`, `App.ownerId`
- `ApiKey.lookupHash`, `ApiKey.revoked`, `ApiKey.lastUsed`
- `AppSession.appSessionId`, `AppSession.appInternalId`, `AppSession.startedAt`
- `AppBiosignal.appSessionId`, `AppBiosignal.timestamp`
- `Emotion.appBiosignalId`

---

## 🔁 Data Processing Pipeline

1. **Ingestion** – SWIP App or partner SDK posts data.
2. **Validation** – Authentication guard validates keys, verified apps registry, and app ID match.
3. **Persistence** – Prisma writes to Postgres, using `createMany` with `skipDuplicates` for batch data.
4. **Aggregation** – Session averages and app averages recalculate after biosignal/emotion inserts.
5. **Caching** – Leaderboard and developer endpoints cache results in Redis for fast, repeat access.
6. **Presentation** – Next.js server components stream data to UI pages; client components handle interactivity.

---

## 🧾 Logging & Observability

- `src/lib/logger.ts` exposes a Winston logger (console + optional file transport).
- Authentication and ingestion failures log warnings with request context (IP, path, key preview).
- Cache reads and writes log at `info` level to aid debugging.
- Unexpected errors surface to Sentry/console (depending on environment configuration).

---

## 🧪 Testing Strategy

- **Unit** – Utility modules (`verified-apps`, `cache`, `auth`) tested via Jest/tsx scripts.
- **Integration** – `scripts/test-secure-architecture.sh` automates the full ingestion workflow.
- **E2E** – Use Postman collection (`postman_swip.json`) for manual validation of partner vs. read-only behaviour.

---

## 🚀 Deployment Notes

- Environment must provide `SWIP_INTERNAL_API_KEY` and keep `verified-apps.json` up to date.
- Redis is optional but highly recommended; without it, countdowns still function but rely on live aggregation.
- Leaderboard recalculates hourly; consider scheduling `forceRecalculateLeaderboard()` if real-time updates are required after ingest spikes.

---

**Last updated:** 6 November 2025

