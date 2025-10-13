import { Injectable, signal, inject, OnDestroy, InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface BarcodeListenerConfig {
  interKeyScanThreshold: number;
  maxScanDuration: number;
  minBarcodeLength: number;
  maxBarcodeLength: number;
  autoStart: boolean;
  enableDebugLogging: boolean;
}

export const DEFAULT_BARCODE_CONFIG: BarcodeListenerConfig = {
  interKeyScanThreshold: 40,
  maxScanDuration: 500,
  minBarcodeLength: 6,
  maxBarcodeLength: 18,
  autoStart: true,
  enableDebugLogging: !environment.production
};

export const BARCODE_LISTENER_CONFIG = new InjectionToken<BarcodeListenerConfig>(
  'BARCODE_LISTENER_CONFIG',
  {
    providedIn: 'root',
    factory: () => DEFAULT_BARCODE_CONFIG
  }
);


@Injectable({
  providedIn: 'root'
})
export class BarcodeListenerService implements OnDestroy {
  private readonly config = inject(BARCODE_LISTENER_CONFIG);

  private buffer: string[] = [];
  private times: number[] = [];
  private lastTime = 0;
  private isListening = false;

  public readonly lastScan = signal<string | null>(null);
  public readonly isScanning = signal(false);

  private keyListener = (e: KeyboardEvent): void => {
    const now = performance.now();

    if (e.key === 'Enter') {
      if (this.buffer.length >= this.config.minBarcodeLength && this.buffer.length <= this.config.maxBarcodeLength) {
        this.commitScan();
        e.preventDefault();
        e.stopPropagation();
      } else {
        this.resetBuffer();
      }
      return;
    }

    // Ignore non-printable keys and modifier combinations
    if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) {
      return;
    }

    // Only accept alphanumeric characters for barcodes
    if (!/^[0-9A-Za-z]$/.test(e.key)) {
      return;
    }

    // Check if this continues an existing scan or starts a new one
    const timeSinceLastKey = this.lastTime ? (now - this.lastTime) : 0;

    if (timeSinceLastKey > this.config.interKeyScanThreshold) {
      // Gap too large or first keystroke - start new scan
      this.resetBuffer();
      this.buffer.push(e.key);
      this.times.push(now);
      this.isScanning.set(true);
    } else {
      // Continue existing scan
      this.buffer.push(e.key);
      this.times.push(now);
    }

    this.lastTime = now;

    // Check for automatic termination (scanner without Enter)
    const scanDuration = this.times.length > 1 ? (now - this.times[0]) : 0;

    if (scanDuration > this.config.maxScanDuration) {
      if (this.buffer.length >= this.config.minBarcodeLength && this.buffer.length <= this.config.maxBarcodeLength) {
        this.commitScan();
      } else {
        this.resetBuffer();
      }
    }

    // Prevent buffer overflow
    if (this.buffer.length > this.config.maxBarcodeLength) {
      this.resetBuffer();
    }
  };

  constructor() {
    this.log('BarcodeListenerService initialized');
    if (this.config.autoStart) {
      this.startListening();
    }
  }

  /**
   * Cleanup when service is destroyed
   */
  ngOnDestroy(): void {
    this.stopListening();
  }

  /**
   * Start listening for barcode scans
   * Safe to call multiple times - will only add listener once
   */
  startListening(): void {
    if (this.isListening) {
      this.log('Already listening, skipping startListening');
      return;
    }

    this.log('Starting to listen for keydown events');
    document.addEventListener('keydown', this.keyListener, { capture: true });
    this.isListening = true;
  }

  /**
   * Stop listening for barcode scans
   * Safe to call multiple times
   */
  stopListening(): void {
    if (!this.isListening) {
      return;
    }

    document.removeEventListener('keydown', this.keyListener, { capture: true });
    this.resetBuffer();
    this.isListening = false;
    this.log('Stopped listening for barcode scans');
  }

  /**
   * Commit the current buffer as a valid scan
   */
  private commitScan(): void {
    const code = this.buffer.join('');
    this.lastScan.set(code);
    this.resetBuffer();
    this.log('Barcode scanned:', code);
  }

  /**
   * Reset the scan buffer
   */
  private resetBuffer(): void {
    this.buffer = [];
    this.times = [];
    this.lastTime = 0;
    this.isScanning.set(false);
  }

  /**
   * Get the current scan progress
   * Useful for debugging or displaying scan progress in UI
   */
  getCurrentBuffer(): string {
    return this.buffer.join('');
  }

  /**
   * Internal logging method that respects debug configuration
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.config.enableDebugLogging) {
      console.log(`[BarcodeListener] ${message}`, ...args);
    }
  }

  /**
   * Validate EAN-13 barcode checksum
   * @param code - The barcode string to validate (must be exactly 13 digits)
   * @returns true if the checksum is valid, false otherwise
   */
  static isValidEAN13(code: string): boolean {
    if (!/^[0-9]{13}$/.test(code)) {
      return false;
    }

    const digits = code.split('').map(Number);
    const checkDigit = digits.pop()!;

    const sum = digits.reduce((acc, digit, index) => {
      const multiplier = index % 2 === 0 ? 1 : 3;
      return acc + (digit * multiplier);
    }, 0);

    const calculatedCheck = (10 - (sum % 10)) % 10;
    return calculatedCheck === checkDigit;
  }

  /**
   * Validate UPC-A barcode checksum
   * @param code - The barcode string to validate (must be exactly 12 digits)
   * @returns true if the checksum is valid, false otherwise
   */
  static isValidUPCA(code: string): boolean {
    if (!/^[0-9]{12}$/.test(code)) {
      return false;
    }

    const digits = code.split('').map(Number);
    const checkDigit = digits.pop()!;

    const sum = digits.reduce((acc, digit, index) => {
      const multiplier = index % 2 === 0 ? 3 : 1;
      return acc + (digit * multiplier);
    }, 0);

    const calculatedCheck = (10 - (sum % 10)) % 10;
    return calculatedCheck === checkDigit;
  }

  /**
   * Validate common barcode formats (EAN-13, UPC-A, or length-based)
   * @param code - The barcode string to validate
   * @returns true if the barcode passes validation for any recognized format
   */
  static isValidBarcode(code: string): boolean {
    if (!code || typeof code !== 'string') {
      return false;
    }

    // Remove any non-numeric characters
    const numericCode = code.replace(/[^0-9]/g, '');

    if (numericCode.length === 13) {
      return BarcodeListenerService.isValidEAN13(numericCode);
    }

    if (numericCode.length === 12) {
      return BarcodeListenerService.isValidUPCA(numericCode);
    }

    // For other formats, just check length
    return numericCode.length >= 6 && numericCode.length <= 18;
  }
}

