import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

export interface TrainLeg {
  serviceId: string;
  origin: string;
  destination: string;
  aimedDeparture: string;
  aimedArrival: string;
  expectedDeparture?: string;
  expectedArrival?: string;
  platform?: string;
  status: 'ON_TIME' | 'DELAYED' | 'CANCELLED' | 'UNKNOWN';
}

export interface NextTrainResponse {
  generatedAt: string;
  from: string;
  to: string;
  next: TrainLeg | null;
  following?: TrainLeg[];
  source: 'live' | 'cache' | 'mock' | 'stale';
  staleSeconds?: number;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class NextTrainService {
  private http = inject(HttpClient);

  public loading = signal(false);
  public data = signal<NextTrainResponse | null>(null);
  public error = signal<string | null>(null);

  fetch(from: string = 'SAA', to: string = 'HWW') {
    this.loading.set(true);
    this.error.set(null);
    const url = `${environment.apiBaseUrl}/api/train/next?from=${from}&to=${to}`;
    this.http.get<NextTrainResponse>(url).subscribe({
      next: resp => {
        this.data.set(resp);
        this.loading.set(false);
      },
      error: err => {
        this.error.set('Failed to load train data');
        this.loading.set(false);
      }
    });
  }
}
