# 🚀 PapaStocks v1.2 — Production Notes (Vercel)

**What this update fixes:** notifications now really arrive when the app is fully
closed on a Vercel deployment. Previous builds worked in local/self-hosted mode but
silently broke on Vercel for three reasons, all fixed here:

1. **Subscriptions were saved to a local file** (`.push-store.json`). Vercel's
   serverless filesystem is read-only and each function instance is ephemeral, so the
   write silently failed and the tick job never saw any devices.
   → Subscriptions, VAPID keys, and alert-dedupe state now live in a Redis KV store.
2. **VAPID keys regenerated on every cold start**, so pushes to already-subscribed
   devices were rejected by Apple/Google push servers.
   → Keys now come from env vars (or are generated once and persisted in KV), and the
   app detects a key change and automatically re-subscribes the device.
3. **Nothing ever ran the price check** — the in-process 60-second timer dies with the
   serverless function.
   → `vercel.json` now ships a cron that hits `GET /api/push/tick` every minute.

Also fixed: Smart Notify's price baseline used to live in memory, so on serverless it
could never detect a "move" — it's persisted now, and once-per-day alerts no longer
repeat after a cold start.

---

## Required setup on Vercel

### 1. Attach a Redis KV store (required)

In the Vercel dashboard: **Storage → Create Database → Upstash (Redis)** (free tier is
plenty), then connect it to the project. That injects `KV_REST_API_URL` and
`KV_REST_API_TOKEN` automatically — the app picks them up with no code changes.

Using Upstash directly instead? Set `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN`. Either pair works.

> Without a KV store the app falls back to file storage, which does **not** work on
> Vercel — closed-app notifications will stay broken.

### 2. Set VAPID keys (strongly recommended)

Generate once, locally:

```bash
npx web-push generate-vapid-keys
```

Then in **Project → Settings → Environment Variables** add:

| Variable | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | the generated public key |
| `VAPID_PRIVATE_KEY` | the generated private key |

If you skip this, the app generates a pair once and keeps it in KV — that works too,
but env vars survive even a KV wipe, so existing subscriptions never break.

### 3. The cron (required)

This repo is set up for Vercel's **Hobby (free) plan**, which only allows once-daily
crons — `vercel.json` ships a daily fallback tick (weekdays around market open). The
real minute-by-minute checking comes from a free external pinger:

1. Sign up at [cron-job.org](https://cron-job.org) (free).
2. Create a cronjob with URL `https://<your-app>.vercel.app/api/push/tick`,
   schedule **every 1 minute** (every 5 minutes also works; alerts are just a little
   less prompt), and save. That's it — UptimeRobot's free monitor works the same way
   (5-minute interval).

**On the Pro plan** you can skip the external pinger: change the schedule in
`vercel.json` to `* * * * *` and Vercel runs it every minute itself.

### 4. Protect the tick endpoint (optional)

Set a `CRON_SECRET` env var to lock `/api/push/tick` down:

- Vercel's own cron automatically sends it as `Authorization: Bearer <secret>`.
- An external pinger should call `/api/push/tick?secret=<secret>`.

Unset, the endpoint stays public — harmless (it only triggers a price check) but it
counts against your function invocations.

### Existing env vars (unchanged)

- `GEMINI_API_KEY` — optional, for the smarter AI buddy replies.

---

## After deploying

1. **Open the app once on each phone** (from the Home Screen icon). It re-syncs the
   device's subscription against the new keys and pushes the watchlist/alert config to
   the server. Devices subscribed under the old broken keys heal automatically.
2. **Verify the pipeline:** visit `https://<your-app>.vercel.app/api/push/tick` in a
   browser. You should see JSON like
   `{"sent":0,"failed":0,"expired":0,"checked":6,"subs":1,"symbols":6,"store":"kv"}`.
   - `store` must say `"kv"` — if it says `"file"`, the KV env vars aren't set.
   - `subs` must be ≥ 1 after a phone has opened the app with alerts allowed.
3. **Send a real test:** in the app, set a price alert that's guaranteed to trigger
   (e.g. "tell me when AAPL crosses $1 — above"), close the app fully, and wait for
   the next cron tick.

## iPhone reminders (unchanged, but worth repeating)

- iOS 16.4+ only, and the app **must be added to the Home Screen**
  (Safari → Share → Add to Home Screen). Safari-tab web pages can't receive push on iOS.
- Notifications must be allowed via the **Allow** button in Settings → Notifications
  inside the app.
- iOS may drop push subscriptions for apps unused for weeks; opening the app
  re-subscribes automatically.
