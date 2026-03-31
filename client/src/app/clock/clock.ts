import { Component, OnInit, OnDestroy, signal, computed, input, inject, DestroyRef, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { WeatherBadgeComponent } from '../shared/components/weather-badge/weather-badge.component';
import { MealService, MealPlanDay } from '../shared/services/meal.service';
import { TimerService, Timer } from '../shared/services/timer.service';
import { CookingPlanService } from '../shared/services/cooking-plan.service';

const MEAL_REFRESH_MS = 30 * 60 * 1000; // 30 minutes
const PLAN_REFRESH_MS = 60 * 1000; // 1 minute

@Component({
  selector: 'app-clock',
  imports: [WeatherBadgeComponent],
  templateUrl: './clock.html',
  styleUrl: './clock.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Clock implements OnInit, OnDestroy {
  private mealService = inject(MealService);
  protected timerService = inject(TimerService);
  protected cookingPlanService = inject(CookingPlanService);
  private destroyRef = inject(DestroyRef);
  private secondTimer: ReturnType<typeof setInterval> | null = null;
  private now = signal(new Date());
  private mealPlan = signal<MealPlanDay[]>([]);

  // Active (visible) state passed from parent for fade animation
  public active = input<boolean>(false);

  // Whether timers are active — drives layout change
  public hasTimers = computed(() => this.timerService.hasActiveTimers());

  // Whether there's a cooking plan with upcoming actions
  public hasCookingPlan = computed(() => this.cookingPlanService.nextAction() !== null);

  // Whether anything extra is showing (timers or cooking plan)
  public hasExtras = computed(() => this.hasTimers() || this.hasCookingPlan());

  // HH:MM main display
  public time = computed(() => {
    const d = this.now();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  });

  // Seconds (00-59)
  public seconds = computed(() => String(this.now().getSeconds()).padStart(2, '0'));

  // Active timers with remaining time
  public activeTimers = computed(() => {
    const now = this.now();
    return this.timerService.timers()
      .map(t => ({
        ...t,
        remainingSecs: Math.max(0, Math.round((new Date(t.endsAt).getTime() - now.getTime()) / 1000)),
      }))
      .filter(t => t.remainingSecs > 0);
  });

  // Next cooking plan action with countdown
  public cookingAction = computed(() => {
    const action = this.cookingPlanService.nextAction();
    if (!action) return null;
    const now = this.now();
    const remainingSecs = Math.max(0, Math.round((action.time.getTime() - now.getTime()) / 1000));
    return { ...action, remainingSecs };
  });

  // Show tonight's meal before 6 pm, tomorrow's meal from 6 pm onwards
  public upcomingMeal = computed(() => {
    const now = this.now();
    const isEvening = now.getHours() >= 18;
    const targetDate = new Date(now);
    if (isEvening) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    const dateStr = this.toLocalDateStr(targetDate);
    const day = this.mealPlan().find(d => d.date === dateStr);
    return day?.entry ? (day.entry.meal_name ?? day.entry.custom_name) : null;
  });

  public upcomingMealLabel = computed(() =>
    this.now().getHours() >= 18 ? "Tomorrow's dinner" : "Tonight's dinner"
  );

  ngOnInit(): void {
    this.alignAndStartSecondTicks();
    this.loadTomorrowMeal();

    // Refresh the meal plan every 30 minutes
    interval(MEAL_REFRESH_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadTomorrowMeal());

    // Refresh cooking plan every minute (server computes schedule based on current time)
    interval(PLAN_REFRESH_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cookingPlanService.load());
  }

  ngOnDestroy(): void {
    if (this.secondTimer !== null) {
      clearInterval(this.secondTimer);
      this.secondTimer = null;
    }
  }

  private loadTomorrowMeal(): void {
    this.mealService.getPlan().subscribe({
      next: (res) => this.mealPlan.set(res.plan),
    });
  }

  private alignAndStartSecondTicks() {
    // Set current time immediately
    this.now.set(new Date());
    // Align first tick to next second boundary for smoothness
    const ms = this.now().getMilliseconds();
    setTimeout(() => {
      this.now.set(new Date());
      this.secondTimer = setInterval(() => this.now.set(new Date()), 1000);
    }, 1000 - ms);
  }

  /** Format a Date as YYYY-MM-DD using local time (avoids toISOString UTC shift). */
  private toLocalDateStr(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Format remaining seconds as H:MM:SS or MM:SS */
  public formatRemaining(secs: number): string {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

}
