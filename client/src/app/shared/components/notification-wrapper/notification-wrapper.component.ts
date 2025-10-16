import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NotificationService } from '../../services/notification.service';
import { TemperatureNotificationService } from '../../services/temperature-notification.service';
import { NotificationComponent } from '../notification/notification.component';

/**
 * Unified notification wrapper that handles prioritization between
 * general notifications and temperature warnings
 */
@Component({
  selector: 'app-notification-wrapper',
  imports: [NotificationComponent],
  template: `
    <app-notification 
      [notification]="activeNotification()"
      [active]="true"
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

  // Prioritize temperature notifications when idle
  protected activeNotification = computed(() => {
    const tempNotification = this.temperatureNotificationService.notification();
    const generalNotification = this.generalNotificationService.notification();
    
    // Temperature warnings take priority when in idle/screensaver mode
    return (tempNotification && this.isIdle()) ? tempNotification : generalNotification;
  });

  // Temperature notifications cannot be dismissed when idle (they're safety warnings)
  protected canDismiss = computed(() => {
    const tempNotification = this.temperatureNotificationService.notification();
    return !(tempNotification && this.isIdle());
  });

  protected handleDismiss(): void {
    // Only dismiss general notifications, not temperature warnings when idle
    if (!(this.temperatureNotificationService.notification() && this.isIdle())) {
      this.generalNotificationService.clearNotification();
    }
  }
}
