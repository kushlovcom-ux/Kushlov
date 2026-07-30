# Rate limiting & proxy — production notes (Kushlov)

## What was wrong

Legitimate clients were hitting **"Too many requests"** because:

1. A single global limit (**300 / 15 min**) covered almost everything.
2. Web background polls (co-live ~1–2.5s, calls ~2–2.5s, presence every 25s + discover invalidation) burned that budget quickly.
3. Redis stores (when enabled) shared one prefix → counters could collide.
4. `/auth/refresh` had no dedicated limiter.
5. Socket.io events had no throttle.
6. 429 UX was a raw generic string with no wait hint.

## Current limits (`apps/server/src/middleware/rateLimit.ts`)

| Limiter | Window | Max | Applied to |
|---------|--------|-----|------------|
| `globalLimiter` | 15m (env) | 300 (env) | All `/api/*` except payment webhook |
| `loginLimiter` | 15m | 10 | `POST /auth/login`, `/auth/google` |
| `registerLimiter` | 1h | 5 | `POST /auth/register` |
| `passwordResetLimiter` | 1h | 5 | forgot + reset password |
| `refreshLimiter` | 15m | 100 | `POST /auth/refresh` |
| `searchLimiter` | 1m | 100 | user/host search |
| `messageLimiter` | 1m | 120 | chat send / forward |
| `likeLimiter` | 1m | 60 | like / unlike / follow |
| `contactLimiter` | 1h | 10 | contact form |
| `reviewWriteLimiter` | 15m | 30 | review write |

**Live streaming (HTTP):** no extra express-rate-limit — only the global API budget.  
**Live / chat realtime:** Socket.io throttles in `apps/server/src/socket/` (typing, MessageSend, LiveJoin).

## Express behind Nginx

Already set:

```ts
app.set('trust proxy', 1);
```

Nginx must forward client IP (see `deploy/nginx/kushlov.conf`):

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header Host $host;
```

Verify on the server (temporary log or debug route): `req.ip` should be the browser IP, not `127.0.0.1`.

## Redis

Set `REDIS_URL` in production so PM2 workers share counters. Without Redis, MemoryStore is per-process (limits are softer / uneven).

## Frontend

- Friendly 429 copy + optional wait time (`apps/web/src/lib/api.ts`)
- React Query does not retry 429 (`providers.tsx`)
- Presence no longer invalidates discover every ping
- Co-live / call / live-chat polls slowed + pause when tab hidden
- Refresh remains single-flight

## Deploy checklist

1. Copy / merge `deploy/nginx/kushlov.conf`, reload nginx.
2. Ensure PM2 runs the API with `trust proxy` build.
3. Set `REDIS_URL`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`.
4. Restart API: `pm2 restart kushlov-api` (or your process name).
5. Confirm `/health` is not behind the API rate limiter (it is mounted outside `/api`).
