import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { IdleService } from './shared/services/idle.service';
import { Clock } from './clock/clock';
import { BarcodeListenerService } from './shared/services/barcode-listener.service';
import { NotificationService } from './shared/services/notification.service';
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
      <button class="camera-fab" (click)="openCamera()" aria-label="Camera">
        📹
      </button>
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
      bottom: 12px;
      right: 12px;
      z-index: 900;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.15);
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.5);
      font-size: 1.4rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
      transition: opacity 0.3s ease, background 0.3s ease;

      &:active {
        background: rgba(255,255,255,0.2);
      }
    }

    .camera-fab {
      position: fixed;
      bottom: 12px;
      right: 72px;
      z-index: 900;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.15);
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.5);
      font-size: 1.4rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
      transition: opacity 0.3s ease, background 0.3s ease;

      &:active {
        background: rgba(255,255,255,0.2);
      }
    }

    .fab-dot {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 8px;
      height: 8px;
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
  private notificationService = inject(NotificationService);
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

  protected openCamera(): void {
    this.router.navigateByUrl('/camera');
  }

  private handleBarcodeScanned(barcode: string): void {
    // Reset suppression on new scan to allow showing notifications again
    this.notificationService.resetSuppression();

    /* Temp */
    if (BarcodeListenerService.isValidBarcode(barcode)) {
      this.notificationService.setNotification({
        type: 'success',
        title: 'Barcode Scanned',
        message: `Scanned barcode: ${barcode}`,
        icon: '𝄃𝄃𝄂𝄂𝄀𝄁𝄃𝄂𝄂𝄃'
      });
    } else {
      this.notificationService.setNotification({
        type: 'error',
        title: 'Invalid Barcode',
        message: `Scanned barcode is invalid: ${barcode}`,
        icon: '𝄃𝄃𝄂𝄂𝄀𝄁𝄃𝄂𝄂𝄃'
      });
    }
  }
}
