import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BarcodeListenerService {
  private buffer: string[] = [];
  private times: number[] = [];
  private lastTime = 0;

  // Configurable thresholds
  private readonly interKeyScanThreshold = 40;  // ms between keystrokes for scan
  private readonly maxScanDuration = 500;       // ms total scan duration
  private readonly minBarcodeLength = 6;        // minimum characters for valid barcode
  private readonly maxBarcodeLength = 18;       // maximum characters for valid barcode

  // Signals
  public lastScan = signal<string | null>(null);
  public isScanning = signal(false);

  private keyListener = (e: KeyboardEvent) => {
    const now = performance.now();

    console.log(`Key: ${e.key}, Time: ${now}, Buffer: ${this.getCurrentBuffer()}`);

    // Handle Enter key (scan termination)
    if (e.key === 'Enter') {
      if (this.buffer.length >= this.minBarcodeLength && this.buffer.length <= this.maxBarcodeLength) {
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
    
    if (timeSinceLastKey > this.interKeyScanThreshold) {
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
    
    if (scanDuration > this.maxScanDuration) {
      if (this.buffer.length >= this.minBarcodeLength && this.buffer.length <= this.maxBarcodeLength) {
        this.commitScan();
      } else {
        this.resetBuffer();
      }
    }

    // Prevent buffer overflow
    if (this.buffer.length > this.maxBarcodeLength) {
      this.resetBuffer();
    }
  };

  constructor() {
    this.startListening();
  }

  /**
   * Start listening for barcode scans
   */
  startListening(): void {
    document.addEventListener('keydown', this.keyListener, { capture: true });
  }

  /**
   * Stop listening for barcode scans
   */
  stopListening(): void {
    document.removeEventListener('keydown', this.keyListener, { capture: true });
    this.resetBuffer();
  }

  /**
   * Commit the current buffer as a valid scan
   */
  private commitScan(): void {
    const code = this.buffer.join('');
    this.lastScan.set(code);
    this.resetBuffer();
    console.log('Barcode scanned:', code);
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
   * Get the current scan progress (for debugging)
   */
  getCurrentBuffer(): string {
    return this.buffer.join('');
  }

  /**
   * Validate EAN-13 checksum
   */
  static isValidEAN13(code: string): boolean {
    if (!/^[0-9]{13}$/.test(code)) return false;
    
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
   * Validate UPC-A checksum
   */
  static isValidUPCA(code: string): boolean {
    if (!/^[0-9]{12}$/.test(code)) return false;
    
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
   * Validate common barcode formats
   */
  static isValidBarcode(code: string): boolean {
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