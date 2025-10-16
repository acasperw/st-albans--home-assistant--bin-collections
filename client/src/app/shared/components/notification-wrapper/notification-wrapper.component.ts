import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NotificationService } from '../../services/notification.service';
import { TemperatureNotificationService } from '../../services/temperature-notification.service';
import { NotificationComponent } from '../notification/notification.component';

/**
 * Unified notification wrapper that handles prioritization between
 * temperature warnings, bin collection reminders, and general notifications
 * 
 * Priority order:
 * 1. Temperature warnings (when idle) - safety critical
 * 2. Bin collection reminders - important daily task
 * 3. General notifications (barcodes, errors, etc.)
 */
@Component({
  selector: 'app-notification-wrapper',
  imports: [NotificationComponent],
  template: `
    <app-notification 
      [notification]="activeNotification()"
      [active]="this.isIdle()"
      [allowDismiss]="canDismiss()"
      (dismiss)="handleDismiss()" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationWrapperComponent {
  private generalNotificationService = inject(NotificationService);
  private temperatureNotificationService = inject(TemperatureNotificationService);

  // Allow parent to control when we're in idle/screensaver mode
  public isIdle = input<boolean>(false);

  // Prioritize notifications based on importance
  protected activeNotification = computed(() => {
    const tempNotification = this.temperatureNotificationService.notification();
    const generalNotification = this.generalNotificationService.notification();
    
    // 1. Temperature warnings take highest priority when idle (safety)
    if (tempNotification && this.isIdle()) {
      return tempNotification;
    }

    // 2. Check if general notification is a bin reminder (has collectionDate metadata)
    if (generalNotification?.metadata && 'collectionDate' in generalNotification.metadata) {
      return generalNotification; // Bin reminders have medium priority
    }

    // 3. Temperature notifications shown when not idle (lower priority)
    if (tempNotification) {
      return tempNotification;
    }

    // 4. Other general notifications (lowest priority)
    return generalNotification;
  });

  // Determine if notification can be dismissed
  protected canDismiss = computed(() => {
    const tempNotification = this.temperatureNotificationService.notification();
    const activeNotif = this.activeNotification();

    // Temperature warnings cannot be dismissed when idle
    if (tempNotification && this.isIdle() && activeNotif === tempNotification) {
      return false;
    }

    // Bin reminders can be dismissed
    if (activeNotif?.metadata && 'collectionDate' in activeNotif.metadata) {
      return true;
    }

    // All other notifications can be dismissed
    return true;
  });

  protected handleDismiss(): void {
    const tempNotification = this.temperatureNotificationService.notification();
    
    // Don't allow dismissing temperature warnings when idle
    if (tempNotification && this.isIdle()) {
      return;
    }

    // Dismiss the general notification (includes bin reminders)
    this.generalNotificationService.clearNotification();
  }
}
