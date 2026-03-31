import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimerService } from '../shared/services/timer.service';
import { CookingPlanService } from '../shared/services/cooking-plan.service';
import { FinishTimeInputComponent } from './cooking-plan/finish-time-input';
import { ItemsEditorComponent } from './cooking-plan/items-editor';
import { PlanNarrativeComponent } from './cooking-plan/plan-narrative';
import { ScheduleTableComponent } from './cooking-plan/schedule-table';

type TabId = 'timers' | 'planner';

interface Preset {
  label: string;
  secs: number;
}

const PRESETS: Preset[] = [
  { label: '3 min', secs: 180 },
  { label: '5 min', secs: 300 },
  { label: '10 min', secs: 600 },
  { label: '15 min', secs: 900 },
  { label: '20 min', secs: 1200 },
  { label: '25 min', secs: 1500 },
  { label: '30 min', secs: 1800 },
  { label: '35 min', secs: 2100 },
  { label: '40 min', secs: 2400 },
  { label: '45 min', secs: 2700 },
  { label: '50 min', secs: 3000 },
  { label: '1 hr', secs: 3600 },
];

@Component({
  selector: 'app-timers',
  imports: [RouterLink, FinishTimeInputComponent, ItemsEditorComponent, PlanNarrativeComponent, ScheduleTableComponent],
  templateUrl: './timers.html',
  styleUrl: './timers.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimersComponent {
  private timerService = inject(TimerService);
  protected planService = inject(CookingPlanService);

  activeTab = signal<TabId>('timers');
  showTable = signal(false);

  presets = PRESETS;
  customName = signal('');
  customMinutes = signal('');
  submitting = signal(false);
  error = signal<string | null>(null);

  timers = computed(() => {
    const now = Date.now();
    return this.timerService.timers()
      .map(t => {
        const remaining = Math.max(0, Math.round((new Date(t.endsAt).getTime() - now) / 1000));
        return { ...t, remaining };
      })
      .filter(t => t.remaining > 0);
  });

  hasTimers = computed(() => this.timers().length > 0);

  startPreset(preset: Preset): void {
    this.submitting.set(true);
    this.error.set(null);
    this.timerService.create(preset.label, preset.secs).subscribe({
      next: () => this.submitting.set(false),
      error: (err) => {
        this.error.set(err.error?.error ?? 'Failed to start timer');
        this.submitting.set(false);
      },
    });
  }

  startCustom(): void {
    const name = this.customName().trim() || 'Timer';
    const mins = parseFloat(this.customMinutes());
    if (!mins || mins <= 0) {
      this.error.set('Enter a valid number of minutes');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.timerService.create(name, Math.round(mins * 60)).subscribe({
      next: () => {
        this.customName.set('');
        this.customMinutes.set('');
        this.submitting.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Failed to start timer');
        this.submitting.set(false);
      },
    });
  }

  cancelTimer(id: string): void {
    this.timerService.cancel(id).subscribe();
  }

  formatRemaining(secs: number): string {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}
