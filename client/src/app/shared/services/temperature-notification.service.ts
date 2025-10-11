import { Injectable, signal, computed } from '@angular/core';

export type NotificationType = 'warning' | 'error' | null;

export interface TemperatureNotification {
  type: NotificationType;
  message: string;
  temperature: number;
}

/**
 * Service to manage temperature-based notifications for overnight warnings
 * Only shows the latest/most severe notification (no stacking)
 */
@Injectable({
  providedIn: 'root'
})
export class TemperatureNotificationService {

  private currentNotification = signal<TemperatureNotification | null>(null);
  // Track last dismissed notification (type + temperature)
  private suppressedNotification = signal<TemperatureNotification | null>(null);

  // Expose readonly computed for components
  public readonly notification = computed(() => this.currentNotification());
  public readonly hasNotification = computed(() => this.currentNotification() !== null);

  /**
   * Check overnight minimum temperature and set appropriate notification
   * @param overnightMinTemp The minimum temperature expected overnight in Celsius
   */
  public checkOvernightTemperature(overnightMinTemp: number): void {
    let notification: TemperatureNotification | null = null;
    if (overnightMinTemp <= 0) {
      notification = {
        type: 'error',
        message: 'Below 0°C: Cover outdoor taps, all plants',
        temperature: overnightMinTemp
      };
    } else if (overnightMinTemp < 4) {
      notification = {
        type: 'warning',
        message: 'Below 4°C: Protect tropical plants',
        temperature: overnightMinTemp
      };
    }

    // Suppression logic: only show if not suppressed
    const suppressed = this.suppressedNotification();
    if (
      notification &&
      suppressed &&
      notification.type === suppressed.type &&
      notification.temperature === suppressed.temperature
    ) {
      // Suppressed, do not show
      this.currentNotification.set(null);
      return;
    }
    this.currentNotification.set(notification);
  }

  /**
   * Clear the current notification (e.g., when clicked)
   * Suppress this notification until next weather fetch
   */
  public clearNotification(): void {
    const current = this.currentNotification();
    if (current) {
      this.suppressedNotification.set(current);
    }
    this.currentNotification.set(null);
  }

  /**
   * Manually set a notification (for testing purposes)
   */
  public setNotification(notification: TemperatureNotification | null): void {
    this.currentNotification.set(notification);
  }

  /**
   * Reset suppression (call after each weather fetch)
   */
  public resetSuppression(): void {
    this.suppressedNotification.set(null);
  }
}