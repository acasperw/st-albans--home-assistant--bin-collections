import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IdleService } from './shared/services/idle.service';
import { Clock } from './clock/clock';
import { TemperatureNotificationComponent } from './shared/components/temperature-notification/temperature-notification.component';
import { BarcodeListenerService } from './shared/services/barcode-listener.service';
import { NotificationService } from './shared/services/notification.service';
import { NotificationComponent } from './shared/components/notification/notification.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Clock, TemperatureNotificationComponent, NotificationComponent],
  template: `
    <router-outlet />
    <app-clock [active]="idle.isIdle()" />
    <app-temperature-notification [active]="idle.isIdle()" />
    <app-notification 
      [notification]="notificationService.notification()"
      [allowDismiss]="true"
      (dismiss)="notificationService.clearNotification()" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {

  protected idle = inject(IdleService);
  private barcodeService = inject(BarcodeListenerService);
  protected notificationService = inject(NotificationService);

  constructor() {
    // React to barcode scans globally
    effect(() => {
      const scannedCode = this.barcodeService.lastScan();
      if (scannedCode) {
        this.handleBarcodeScanned(scannedCode);
      }
    });
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
