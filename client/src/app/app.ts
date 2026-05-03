import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { IdleService } from './shared/services/idle.service';
import { Clock } from './clock/clock';
import { BarcodeListenerService } from './shared/services/barcode-listener.service';
import { NotificationCenter } from './shared/services/notification-center.service';
import { BinCollectionNotificationService } from './shared/services/bin-collection-notification.service';
import { NotificationWrapperComponent } from './shared/components/notification-wrapper/notification-wrapper.component';
import { TimerService } from './shared/services/timer.service';
import { CookingPlanService } from './shared/services/cooking-plan.service';

const IS_PHONE = /Android|iPhone|iPod|Windows Phone|IEMobile|Mobile/i.test(navigator?.userAgent ?? '');

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Clock, NotificationWrapperComponent],
  template: `
    <router-outlet />
    <app-clock [active]="idle.isIdle()" />
    <app-notification-wrapper [isIdle]="idle.isIdle()" />
    @if (!idle.isIdle()) {
      <button class="timer-fab" (click)="openTimers()" aria-label="Timers">
        @if (hasActiveExtras()) {
          <span class="fab-dot"></span>
        }
        ⏲
      </button>
    }
  `,
  styles: [`
    .timer-fab {
      position: fixed;
      // Keep clear of touchscreen edge dead-zones (Pi LCD bezel/digitizer overscan)
      bottom: 24px;
      right: 24px;
      // Sit above the bin-collection notification (z-index 10001) so it's always tappable
      z-index: 10050;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.7);
      font-size: 2rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      // Prevent 300ms tap delay and double-tap zoom on touch devices
      touch-action: manipulation;
      -webkit-tap-highlight-color: rgba(255,255,255,0.2);
      // backdrop-filter intentionally omitted: causes hit-test/repaint quirks on Pi Chromium
      transition: opacity 0.3s ease, background 0.3s ease;

      &:active {
        background: rgba(255,255,255,0.25);
      }
    }

    .fab-dot {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #f7c948;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {

  protected idle = inject(IdleService);
  private router = inject(Router);
  private barcodeService = inject(BarcodeListenerService);
  private notificationCenter = inject(NotificationCenter);
  private binNotificationService = inject(BinCollectionNotificationService);
  private timerService = inject(TimerService);
  private cookingPlanService = inject(CookingPlanService);

  private currentUrl = signal('/');

  protected hasActiveExtras = () =>
    this.timerService.hasActiveTimers() || this.cookingPlanService.nextAction() !== null;

  constructor() {
    // Start monitoring for bin collection reminders
    this.binNotificationService.startMonitoring();

    // Track route changes to show/hide cursor
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentUrl.set(event.urlAfterRedirects);
      const isMealsRoute = event.urlAfterRedirects.startsWith('/meals');
      document.body.classList.toggle('meals-route', isMealsRoute);
    });

    // Navigate back to home when idle kicks in (Pi only)
    effect(() => {
      if (this.idle.isIdle() && !IS_PHONE && this.currentUrl() !== '/') {
        this.router.navigateByUrl('/');
      }
    });

    // React to barcode scans globally
    effect(() => {
      const scannedCode = this.barcodeService.lastScan();
      if (scannedCode) {
        this.handleBarcodeScanned(scannedCode);
      }
    });
  }

  protected openTimers(): void {
    this.router.navigateByUrl('/timers');
  }

  private handleBarcodeScanned(barcode: string): void {
    // A new scan is fresh user activity — allow previously-dismissed
    // notifications to re-publish.
    this.notificationCenter.resetDismissals();

    /* Temp */
    if (BarcodeListenerService.isValidBarcode(barcode)) {
      this.notificationCenter.publish({
        id: 'barcode:scanned',
        category: 'barcode',
        type: 'success',
        title: 'Barcode Scanned',
        message: `Scanned barcode: ${barcode}`,
        icon: '𝄃𝄃𝄂𝄂𝄀𝄁𝄃𝄂𝄂𝄃',
        createdAt: Date.now(),
        maxAgeMs: 10_000,
      });
    } else {
      this.notificationCenter.publish({
        id: 'barcode:invalid',
        category: 'barcode',
        type: 'error',
        title: 'Invalid Barcode',
        message: `Scanned barcode is invalid: ${barcode}`,
        icon: '𝄃𝄃𝄂𝄂𝄀𝄁𝄃𝄂𝄂𝄃',
        createdAt: Date.now(),
        maxAgeMs: 10_000,
      });
    }
  }
}
