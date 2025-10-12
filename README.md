# st-albans-recycling-refuse-collections
Simple Angular + Node (Express) app for a Raspberry Pi kiosk display showing bin collection info.

## Quick Start (Simplest Path – Build Directly on Pi)
On the Raspberry Pi (first time). These steps install a current Node (NodeSource) *or* you can use `nvm` (see below). Using a system-wide Node simplifies the systemd service.
```
sudo apt-get update
sudo apt-get install -y curl chromium git gh
# Install Node (Option A: system-wide via NodeSource – recommended for service)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
# Option B (nvm – if you prefer per-user Node; then adjust ExecStart path):
# curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# source ~/.bashrc && nvm install 22 && nvm alias default 22
```
Authenticate GitHub CLI (optional – needed only for private repos):
```
gh auth login -h github.com -p https -w
```

Clone repo (GitHub CLI):
```
cd /opt
sudo gh repo clone acasperw/st-albans-recycling-refuse-collections st-albans
sudo chown -R $USER:$USER st-albans
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

Install systemd service (one‑time). If you used system Node (`/usr/bin/node`) you can keep the provided unit. If you used **nvm**, edit `deploy/st-albans.service` and replace the `ExecStart` line with the absolute path to your `node` (e.g. `/home/USERNAME/.nvm/versions/node/v22.20.0/bin/node dist/server.js`).
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
gh repo sync
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
Recent Raspberry Pi OS images may use Wayland (`labwc:wlroots`) instead of LXDE. Use one of the following methods:

<!-- ### A. XDG Autostart (.desktop file) – works on Wayland & LXDE
```bash
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/chromium-kiosk.desktop <<'EOF'
[Desktop Entry]
Type=Application
Name=Chromium Kiosk
Exec=chromium --no-first-run --noerrdialogs --disable-session-crashed-bubble --disable-infobars --kiosk http://localhost:3000
X-GNOME-Autostart-enabled=true
EOF
```
Log out/in (or reboot). Chromium should appear full screen. -->

### B. User systemd service (robust, logged)
```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/chromium-kiosk.service <<'EOF'
[Unit]
Description=Chromium Kiosk Browser
After=graphical-session.target network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=chromium --no-first-run --noerrdialogs --disable-session-crashed-bubble --disable-infobars --kiosk http://localhost:3000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now chromium-kiosk.service
journalctl --user -u chromium-kiosk.service -f
```
If you want it to start without an active login:
```bash
loginctl enable-linger $USER
```

### Optional: Wait for backend before launching
Create `~/bin/kiosk-wrapper.sh`:
```bash
mkdir -p ~/bin
cat > ~/bin/kiosk-wrapper.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
URL=http://localhost:3000
HEALTH=$URL/api/health
for i in {1..30}; do
	if curl -fs "$HEALTH" >/dev/null 2>&1; then
		exec chromium --no-first-run --noerrdialogs --disable-session-crashed-bubble --disable-infobars --kiosk "$URL"
	fi
	sleep 2
done
exec chromium --no-first-run --noerrdialogs --disable-session-crashed-bubble --disable-infobars --kiosk "$URL"
EOF
chmod +x ~/bin/kiosk-wrapper.sh
```
Then replace the `Exec=` / `ExecStart=` line with `/home/$USER/bin/kiosk-wrapper.sh`.

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

## Automatic Screen Brightness (Day/Night via systemd)
If your display exposes `/sys/class/backlight/11-0045/brightness` (range 0–31), you can automatically dim at night and brighten in the morning using systemd timers provided in `deploy/`.

Included unit files:

* `brightness-set@.service` – parameterized oneshot to set a validated brightness (instance = value 0–31).
* `brightness-day.timer` – runs daily 07:30 → sets 20.
* `brightness-night.timer` – runs daily 22:00 → sets 2.
* `brightness-initial.service` (optional) – sets night value (2) early in boot so overnight reboots aren’t blinding.

### Install
```bash
sudo cp deploy/brightness-set@.service /etc/systemd/system/
sudo cp deploy/brightness-day.timer /etc/systemd/system/
sudo cp deploy/brightness-night.timer /etc/systemd/system/
sudo cp deploy/brightness-initial.service /etc/systemd/system/   # optional
sudo systemctl daemon-reload
sudo systemctl enable --now brightness-day.timer
sudo systemctl enable --now brightness-night.timer
sudo systemctl enable brightness-initial.service  # if used
```

### Verify
```bash
# Show timers
systemctl list-timers --all | grep brightness

# Manually trigger (set to 20 now)
sudo systemctl start brightness-set@20.service

# Check logs
journalctl -u brightness-set@20.service -u brightness-set@2.service -n 20 --no-pager

# Current raw value
cat /sys/class/backlight/11-0045/brightness
```

### Customize
* Change times: edit `OnCalendar=` in the `*.timer` files; then `sudo systemctl daemon-reload && sudo systemctl restart brightness-day.timer brightness-night.timer`.
* Change levels: edit the `Unit=` target in each timer (`brightness-set@25.service`, etc.).
* Test arbitrary level: `sudo systemctl start brightness-set@5.service`.
* Range guard: values outside 0–31 cause the service to exit with code 2 (logged).

### Remove
```bash
sudo systemctl disable --now brightness-day.timer brightness-night.timer
sudo systemctl disable brightness-initial.service
sudo rm /etc/systemd/system/brightness-{day.timer,night.timer,initial.service} /etc/systemd/system/brightness-set@.service
sudo systemctl daemon-reload
```

If your hardware uses a different backlight path, change `BACKLIGHT_PATH` inside the service files before copying.

## Troubleshooting
- Blank screen: ensure service running (`systemctl status st-albans`).
- 404 on assets: rerun build script.
- Update UPRN: edit `server/.env`, restart service.
- Logs: `journalctl -u st-albans -f`.
 - Quick restart + logs: `./deploy/restart-service.sh`
- Cannot reach app after starting via SSH but works when started manually elsewhere:
	1. Stop systemd service first: `sudo systemctl stop st-albans` (avoid port conflict).
	2. Ensure build exists: `ls server/dist/server.js` and `ls client/dist/bin-collection-app/browser/index.html`.
	3. Start manually from repo root: `cd server && node dist/server.js`.
	4. If remote access from another machine fails, set `HOST=0.0.0.0` in `.env` (or it defaults now) and restart.
	5. Check listener: `ss -tulpn | grep 3000`.
	6. Curl locally: `curl -I http://localhost:3000/api/health`.
	7. Node not found in service logs (`status=203/EXEC` or `/usr/bin/env: ‘node’: No such file or directory`): either install system Node (`apt install nodejs`) or edit `ExecStart` to absolute nvm path & remove `ProtectHome=true`.
	8. Executable scripts lost `+x` after sync: commit mode bits once – `git update-index --chmod=+x deploy/*.sh && git commit -m "chore: exec bits"`.
	9. Chromium not auto-starting: verify desktop type (`echo $XDG_CURRENT_DESKTOP`); use XDG `.desktop` or systemd user service on Wayland.
	10. Service restarts rapidly with exit code 217/USER: `User=` in unit doesn’t exist or permissions/ownership on target directories are wrong.

### View detailed service logs
```
journalctl -u st-albans -b --no-pager | tail -50
```

### Minimal debug variant of service (if hardening interferes)
Temporarily use:
```
NoNewPrivileges=true
PrivateTmp=true
```
Remove other hardening lines until stable, then add back incrementally.

## Previous Packaging Approach
Earlier tar/PowerShell packaging removed in favor of simpler on-device build (Pi 5 performance is sufficient). For deterministic immutable releases you could reintroduce an artifact build, but not required for rare updates.

### Using plain git instead (fallback)
If GitHub CLI isn't installed or you prefer raw git:
```
git pull
```

## License
MIT (if you intend to add one – currently unspecified).

---
### At a Glance: Common Commands
```bash
# Build
./deploy/build-release.sh

# Update + restart (script)
./deploy/update-and-restart.sh

# Service logs (follow)
journalctl -u st-albans -f

# User kiosk service logs
journalctl --user -u chromium-kiosk.service -f
```
