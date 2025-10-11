import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TemperatureNotificationService } from '../../services/temperature-notification.service';
import { NotificationComponent } from '../notification/notification.component';

@Component({
  selector: 'app-temperature-notification',
  imports: [NotificationComponent],
  template: `
    <app-notification
      [notification]="notificationService.notification()"
      [active]="active()"
      [allowDismiss]="allowDismiss()"
      (dismiss)="dismissNotification()">
    </app-notification>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemperatureNotificationComponent {
  protected notificationService = inject(TemperatureNotificationService);
  
  // Show when active (can be controlled by parent - e.g., idle mode, specific routes, etc.)
  public active = input<boolean>(true); // Default to true for more flexibility
  
  // Allow parent to control whether dismiss functionality is enabled
  public allowDismiss = input<boolean>(false); // Hidden by default as requested

  public dismissNotification(): void {
    this.notificationService.clearNotification();
  }
}