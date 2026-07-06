# Kushlov

**Kushlov** is a production-ready dating & live-streaming platform: matching, real-time chat, 1:1 audio/video calls, live streaming, a diamond/gold wallet with a full ledger, a pluggable payment layer, host verification, and a complete admin panel.

Built as a **pnpm monorepo** with a Next.js 15 frontend and an Express + MongoDB backend.

---

## Tech Stack

**Frontend** — Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn-style UI, Zustand, React Hook Form, Zod, TanStack Query, Socket.io client, LiveKit components.

**Backend** — Express, Node.js, MongoDB + Mongoose, Socket.io, JWT auth (access + refresh), Bcrypt, Multer, Cloudinary, LiveKit Server SDK, Redis (optional), Pino logging, Helmet, CORS, rate limiting.

---

## Monorepo Structure

```
kushlov/
├─ apps/
│  ├─ web/        # Next.js 15 frontend (App Router)
│  └─ server/     # Express + MongoDB REST API + Socket.io
├─ packages/
│  ├─ types/      # Shared enums, DTOs, socket event contracts
│  ├─ utils/      # Framework-agnostic helpers
│  └─ ui/         # Shared React UI primitives (Button, Logo, cn)
├─ .env.example   # Copy to .env and fill in
└─ pnpm-workspace.yaml
```

### Backend layout (`apps/server/src`)

```
config/      env validation, db, redis, logger, cloudinary
models/      Mongoose models for every collection
middleware/  auth (JWT + RBAC), validate (Zod), error, rateLimit, upload (Multer)
services/    media (Cloudinary), livekit, wallet ledger, notifications, payments/*, settings
modules/     feature modules (auth, users, social, chat, calls, live, wallet, payments,
             gifts, verification, moderation, notifications, admin, settings)
socket/      Socket.io server + realtime handlers
routes/      root API router
seed/        idempotent bootstrap (admin, gifts, instructions, settings)
```

---

## Prerequisites

- **Node.js ≥ 20**
- **pnpm ≥ 9** (`npm i -g pnpm` or `corepack enable`)
- **MongoDB** running locally or a connection string (Atlas)
- _(optional)_ Redis, a Cloudinary account, and a LiveKit project

---

## Getting Started

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env          # then edit values (Windows: copy .env.example .env)

# 3. Start MongoDB (local example)
#    mongod --dbpath <your-data-dir>

# 4. Run both apps (web + api) in parallel
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:5000 (health check at `/health`)

Run individually:

```bash
pnpm dev:server
pnpm dev:web
```

A default admin account is seeded on first boot from `ADMIN_EMAIL` / `ADMIN_PASSWORD`
(defaults: `admin@kushlov.app` / `Admin@12345`). Log in and open **/admin**.

> The `.env` at the repo root is picked up by both apps. The web app also reads
> `NEXT_PUBLIC_*` values — you can keep them in the same root `.env`.

---

## Environment Variables

See [`.env.example`](./.env.example) for the full list. Key ones:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Token signing secrets |
| `NEXT_PUBLIC_API_URL` | API base URL used by the frontend |
| `CLOUDINARY_*` | Media uploads (falls back to a dev data-URL if unset) |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Calls & live streaming |
| `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit websocket URL for the client |
| `REDIS_URL` | Optional — shared rate-limit store |
| `PAYMENT_PROVIDER` | `mock` (default) or add your own provider |

> Uploads and LiveKit gracefully degrade when unconfigured, so you can run and
> explore the whole app locally before wiring third-party services.

---

## Feature Highlights

- **Auth** — register, login, logout, refresh, forgot/reset password, JWT + refresh cookies, role-based access (`user` / `host` / `admin`).
- **Social** — likes → mutual matches, follow hosts, search & filter, report & block.
- **Host verification** — 3-step flow (basic info → documents → 3 live selfies + 1 live video) with admin-defined capture instructions; statuses: pending / approved / rejected / need more info.
- **Wallet & ledger** — diamonds (users) and gold (hosts) with immutable double-entry transactions and a configurable conversion ratio.
- **Payments** — provider-agnostic abstraction (working mock provider), purchase → verify → credit, webhook endpoint, history.
- **Chat** — realtime text/media/voice, read receipts, typing, delete, reply, forward.
- **Calls** — LiveKit-powered 1:1 audio/video with per-minute billing and history.
- **Live streaming** — go live, viewer count, live chat, likes, gifts, moderators, ban/mute.
- **Gifts** — admin-managed catalog; sending spends diamonds and credits host gold.
- **Notifications** — realtime + persisted for messages, calls, matches, likes, followers, live, gifts, payments, announcements.
- **Admin** — dashboard analytics, user & host management, verification review, reports, payments, withdrawals, gifts, and platform settings.

---

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Run web + server together |
| `pnpm build` | Build all packages/apps |
| `pnpm --filter @kushlov/server seed` | Re-run the bootstrap seed |
| `pnpm typecheck` | Type-check every workspace |
| `pnpm lint` | Lint every workspace |
| `pnpm format` | Prettier write |

---

## Production Notes

- The server bundles to a single ESM file via `tsup` (`pnpm --filter @kushlov/server build`) and runs with `node dist/index.js`.
- Set strong secrets, a real `MONGODB_URI`, Cloudinary, LiveKit, and a live payment provider.
- Put the API behind HTTPS so secure cookies (`sameSite=None; Secure`) work for cross-site auth.
- Add Redis (`REDIS_URL`) for distributed rate limiting and horizontal scaling.
