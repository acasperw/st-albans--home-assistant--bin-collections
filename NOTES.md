# Get food information
https://world.openfoodfacts.org/api/v2/product/%7Bcode%7D.json

# Edit Hosts information

## Set a new hostname (replace 'newhostname' with your desired name)
sudo hostnamectl set-hostname newhostname

## Edit /etc/hosts to update the hostname there too
sudo nano /etc/hosts
# Change the line that says "127.0.1.1 raspberrypi" to "127.0.1.1 newhostname"

## Restart the avahi-daemon (for .local discovery)
sudo systemctl restart avahi-daemon

## Reboot for changes to take full effect
sudo reboot



# give yourself ownership of /opt (or a subdir)
sudo mkdir -p /opt
sudo chown -R "$USER":"$USER" /opt

# now clone without sudo
cd /opt
gh repo clone acasperw/st-albans--home-assistant--bin-collections st-albans


## SSH Key changed
Use ssh-keygen to remove it automatically
`ssh-keygen -R 192.168.68.85`

## Camera Exploration Notes (Retained)

Evaluating an alternative implementation path.

What we confirmed:
- RTSP source from Hikvision NVR is reachable with digest auth via ffmpeg.
- Internal RTSP URL pattern that worked: `rtsp://admin:<password>@192.168.xx.xx:554/Streaming/Channels/{channel}02`.
- Example channel URL that worked: `rtsp://admin:<password>@192.168.xx.xx:554/Streaming/Channels/102`.
- Browser HLS playback was unreliable due to codec/segment compatibility (sub-stream behavior was a key factor).
- Polling snapshots (single JPEG capture) was stable and worked with channel switching.
- Chunked MJPEG worked briefly, but rapid reconnects/frame capture caused Hikvision RTSP `SETUP` failures (`500 Internal Server Error`) under load.

Likely root cause from logs:
- Too many RTSP session setups in a short period, especially around channel changes.

Implications for next implementation:
- Prefer a persistent connection model (single long-lived ingest per viewed channel) over frequent open/close RTSP sessions.
- Keep graceful fallback behavior for channel changes and temporary camera/NVR errors.