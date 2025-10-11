import { Injectable, signal, computed } from '@angular/core';

export type NotificationType = 'info' | 'warning' | 'error' | 'success' | null;

export interface NotificationData {
  type: NotificationType;
  title: string;
  message: string;
  icon?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Generic notification service that can be extended for specific notification types
 * Manages a single notification at a time (no stacking)
 */
@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  private currentNotification = signal<NotificationData | null>(null);
  // Track last dismissed notification to prevent re-showing until conditions change
  private suppressedNotification = signal<NotificationData | null>(null);

  // Expose readonly computed for components
  public readonly notification = computed(() => this.currentNotification());
  public readonly hasNotification = computed(() => this.currentNotification() !== null);

  /**
   * Set a notification if it's not currently suppressed
   * @param notification The notification to show
   */
  public setNotification(notification: NotificationData | null): void {
    if (!notification) {
      this.currentNotification.set(null);
      return;
    }

    // Check if this notification is suppressed
    const suppressed = this.suppressedNotification();
    if (this.isNotificationSuppressed(notification, suppressed)) {
      this.currentNotification.set(null);
      return;
    }

    this.currentNotification.set(notification);
  }

  /**
   * Clear the current notification and mark it as suppressed
   */
  public clearNotification(): void {
    const current = this.currentNotification();
    if (current) {
      this.suppressedNotification.set(current);
    }
    this.currentNotification.set(null);
  }

  /**
   * Reset suppression (call when conditions change that might warrant re-showing)
   */
  public resetSuppression(): void {
    this.suppressedNotification.set(null);
  }

  /**
   * Determine if a notification should be suppressed
   * Override this method in subclasses for custom suppression logic
   */
  protected isNotificationSuppressed(
    notification: NotificationData, 
    suppressed: NotificationData | null
  ): boolean {
    if (!suppressed) return false;
    
    // Default: suppress if type and message are the same
    return notification.type === suppressed.type && 
           notification.message === suppressed.message;
  }
}