# Architecture Overview

Kitchen dashboard running on a Raspberry Pi 5 with a 7" touchscreen. Angular frontend + Express/Node backend, served on port 3000.

## Stack

- **Client**: Angular (standalone components, signals, zoneless change detection) — `client/`
- **Server**: Express + TypeScript, SQLite for meals — `server/`
- **Deploy**: Systemd services on RPi, user `zander`, installed at `/opt/st-albans/` — `deploy/`

## Server (port 3000)

Express serves the Angular build as static files and provides the API.

| Area | Route prefix | Key files |
|---|---|---|
| Bin collections | `GET /api/bin-collection` | `server/src/routes/bin-collection.route.ts`, `server/src/services/bin-collection.service.ts` |
| Meal plan (public) | `GET /api/meals/plan`, `POST /api/meals/suggestions` | `server/src/routes/meal.route.ts`, `server/src/services/meal.service.ts` |
| Meal admin (auth) | `GET/PUT /api/meals/suggestions`, CRUD `/api/meals/*` | Same files, guarded by `requireAdmin` middleware (Bearer token) |
| Health | `GET /api/health` | `server/src/server.ts` |

**Data sources**: St Albans council API (Veolia proxy) for bins, Open-Meteo for weather (client-side), SQLite for meals.

**Environment variables** (`/opt/st-albans/server/.env`):
`PORT`, `HOST`, `UPRN`, `TEST_MODE`, `TEST_MODE_VARIANT`, `MEAL_ADMIN_PASSWORD`

## Client routing

| Path | Component | Notes |
|---|---|---|
| `/` | `NextBinCollection` | Default on Pi screen; phones redirected to `/meals` via `phoneRedirectGuard` |
| `/meals` | `MealsComponent` | Public meal suggestions + 7-day plan |
| `/meals/admin` | `MealAdminComponent` | Lazy-loaded, password-protected |

## Key client services (`client/src/app/shared/services/`)

| Service | Purpose |
|---|---|
| `idle.service.ts` | Tracks user activity; triggers clock overlay after 2 min (prod) |
| `barcode-listener.service.ts` | USB barcode scanner input via keystroke timing — captures EAN-13 codes |
| `notification.service.ts` | Generic notification system with suppression and cycling |
| `bin-collection-notification.service.ts` | "Put bins out tonight" reminders (noon–midnight before collection) |
| `temperature-notification.service.ts` | Frost/cold warnings based on overnight forecast |
| `meal.service.ts` | HTTP client for meal plan API |

## UI behaviour

- **Idle/screensaver**: After 2 min inactivity, clock overlay appears with weather badge + tonight's dinner
- **Night mode**: Bin display dims 19:00–06:00
- **Weather badge**: Rotates between current temp, rain chance, and daily max
- **Notifications**: Cycle every 8 seconds; appear during idle state

## Deployment

- Systemd service: `deploy/st-albans.service`
- Brightness timers: `deploy/brightness-day.timer`, `deploy/brightness-night.timer`
- Build script: `deploy/build-release.sh`
- Network watchdog: `deploy/network-watchdog.service`
- Cloudflare Tunnel: `deploy/cloudflared-tunnel.service`
