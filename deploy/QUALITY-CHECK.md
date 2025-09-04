# Quality Check (before deploying or restarting service)

Run the simplified build script (can be on dev machine or directly on the Raspberry Pi):
```
./deploy/build-release.sh
```
This performs:
1. Angular production build (`client/dist/bin-collection-app/browser`)
2. Server TypeScript compile (`server/dist`)

Smoke test locally:
```
cd server
node dist/server.js
# Visit http://localhost:3000
```
You should see the app load from the built Angular assets. If it loads, static serving + SPA fallback are working.

Environment file reminder (`server/.env` on Pi):
```
UPRN=YOUR_UPRN
PORT=3000
# TEST_MODE=true
# TEST_MODE_VARIANT=tomorrow|weekend|empty|far
```

Systemd service will use the `PORT` and `UPRN` values from this file.
