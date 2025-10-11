import { Injectable } from '@angular/core';
import { NotificationService, NotificationData, NotificationType } from './notification.service';

export interface TemperatureNotification extends NotificationData {
  temperature: number;
}

/**
 * Service to manage temperature-based notifications for overnight warnings
 * Extends the generic NotificationService for temperature-specific logic
 */
@Injectable({
  providedIn: 'root'
})
export class TemperatureNotificationService extends NotificationService {

  /**
   * Check overnight minimum temperature and set appropriate notification
   * @param overnightMinTemp The minimum temperature expected overnight in Celsius
   */
  public checkOvernightTemperature(overnightMinTemp: number): void {
    let notification: TemperatureNotification | null = null;
    
    if (overnightMinTemp <= 0) {
      notification = {
        type: 'error',
        title: `${overnightMinTemp}°C tonight`,
        message: 'Cover outdoor taps, & all vulnerable plants',
        icon: '🥶',
        temperature: overnightMinTemp,
        metadata: { temperatureThreshold: 0, severity: 'high' }
      };
    } else if (overnightMinTemp < 4) {
      notification = {
        type: 'warning',
        title: `${overnightMinTemp}°C tonight`,
        message: 'Protect Mediterranean plants',
        icon: '⚠️',
        temperature: overnightMinTemp,
        metadata: { temperatureThreshold: 4, severity: 'medium' }
      };
    }

    this.setNotification(notification);
  }

  /**
   * Override suppression logic to consider temperature value
   */
  protected override isNotificationSuppressed(
    notification: NotificationData, 
    suppressed: NotificationData | null
  ): boolean {
    if (!suppressed) return false;
    
    // For temperature notifications, also check temperature value
    const tempNotification = notification as TemperatureNotification;
    const tempSuppressed = suppressed as TemperatureNotification;
    
    return notification.type === suppressed.type &&
           notification.message === suppressed.message &&
           tempNotification.temperature === tempSuppressed.temperature;
  }
}