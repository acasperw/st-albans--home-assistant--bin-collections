import { Injectable, NgZone, effect, inject } from '@angular/core';
import { IdleService } from './idle.service';

export interface PollOptions {
  /** How often to invoke `fn` (ms). */
  intervalMs: number;
  /** Function to run on each tick. */
  fn: () => void;
  /** Call `fn` immediately when registered (default: true). */
  runImmediately?: boolean;
  /** Pause polling while the user is idle (default: true). When activity resumes, `fn` is called once immediately so data is fresh. */
  pauseWhenIdle?: boolean;
}

export interface PollHandle {
  /** Stop polling and remove from manager. */
  stop(): void;
  /** Manually trigger `fn` now (does not reset the interval). */
  runNow(): void;
}

interface RegisteredPoll {
  options: Required<PollOptions>;
  handle: ReturnType<typeof setInterval> | null;
}

/**
 * Centralised, idle-aware polling.
 *
 * Replaces ad-hoc `setInterval` / `interval()` blocks scattered across services
 * and components. Polls auto-pause when the user is idle, reducing CPU /
 * network usage on the kitchen Pi, then refresh once when activity resumes.
 */
@Injectable({ providedIn: 'root' })
export class PollManager {
  private idle = inject(IdleService);
  private zone = inject(NgZone);
  private polls = new Set<RegisteredPoll>();

  constructor() {
    // React to idle state changes: pause/resume eligible polls.
    effect(() => {
      const isIdle = this.idle.isIdle();
      for (const poll of this.polls) {
        if (!poll.options.pauseWhenIdle) continue;
        if (isIdle) {
          this.stopInterval(poll);
        } else {
          this.startInterval(poll);
          // Fire once immediately on resume so the UI catches up.
          this.invoke(poll);
        }
      }
    });
  }

  register(options: PollOptions): PollHandle {
    const poll: RegisteredPoll = {
      options: {
        runImmediately: true,
        pauseWhenIdle: true,
        ...options,
      },
      handle: null,
    };
    this.polls.add(poll);

    if (poll.options.runImmediately) {
      this.invoke(poll);
    }

    // Don't start the interval if we're currently idle and pauseWhenIdle is on.
    if (!(poll.options.pauseWhenIdle && this.idle.isIdle())) {
      this.startInterval(poll);
    }

    return {
      stop: () => {
        this.stopInterval(poll);
        this.polls.delete(poll);
      },
      runNow: () => this.invoke(poll),
    };
  }

  private startInterval(poll: RegisteredPoll): void {
    if (poll.handle !== null) return;
    this.zone.runOutsideAngular(() => {
      poll.handle = setInterval(() => this.invoke(poll), poll.options.intervalMs);
    });
  }

  private stopInterval(poll: RegisteredPoll): void {
    if (poll.handle === null) return;
    clearInterval(poll.handle);
    poll.handle = null;
  }

  private invoke(poll: RegisteredPoll): void {
    // Run inside the zone so Angular picks up state changes consistently.
    this.zone.run(() => {
      try {
        poll.options.fn();
      } catch (err) {
        console.error('[PollManager] poll callback threw:', err);
      }
    });
  }
}
