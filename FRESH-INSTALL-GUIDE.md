# Fresh Raspberry Pi OS (Trixie ARM64) Installation Guide
## Complete Setup for St Albans Bin Collection App

This guide covers all steps needed to get the bin collection kiosk app running on a freshly installed Raspberry Pi OS (Trixie ARM64).

---

## 1. Enable SSH Access (If Not Already Enabled)

SSH allows you to remotely access your Raspberry Pi from another computer on your network.

- Navigate to: **Interface Options** → **SSH** → **Yes**
- Select **Finish** and reboot if prompted

## 2. Initial System Setup

### Update System Packages
```bash
sudo apt-get update
sudo apt-get upgrade -y
```

### Set Hostname (Optional but Recommended)
```bash
# Replace 'st-albans-kiosk' with your desired hostname
sudo hostnamectl set-hostname st-albans-kiosk

# Edit /etc/hosts to update hostname
sudo nano /etc/hosts
# Change "127.0.1.1 raspberrypi" to "127.0.1.1 st-albans-kiosk"
sudo systemctl restart avahi-daemon
```

---

## 3. Install Required System Packages

```bash
sudo apt-get install -y curl git gh fonts-noto-color-emoji
```

**What these are for:**
- `curl` - Download scripts and test API endpoints
- `git` - Version control
- `gh` - GitHub CLI for easy repo management
- `fonts-noto-color-emoji` - Emoji support for UI

### Refresh Font Cache
```bash
sudo fc-cache -f -v
```

---

## 4. Install Node.js

**Using NVM (Recommended - per-user, easier version management):**
```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22
nvm alias default 22
nvm use 22
```

**Verify installation:**
```bash
node --version  # Should show v22.x.x
npm --version
```

---

## 5. Authenticate GitHub CLI (If Using Private Repo)

```bash
gh auth login
```

Follow the browser prompts to authenticate.

---

## 6. Clone the Repository

```bash
cd /opt
sudo gh repo clone acasperw/st-albans--home-assistant--bin-collections st-albans
sudo chown -R $USER:$USER st-albans
cd st-albans
```

**If not using GitHub CLI:**
```bash
cd /opt
sudo git clone https://github.com/acasperw/st-albans--home-assistant--bin-collections.git st-albans
sudo chown -R $USER:$USER st-albans
cd st-albans
```

---

## 7. Build the Application

```bash
./deploy/build-release.sh
```

This script:
1. Installs client (Angular) dependencies and builds production assets
2. Installs server (Node/Express) dependencies and compiles TypeScript
3. Takes several minutes on first run

---

## 8. Configure Environment Variables

Create the `.env` file from the sample:
```bash
cp server/.env.sample server/.env
nano server/.env
```

**Edit the file to set your UPRN:**
```bash
# Bin Collection
UPRN=YOUR_ACTUAL_UPRN_NUMBER

# App Settings
PORT=3000
HOST=0.0.0.0
# TEST_MODE=true
# TEST_MODE_VARIANT=tomorrow
```

Save and exit (`Ctrl+X`, `Y`, `Enter`).

---

## 9. Test the Application Manually

```bash
cd /opt/st-albans/server
node dist/server.js
```

**Test from the Pi itself:**
```bash
curl -I http://localhost:3000/api/health
```

**Test from another device on the network:**
- Open browser to `http://st-albans-kiosk.local:3000` (or use IP address)

If working, press `Ctrl+C` to stop the server.

---

## 10. Install and Configure Systemd Service

### Update the Service File for Your User

**If you used NVM (most likely):**
```bash
# Find your Node path
which node  # Copy this path

# Edit the service file
nano deploy/st-albans.service
```

Update these lines with your username and Node path:
```ini
User=YOUR_USERNAME
Group=YOUR_USERNAME
Environment=PATH=/home/YOUR_USERNAME/.nvm/versions/node/v22.20.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=/home/YOUR_USERNAME/.nvm/versions/node/v22.20.0/bin/node dist/server.js
```

**If you used system-wide Node:**
The service file should work as-is, but update the `User` and `Group` to your username.

### Install the Service
```bash
sudo cp deploy/st-albans.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable st-albans
sudo systemctl start st-albans
```

### Check Service Status
```bash
sudo systemctl status st-albans
journalctl -u st-albans -f
```

---

## 11. Configure Chromium Kiosk Mode

### Create User Systemd Service

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
systemctl --user enable chromium-kiosk.service
systemctl --user start chromium-kiosk.service
```

### Enable User Service to Start Without Login
```bash
loginctl enable-linger $USER
```

### Check Kiosk Status
```bash
systemctl --user status chromium-kiosk.service
journalctl --user -u chromium-kiosk.service -f
```

---

## 12. Optional: Smart Kiosk Wrapper (Waits for Backend)

This ensures Chromium doesn't start until the backend API is ready:

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

**Update the chromium-kiosk service to use the wrapper:**
```bash
nano ~/.config/systemd/user/chromium-kiosk.service
```

Change the `ExecStart` line to:
```ini
ExecStart=/home/YOUR_USERNAME/bin/kiosk-wrapper.sh
```

Reload and restart:
```bash
systemctl --user daemon-reload
systemctl --user restart chromium-kiosk.service
```

---

## 13. Optional: Network Watchdog (Auto-Reconnect on Loss)

To automatically restore network connectivity when Wi-Fi/Ethernet drops:

```bash
sudo cp /opt/st-albans/deploy/network-watchdog.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/network-watchdog.sh
sudo cp /opt/st-albans/deploy/network-watchdog.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now network-watchdog.service
```

**How it works:**
- Pings Google DNS every 30 seconds
- Automatically restarts network services if connection lost
- Logs activity to `/var/log/network-watchdog.log`
- App continues showing cached data during outages with retry logic

**Check logs:**
```bash
sudo tail -f /var/log/network-watchdog.log
```

---

## 14. Optional: Automatic Screen Brightness Control

If your display supports brightness control via `/sys/class/backlight/11-0045/brightness` (range 0-31):

### Install Brightness Timers
```bash
sudo cp deploy/brightness-set@.service /etc/systemd/system/
sudo cp deploy/brightness-day.timer /etc/systemd/system/
sudo cp deploy/brightness-night.timer /etc/systemd/system/
sudo cp deploy/brightness-initial.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now brightness-day.timer
sudo systemctl enable --now brightness-night.timer
sudo systemctl enable brightness-initial.service
```

**Schedule:**
- **Day (07:30):** Brightness = 20
- **Night (22:00):** Brightness = 2
- **Boot:** Brightness = 2 (prevents blinding overnight reboots)

### Test Brightness Manually
```bash
# Set brightness to 15
echo 15 | sudo tee /sys/class/backlight/11-0045/brightness

# Or use the service
sudo systemctl start brightness-set@15.service
```

### Verify Timers
```bash
systemctl list-timers --all | grep brightness
```

---

## 15. Reboot and Verify

```bash
sudo reboot
```

After reboot:
1. The backend service should start automatically
2. Chromium should launch in kiosk mode showing the app
3. Brightness should be set appropriately

---

## 16. Future Updates

When you need to update the app after code changes:

### Quick Update (Single Command)
```bash
cd /opt/st-albans
./deploy/update-and-restart.sh
```

### Manual Update
```bash
cd /opt/st-albans
gh repo sync  # or: git pull
./deploy/build-release.sh
sudo systemctl restart st-albans
```

---

## 17. Useful Commands

### Service Management
```bash
# Restart backend
sudo systemctl restart st-albans

# Stop backend
sudo systemctl stop st-albans

# Backend logs
journalctl -u st-albans -f

# Quick restart with log tail
./deploy/restart-service.sh
```

### Kiosk Management
```bash
# Restart kiosk
systemctl --user restart chromium-kiosk.service

# Kiosk logs
journalctl --user -u chromium-kiosk.service -f

# Kill Chromium manually
pkill -f 'chromium.*--kiosk'
```

### Manual Testing
```bash
# Start backend manually (stop service first!)
sudo systemctl stop st-albans
cd /opt/st-albans/server
node dist/server.js

# Test API
curl http://localhost:3000/api/health
curl http://localhost:3000/api/bin-collection

# Check network listeners
ss -tulpn | grep 3000
```

### Brightness
```bash
# Check current brightness
cat /sys/class/backlight/11-0045/brightness

# Set brightness manually
echo 20 | sudo tee /sys/class/backlight/11-0045/brightness
```

### Network Watchdog
```bash
# Check status
sudo systemctl status network-watchdog.service

# View logs
sudo tail -f /var/log/network-watchdog.log

# Test by disconnecting
sudo ip link set wlan0 down
# Watch it reconnect
sudo ip link set wlan0 up
```

---

## 18. Troubleshooting

### Service Won't Start
```bash
# Check detailed logs
journalctl -u st-albans -b --no-pager | tail -50

# Check Node is found
which node

# Verify build exists
ls -la /opt/st-albans/server/dist/server.js
```

### 404 Errors on Assets
```bash
cd /opt/st-albans
./deploy/build-release.sh
sudo systemctl restart st-albans
```

### Chromium Not Auto-Starting
```bash
# Check if graphical session is running
echo $XDG_CURRENT_DESKTOP

# Check user service
systemctl --user status chromium-kiosk.service

# Check linger
loginctl show-user $USER | grep Linger
```

### Can't Access from Network
1. Ensure `HOST=0.0.0.0` in `/opt/st-albans/server/.env`
2. Check firewall (usually not an issue on fresh Pi OS)
3. Verify network connectivity: `ip addr show`

### Permission Issues
```bash
# Fix ownership
sudo chown -R $USER:$USER /opt/st-albans

# Fix script permissions
cd /opt/st-albans
chmod +x deploy/*.sh
```

---

- [ ] Brightness timers installed (optional)
- [ ] Network watchdog installed (optional but recommended)
- [ ] System rebooted and verified
- [ ] System updated
- [ ] Hostname set (optional)
- [ ] Required packages installed (curl, chromium, git, gh, fonts)
- [ ] Node.js v22 installed (via nvm or system)
- [ ] GitHub authenticated
- [ ] Repository cloned to `/opt/st-albans`
- [ ] App built (`./deploy/build-release.sh`)
- [ ] `.env` file created with UPRN
- [ ] App tested manually
- [ ] Systemd service installed and running
- [ ] Chromium kiosk service configured and running
- [ ] User linger enabled
- [ ] Brightness timers installed (optional)
- [ ] System rebooted and verified

---

## Environment File Reference

**Location:** `/opt/st-albans/server/.env`

```bash
# Required
- `/etc/systemd/system/st-albans.service` - Backend service
- `/etc/systemd/system/network-watchdog.service` - Network auto-reconnect (optional)
- `/usr/local/bin/network-watchdog.sh` - Network watchdog script (optional)
- `/etc/systemd/system/brightness-*.service` - Brightness services (optional)
- `/etc/systemd/system/brightness-*.timer` - Brightness timers (optional)
- `~/.config/systemd/user/chromium-kiosk.service` - Kiosk service
HOST=0.0.0.0

# Testing
# TEST_MODE=true
# TEST_MODE_VARIANT=tomorrow|weekend|empty|far
```

---

## Files Modified/Created During Setup

- `/etc/systemd/system/st-albans.service` - Backend service
- `/etc/systemd/system/brightness-*.service` - Brightness services (optional)
- `/etc/systemd/system/brightness-*.timer` - Brightness timers (optional)
- `~/.config/systemd/user/chromium-kiosk.service` - Kiosk service
- `~/bin/kiosk-wrapper.sh` - Smart kiosk launcher (optional)
- `/opt/st-albans/server/.env` - Environment configuration
- `/etc/hosts` - Hostname mapping (if changed)

---

**Last Updated:** October 12, 2025
