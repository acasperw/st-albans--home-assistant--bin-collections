import { randomUUID } from 'crypto';

export interface Timer {
  id: string;
  name: string;
  durationSecs: number;
  endsAt: string; // ISO 8601
  createdAt: string; // ISO 8601
}

const timers = new Map<string, Timer>();

/** Remove expired timers (ended more than 5 seconds ago to allow clients to see "done" state) */
function purgeExpired(): void {
  const cutoff = Date.now() - 5_000;
  for (const [id, timer] of timers) {
    if (new Date(timer.endsAt).getTime() < cutoff) {
      timers.delete(id);
    }
  }
}

export function getActiveTimers(): Timer[] {
  purgeExpired();
  return Array.from(timers.values())
    .sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime());
}

export function createTimer(name: string, durationSecs: number): Timer {
  const now = new Date();
  const timer: Timer = {
    id: randomUUID(),
    name,
    durationSecs,
    endsAt: new Date(now.getTime() + durationSecs * 1000).toISOString(),
    createdAt: now.toISOString(),
  };
  timers.set(timer.id, timer);
  return timer;
}

export function deleteTimer(id: string): boolean {
  return timers.delete(id);
}
