import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { NotificationService, NotificationData } from '../../services/notification.service';
import { TemperatureNotificationService } from '../../services/temperature-notification.service';
import { NotificationComponent } from '../notification/notification.component';

const CYCLE_INTERVAL_MS = 8_000;
const NOTIFICATION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

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
export class NotificationWrapperComponent implements OnInit {
  private generalNotificationService = inject(NotificationService);
  private temperatureNotificationService = inject(TemperatureNotificationService);
  private destroyRef = inject(DestroyRef);

  public isIdle = input<boolean>(false);

  private cycleIndex = signal(0);

  ngOnInit(): void {
    const timer = setInterval(() => {
      this.cycleIndex.update(i => i + 1);
    }, CYCLE_INTERVAL_MS);

    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  private allNotifications = computed(() => {
    // Read cycleIndex so staleness is re-evaluated each tick
    this.cycleIndex();

    const result: NotificationData[] = [];
    const tempNotification = this.temperatureNotificationService.notification();
    const generalNotification = this.generalNotificationService.notification();
    const now = Date.now();

    // Bin reminders first in cycle order
    if (generalNotification?.metadata && 'collectionDate' in generalNotification.metadata) {
      if (!this.isStale(generalNotification, now)) {
        result.push(generalNotification);
      }
    }

    // Temperature warnings (skip if stale)
    if (tempNotification && !this.isStale(tempNotification, now)) {
      result.push(tempNotification);
    }

    // Other general notifications (transient, no staleness check)
    if (generalNotification && !(generalNotification.metadata && 'collectionDate' in generalNotification.metadata)) {
      result.push(generalNotification);
    }

    return result;
  });

  protected activeNotification = computed(() => {
    const all = this.allNotifications();
    if (all.length === 0) return null;
    if (all.length === 1) return all[0];
    return all[this.cycleIndex() % all.length];
  });

  protected canDismiss = computed(() => {
    const activeNotif = this.activeNotification();
    if (!activeNotif) return false;

    // Temperature warnings cannot be dismissed when idle
    const tempNotification = this.temperatureNotificationService.notification();
    if (tempNotification && this.isIdle() && activeNotif === tempNotification) {
      return false;
    }

    return true;
  });

  protected handleDismiss(): void {
    const activeNotif = this.activeNotification();
    if (!activeNotif) return;

    const tempNotification = this.temperatureNotificationService.notification();

    // If dismissing a temperature notification
    if (activeNotif === tempNotification) {
      if (this.isIdle()) return;
      this.temperatureNotificationService.clearNotification();
      return;
    }

    // Dismiss the general notification (includes bin reminders)
    this.generalNotificationService.clearNotification();
  }

  private isStale(notification: NotificationData, now: number): boolean {
    return !!notification.createdAt && (now - notification.createdAt) > NOTIFICATION_MAX_AGE_MS;
  }
}
