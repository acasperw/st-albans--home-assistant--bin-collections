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