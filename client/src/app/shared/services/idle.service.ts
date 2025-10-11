import { Injectable, NgZone, inject, signal } from '@angular/core';

/**
 * Service to detect user inactivity and expose an `isIdle` signal.
 * Default timeout: 2 minutes (configurable via setter if needed later).
 */
@Injectable({
  providedIn: 'root'
})
export class IdleService {

  private timeoutMs = 2 * 60 * 1000; // 2 minutes
  private lastActive = Date.now();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly zone = inject(NgZone);

  public readonly isIdle = signal(false);

  constructor() {
    this.zone.runOutsideAngular(() => {
      const reset = () => this.onActivity();
      const events: (keyof WindowEventMap)[] = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'];
      events.forEach(evt => window.addEventListener(evt, reset, { passive: true }));
    });
    this.arm();
  }

  /** Adjust idle timeout dynamically if required */
  public setTimeoutMs(ms: number) {
    this.timeoutMs = ms;
    this.onActivity(); // restart with new duration
  }

  private onActivity() {
    this.lastActive = Date.now();
    if (this.isIdle()) {
      this.zone.run(() => this.isIdle.set(false));
    }
    this.arm();
  }

  private arm() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.evaluate(), this.timeoutMs);
  }

  private evaluate() {
    const inactiveFor = Date.now() - this.lastActive;
    if (inactiveFor >= this.timeoutMs) {
      if (!this.isIdle()) {
        this.zone.run(() => this.isIdle.set(true));
      }
    } else {
      // If somehow timer fired early, re-arm for remaining time
      const remaining = this.timeoutMs - inactiveFor;
      this.timer = setTimeout(() => this.evaluate(), remaining);
    }
  }
}
