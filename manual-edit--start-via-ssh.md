# Manual start
```
cd /opt/st-albans/server && npm run start
```
Second terminal
```
chromium-browser --noerrdialogs --disable-session-crashed-bubble --disable-infobars --kiosk http://localhost:3000
```

# Stop Chrome
```
pkill -f 'chromium.*--kiosk'
```

# Add emojis
```
sudo apt install -y fonts-noto-color-emoji
sudo fc-cache -f -v
```