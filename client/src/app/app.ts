import { Component, inject, effect } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { IdleService } from './shared/services/idle.service';
import { BarcodeListenerService } from './shared/services/barcode-listener.service';
import { Clock } from './clock/clock';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Clock],
  template: `
    <router-outlet />
    <app-clock [active]="idle.isIdle()" />
  `
})
export class App {

  protected idle = inject(IdleService);
  private router = inject(Router);
  
  // Initialize barcode listener at app level so it's always listening
  private barcodeListener = inject(BarcodeListenerService);
  
  constructor() {
    console.log('App initialized - Barcode listener is active');
    
    // Global barcode handler - automatically navigate to food inventory when barcode scanned
    effect(() => {
      const scannedCode = this.barcodeListener.lastScan();
      if (scannedCode) {
        console.log('🔔 App detected barcode scan:', scannedCode);
        
        // If not already on food inventory page, navigate there
        if (!this.router.url.includes('/food')) {
          console.log('📍 Navigating to food inventory page...');
          this.router.navigate(['/food']);
        }
        // The FoodInventoryComponent will handle the actual processing
      }
    });
  }
}
