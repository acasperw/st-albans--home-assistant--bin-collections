# st-albans-recycling-refuse-collections
Simple Angular + Node (Express) application intended to run on a Raspberry Pi with an attached display (kiosk).

## TL;DR (Quick Deploy)
On dev machine (PowerShell):
```
pwsh ./deploy/build-prod.ps1
scp .\release\st-albans-*.tar.gz pi@raspberrypi.local:/home/pi/
```
On Pi (SSH):
```
cd /home/pi
tar -xzf st-albans-<timestamp>.tar.gz
sudo mv st-albans-<timestamp> /opt/
sudo ln -sfn /opt/st-albans-<timestamp> /opt/st-albans
sudo cp /opt/st-albans/server/.env.sample /opt/st-albans/server/.env
sudo nano /opt/st-albans/server/.env   # set UPRN
sudo cp /home/pi/deploy/st-albans.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now st-albans
```
Optional kiosk (add to `~/.config/lxsession/LXDE-pi/autostart`):
```
@chromium-browser --kiosk http://localhost:3000
```
Update later: build new tar -> copy -> extract -> move -> update symlink -> `sudo systemctl restart st-albans`.

## Overview
The Angular app is built to static files and served directly by the Node server (Express). One systemd unit keeps the server alive; Chromium runs in kiosk mode pointing to `http://localhost:3000`.

## 1. Build Production Artifacts (on your development machine)
Requires Node + npm. Run the PowerShell script:

```
pwsh ./deploy/build-prod.ps1
```

Output:
- `release/st-albans-<timestamp>/server` (server dist + Angular static files under `server/client`)
- `release/st-albans-<timestamp>.tar.gz` (upload this to the Pi)

## 2. Transfer to Raspberry Pi
Copy the generated `.tar.gz` to the Pi (replace `<host>` and `<file>`):

```
scp release/st-albans-*.tar.gz pi@<host>:/home/pi/
```

## 3. Install Node.js on Pi (once)
On the Pi:
```
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs chromium-browser
```

## 4. Deploy/Install Artifact on Pi
On the Pi (adjust the filename):
```
cd /home/pi
tar -xzf st-albans-<timestamp>.tar.gz
sudo rm -f /opt/st-albans
sudo mv st-albans-<timestamp> /opt/
sudo ln -sfn /opt/st-albans-<timestamp> /opt/st-albans
```

## 5. Environment Configuration
Create the environment file:
```
sudo cp /opt/st-albans/server/.env.sample /opt/st-albans/server/.env
sudo nano /opt/st-albans/server/.env
```
Populate:
```
PORT=3000
UPRN=YOUR_UPRN_VALUE
# Optional test settings
# TEST_MODE=true
# TEST_MODE_VARIANT=tomorrow
```

## 6. systemd Service (one‑time)
Copy service unit and enable:
```
sudo cp /opt/st-albans/server/../deploy/st-albans.service /etc/systemd/system/st-albans.service 2>/dev/null || sudo cp /home/pi/deploy/st-albans.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now st-albans
```
Check status/logs:
```
systemctl status st-albans
journalctl -u st-albans -f
```

Service runs: `/usr/bin/node dist/server.js` inside `/opt/st-albans/server`.

## 7. Kiosk Autostart (Chromium)
Append the lines in `deploy/pi-kiosk-autostart.txt` to:
```
~/.config/lxsession/LXDE-pi/autostart
```
Create the folder/file if missing. Example:
```
mkdir -p ~/.config/lxsession/LXDE-pi
nano ~/.config/lxsession/LXDE-pi/autostart
```
Paste content:
```
@xset s off
@xset -dpms
@xset s noblank
@chromium-browser --noerrdialogs --disable-session-crashed-bubble --disable-infobars --kiosk http://localhost:3000
```
Reboot to test kiosk:
```
sudo reboot
```

## 8. Updating to a New Version
On dev machine: re-run build script -> new `.tar.gz`.
On Pi:
```
scp newfile.tar.gz pi@<host>:/home/pi/
ssh pi@<host>
tar -xzf newfile.tar.gz
sudo mv st-albans-<newtimestamp> /opt/
sudo ln -sfn /opt/st-albans-<newtimestamp> /opt/st-albans
sudo systemctl restart st-albans
```
Nothing else needed unless `.env` keys changed.

## 9. Directory Layout on Pi (after deploy)
```
/opt/st-albans/
	server/
		dist/server.js
		client/ (Angular static files)
		.env
```

## 10. Minimal Troubleshooting
- Blank screen: Press F5 / ensure service running.
- API not loading: check `journalctl -u st-albans -f`.
- Change UPRN: edit `/opt/st-albans/server/.env` then `sudo systemctl restart st-albans`.

## 11. Local Development (optional)
Run server and Angular separately:
```
cd server && npm run dev
cd client && npm start
```

## 12. Original Quick Setup (legacy)
Old note kept for reference:
```
PORT=3000
UPRN=xxxx
TEST_MODE=false
TEST_MODE_VARIANT=tomorrow
```

---
"Fire & forget" steps: build -> copy archive -> extract to versioned dir -> update symlink -> restart service.
