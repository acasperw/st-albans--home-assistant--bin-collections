import { Component, OnInit, OnDestroy, signal, computed, input, inject, ChangeDetectionStrategy } from '@angular/core';
import { WeatherBadgeComponent } from '../shared/components/weather-badge/weather-badge.component';
import { MealService, MealPlanDay } from '../shared/services/meal.service';
import { TimerService } from '../shared/services/timer.service';
import { CookingPlanService } from '../shared/services/cooking-plan.service';
import { PollManager, PollHandle } from '../shared/services/poll-manager.service';
import { toLocalDateStr } from '../shared/utils/date.utils';

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
  private pollManager = inject(PollManager);
  private secondTimer: ReturnType<typeof setInterval> | null = null;
  private mealPlanPoll: PollHandle | null = null;
  private cookingPlanPoll: PollHandle | null = null;
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
    const dateStr = toLocalDateStr(targetDate);
    const day = this.mealPlan().find(d => d.date === dateStr);
    return day?.entry ? (day.entry.meal_name ?? day.entry.custom_name) : null;
  });

  public upcomingMealLabel = computed(() =>
    this.now().getHours() >= 18 ? "Tomorrow's dinner" : "Tonight's dinner"
  );

  ngOnInit(): void {
    this.alignAndStartSecondTicks();

    // Idle-aware polls: pause when the kitchen is unattended, refresh on activity.
    this.mealPlanPoll = this.pollManager.register({
      intervalMs: MEAL_REFRESH_MS,
      fn: () => this.loadTomorrowMeal(),
    });
    this.cookingPlanPoll = this.pollManager.register({
      intervalMs: PLAN_REFRESH_MS,
      fn: () => this.cookingPlanService.load(),
      runImmediately: false, // CookingPlanService.load() is already invoked from its own constructor
    });
  }

  ngOnDestroy(): void {
    if (this.secondTimer !== null) {
      clearInterval(this.secondTimer);
      this.secondTimer = null;
    }
    this.mealPlanPoll?.stop();
    this.cookingPlanPoll?.stop();
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
