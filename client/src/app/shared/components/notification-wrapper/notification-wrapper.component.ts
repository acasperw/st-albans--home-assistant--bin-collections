import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { NotificationCenter } from '../../services/notification-center.service';
import { NotificationComponent } from '../notification/notification.component';

const CYCLE_INTERVAL_MS = 8_000;

/**
 * Renders the active notification from the {@link NotificationCenter}.
 *
 * If the centre has multiple active notifications, this component cycles
 * through them at a fixed interval. Per-notification flags
 * (`dismissible` / `dismissibleWhenIdle`) control whether the user can
 * tap to dismiss; idle state is provided by the parent.
 */
@Component({
  selector: 'app-notification-wrapper',
  imports: [NotificationComponent],
  template: `
    <app-notification
      [notification]="active()"
      [active]="this.isIdle()"
      [allowDismiss]="canDismiss()"
      (dismiss)="onDismiss()" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationWrapperComponent implements OnInit {
  private center = inject(NotificationCenter);
  private destroyRef = inject(DestroyRef);

  public isIdle = input<boolean>(false);

  private cycleIndex = signal(0);

  ngOnInit(): void {
    const timer = setInterval(() => this.cycleIndex.update(i => i + 1), CYCLE_INTERVAL_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  protected active = computed(() => {
    const list = this.center.active();
    if (list.length === 0) return null;
    return list[this.cycleIndex() % list.length] ?? null;
  });

  protected canDismiss = computed(() => {
    const n = this.active();
    if (!n) return false;
    if (this.isIdle()) {
      return n.dismissibleWhenIdle ?? true;
    }
    return n.dismissible ?? true;
  });

  protected onDismiss(): void {
    const n = this.active();
    if (n) this.center.dismiss(n.id);
  }
}
