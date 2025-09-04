# st-albans-recycling-refuse-collections
Simple Angular + Node (Express) app for a Raspberry Pi kiosk display showing bin collection info.

## Quick Start (Simplest Path – Build Directly on Pi)
On the Raspberry Pi (first time):
```
sudo apt-get update
sudo apt-get install -y curl chromium-browser git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```
Clone repo:
```
cd /opt
sudo git clone https://github.com/acasperw/st-albans-recycling-refuse-collections st-albans
sudo chown -R pi:pi st-albans
cd st-albans
```
Build (installs deps + compiles Angular + server):
```
./deploy/build-release.sh
```
Create environment file:
```
cp server/.env.sample server/.env
nano server/.env   # set UPRN
```
Test run:
```
cd server
node dist/server.js
# Visit http://localhost:3000
```
If it loads, stop with Ctrl+C and set up the service.

Install systemd service (one‑time):
```
sudo cp deploy/st-albans.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now st-albans
```
Check logs:
```
journalctl -u st-albans -f
```

## Updating Later
SSH to Pi:
```
cd /opt/st-albans
git pull
./deploy/build-release.sh
sudo systemctl restart st-albans
```
Only rebuilds what’s needed; no archives or symlinks required.

Shortcut (single script):
```
./deploy/update-and-restart.sh
```
Just ensure you committed & pushed changes first.

## Kiosk Mode (Chromium Autostart)
Append the contents of `./deploy/pi-kiosk-autostart.txt` to:
```
~/.config/lxsession/LXDE-pi/autostart
```
Create file if missing. Reboot to confirm kiosk:
```
sudo reboot
```

## Environment `.env` (server/.env)
```
UPRN=YOUR_UPRN
PORT=3000
# TEST_MODE=true
# TEST_MODE_VARIANT=tomorrow|weekend|empty|far
```

## What The Build Script Does
`./deploy/build-release.sh`:
1. Installs/updates dependencies in `client` & runs Angular prod build.
2. Installs/updates dependencies in `server` & compiles TypeScript to `server/dist`.
3. Server serves the built Angular assets from its static directory.

## Local Development
Separate dev servers:
```
cd server && npm run dev
cd client && npm start
```
Integrated (simulate prod):
```
cd client && npm run build
cd server && npm run build && node dist/server.js
```

## Troubleshooting
- Blank screen: ensure service running (`systemctl status st-albans`).
- 404 on assets: rerun build script.
- Update UPRN: edit `server/.env`, restart service.
- Logs: `journalctl -u st-albans -f`.
 - Quick restart + logs: `./deploy/restart-service.sh`

## Previous Packaging Approach
Earlier tar/PowerShell packaging removed in favor of simpler on-device build (Pi 5 performance is sufficient). For deterministic immutable releases you could reintroduce an artifact build, but not required for rare updates.

## License
MIT (if you intend to add one – currently unspecified).
