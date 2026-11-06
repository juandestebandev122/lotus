# Lotus Ludo

Social voice-room and multiplayer gaming platform. Web app plus an Android
wrapper, served from a single Node.js process.

Live: https://lotusplay.tech  
Admin: https://lotusplay.tech/admin  
Version: see `src/lib/lifelog.ts` (`APP_VERSION`) or `GET /api/version`

## What is in this repository

This is a full-stack application in one codebase. The framework is Next.js,
which runs the browser-side UI and the server-side API from the same project.
There is no separate backend repository and no external database server; both
are here.

| Layer | Location | Size |
|---|---|---|
| Frontend (user-facing pages) | `src/app/(app)/`, `src/app/(auth)/`, `src/app/legal/`, … | 60+ pages |
| Frontend components | `src/components/` | 112 files |
| Frontend logic (game rules, voice, helpers) | `src/lib/` | 106 files |
| **Backend — HTTP API** | `src/app/api/**/route.ts` | **273 endpoints** |
| **Backend — business logic and data access** | `src/server/repo.ts`, `src/server/db.ts` | 1.3 MB |
| Authentication | `src/server/auth.ts`, `src/app/api/auth/` | 16 endpoints |
| Admin panel | `src/app/admin/` | 121 sections |
| Database | `.data/db.json` at runtime (schema in `src/server/db.ts`, `DBShape`) — see `database/README.md` | ~90 collections |
| Voice server integration | `src/server/livekit.ts` | — |
| Payments | `src/server/razorpay.ts`, `src/server/stripe.ts` | — |
| Android app config | `twa-manifest.json` | — |
| Deployment files | `deploy/` | nginx, pm2, deploy script, LiveKit |
| Documentation | `docs/` | setup, schema, API index |

See `docs/API-INDEX.md` for every endpoint and `docs/DATABASE-SCHEMA.md` for
every collection.

## How the pieces connect

```
browser / Android app
        |
        v
nginx (443)  ->  Node.js process (3000)
                    |-- src/app/**            pages (React, server-rendered)
                    |-- src/app/api/**        REST endpoints
                    |       |
                    |       v
                    |-- src/server/repo.ts    business rules
                    |-- src/server/db.ts      loads/saves the database
                    |       |
                    |       v
                    `-- .data/db.json         the database (one file)

LiveKit (Docker, same host)  <-- voice audio only; the app issues access tokens
```

Every API route imports from `src/server/`. The server layer is the only code
that touches the database. Pages never read the file directly; they call the
API like any other client would.

## The database

The database is a single JSON document, `.data/db.json`, loaded into memory at
startup and written back on change (debounced, atomic rename). The full
structure is the `DBShape` interface in `src/server/db.ts` — roughly ninety
named arrays (users, rooms, transactions, gameSessions, …) plus a `config`
object holding every admin-panel setting.

This was a deliberate choice for a single-server deployment: no database
service to install, trivial backups (copy one file), and the whole state is
human-readable. Automatic snapshots are taken every 12 hours into
`.data/backups/`.

If `.data/db.json` does not exist on first start, the app creates an empty one
and seeds a default admin account, so the project runs from a clean checkout.

Never edit `db.json` while the process is running; it will be overwritten by
the next flush. Stop the process, edit, start.

## Requirements

- Node.js 22 LTS
- npm (bundled)
- For production: Linux host, nginx, pm2, Docker (for the voice server)

## Run locally

```bash
npm install
cp .env.example .env.local      # fill in what you have; the app runs without most of it
npm run dev
```

Open http://localhost:3000. The admin panel is at `/admin`.

Without LiveKit credentials voice rooms will not connect but everything else
works. Without payment keys the purchase flows run in request/approve mode
(admin verifies a payment proof and credits coins manually).

## Build for production

```bash
node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json   # type check
npm run build                                                      # webpack build, output: standalone
```

The build must run on a machine with at least 4 GB of free memory. The
`standalone` output in `.next/standalone/` is self-contained; copy it, plus
`.next/static/` and `public/`, to the server. See `deploy/deploy.sh` and
`docs/SETUP.md`.

Do not switch the build to Turbopack. The project is pinned to webpack in
`package.json` for a reason (native crashes on the build host).

## Environment variables

All variables are listed and explained in `.env.example`. None are committed.
`AUTH_SECRET`, `NODE_ENV=production`, `PORT` and `NODE_OPTIONS` are required;
the rest enable specific integrations.

## Deployment

Production runs as a pm2 process named `lotus` on port 3000 behind nginx with a
Let's Encrypt certificate. `deploy/` contains the nginx site file, the pm2
config, the deploy script, and a LiveKit config template. `docs/SETUP.md`
walks through a fresh server from scratch.

## Layout

```
.
├── src/
│   ├── app/             routes (pages and API), Next.js app directory
│   │   ├── (app)/       signed-in product: rooms, games, reels, wallet, profile
│   │   ├── (auth)/      login, signup, forgot, verify
│   │   ├── admin/       admin panel
│   │   ├── api/         HTTP API — the backend
│   │   └── legal/ …     public content pages
│   ├── components/      shared UI
│   ├── lib/             browser-side logic and helpers
│   └── server/          server-only: data layer, auth, integrations
├── public/              static assets, manifest, service worker
├── deploy/              server configuration
├── docs/                setup, schema, API index
├── next.config.ts
├── package.json
├── tsconfig.json
└── twa-manifest.json    Android (Trusted Web Activity) wrapper config
```

## License

Proprietary. All rights reserved by the owner.
