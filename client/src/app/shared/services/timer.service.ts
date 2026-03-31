import { Injectable, inject, signal, DestroyRef, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Timer {
  id: string;
  name: string;
  durationSecs: number;
  endsAt: string;
  createdAt: string;
}

export interface TimersResponse {
  timers: Timer[];
}

const POLL_INTERVAL_MS = 2_000;

@Injectable({ providedIn: 'root' })
export class TimerService {
  private http = inject(HttpClient);
  private zone = inject(NgZone);
  private destroyRef = inject(DestroyRef);
  private baseUrl = `${environment.apiBaseUrl}/api/timers`;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  /** Current active timers from the server */
  public timers = signal<Timer[]>([]);

  /** Whether there are any active (not yet expired) timers */
  public hasActiveTimers = signal(false);

  constructor() {
    this.poll();
    this.zone.runOutsideAngular(() => {
      this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    });
    this.destroyRef.onDestroy(() => {
      if (this.pollTimer !== null) clearInterval(this.pollTimer);
    });
  }

  private poll(): void {
    this.http.get<TimersResponse>(this.baseUrl).subscribe({
      next: (res) => {
        const now = Date.now();
        const active = res.timers.filter(t => new Date(t.endsAt).getTime() > now);
        this.zone.run(() => {
          this.timers.set(res.timers);
          this.hasActiveTimers.set(active.length > 0);
        });
      },
    });
  }

  create(name: string, durationSecs: number): Observable<Timer> {
    return this.http.post<Timer>(this.baseUrl, { name, durationSecs });
  }

  cancel(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/${id}`);
  }
}
