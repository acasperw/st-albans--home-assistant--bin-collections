#!/bin/bash
# Network Watchdog Script
# Monitors internet connectivity and attempts to restore connection

PING_HOST="8.8.8.8"
CHECK_INTERVAL=30
RESTART_DELAY=5
LOG_FILE="/var/log/network-watchdog.log"

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_connectivity() {
    ping -c 1 -W 3 "$PING_HOST" > /dev/null 2>&1
    return $?
}

attempt_reconnect() {
    log_message "Internet connectivity lost. Attempting to reconnect..."
    
    # Try restarting networking service
    log_message "Restarting networking service..."
    systemctl restart networking
    sleep "$RESTART_DELAY"
    
    if check_connectivity; then
        log_message "✓ Connectivity restored after networking restart"
        return 0
    fi
    
    # Try restarting NetworkManager if it exists
    if systemctl is-active --quiet NetworkManager; then
        log_message "Restarting NetworkManager..."
        systemctl restart NetworkManager
        sleep "$RESTART_DELAY"
        
        if check_connectivity; then
            log_message "✓ Connectivity restored after NetworkManager restart"
            return 0
        fi
    fi
    
    # Try restarting dhcpcd if it exists
    if systemctl is-active --quiet dhcpcd; then
        log_message "Restarting dhcpcd..."
        systemctl restart dhcpcd
        sleep "$RESTART_DELAY"
        
        if check_connectivity; then
            log_message "✓ Connectivity restored after dhcpcd restart"
            return 0
        fi
    fi
    
    # Try bringing interface down and up
    log_message "Cycling network interfaces..."
    INTERFACES=$(ip -o link show | awk -F': ' '{print $2}' | grep -v '^lo$')
    for iface in $INTERFACES; do
        if [[ $iface == wlan* ]] || [[ $iface == eth* ]]; then
            log_message "Cycling interface $iface..."
            ip link set "$iface" down
            sleep 2
            ip link set "$iface" up
            sleep "$RESTART_DELAY"
            
            if check_connectivity; then
                log_message "✓ Connectivity restored after cycling $iface"
                return 0
            fi
        fi
    done
    
    log_message "✗ Failed to restore connectivity"
    return 1
}

log_message "Network watchdog started"

while true; do
    if ! check_connectivity; then
        attempt_reconnect
    fi
    sleep "$CHECK_INTERVAL"
done
