# Manual start
```
cd /opt/st-albans/server && npm run start
```
Second terminal
```
chromium --noerrdialogs --disable-session-crashed-bubble --disable-infobars --kiosk http://localhost:3000
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

## Change Brightness 0 - 31
```
echo 15 | sudo tee /sys/class/backlight/11-0045/brightness
```