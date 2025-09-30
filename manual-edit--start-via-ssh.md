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