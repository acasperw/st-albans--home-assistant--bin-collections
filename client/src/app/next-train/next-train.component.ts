import { Component, OnInit, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NextTrainService } from './next-train.service';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-next-train',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './next-train.component.html',
  styleUrls: ['./next-train.component.scss']
})
export class NextTrainComponent implements OnInit {
  private svc = inject(NextTrainService);
  private destroyRef = inject(DestroyRef);

  public from = signal('SAA');
  public to = signal('HWW');

  public loading = this.svc.loading;
  public data = this.svc.data;
  public error = this.svc.error;

  public nextTrain = computed(() => this.data()?.next ?? null);
  public following = computed(() => this.data()?.following ?? []);

  public countdown = computed(() => {
    const n = this.nextTrain();
    if (!n) return '';
    const dep = new Date(n.expectedDeparture || n.aimedDeparture).getTime();
    const diffMs = dep - Date.now();
    if (diffMs < -60000) return 'Departed';
    if (diffMs < 0) return 'Now';
    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  });

  public statusClass(status: string | undefined) {
    switch (status) {
      case 'ON_TIME': return 'on-time';
      case 'DELAYED': return 'delayed';
      case 'CANCELLED': return 'cancelled';
      default: return 'unknown';
    }
  }

  ngOnInit(): void {
    this.refresh();
    // Update every 30s for countdown display & short TTL cache sync
    interval(30000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.refresh());
    // Fine-grained countdown every second (local only) -> trigger signal recalculation
    interval(1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      // noop; signals referencing Date.now() pattern
    });
  }

  refresh() {
    this.svc.fetch(this.from(), this.to());
  }

  formatTime(iso: string | undefined) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
}
