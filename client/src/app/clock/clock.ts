import { Component, OnInit, OnDestroy, signal, computed, input, inject, DestroyRef, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { WeatherBadgeComponent } from '../shared/components/weather-badge/weather-badge.component';
import { MealService, MealPlanDay } from '../shared/services/meal.service';

const MEAL_REFRESH_MS = 30 * 60 * 1000; // 30 minutes

@Component({
  selector: 'app-clock',
  imports: [WeatherBadgeComponent],
  templateUrl: './clock.html',
  styleUrl: './clock.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Clock implements OnInit, OnDestroy {
  private mealService = inject(MealService);
  private destroyRef = inject(DestroyRef);
  private secondTimer: ReturnType<typeof setInterval> | null = null;
  private now = signal(new Date());
  private mealPlan = signal<MealPlanDay[]>([]);

  // Active (visible) state passed from parent for fade animation
  public active = input<boolean>(false);

  // HH:MM main display
  public time = computed(() => {
    const d = this.now();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  });

  // Seconds (00-59)
  public seconds = computed(() => String(this.now().getSeconds()).padStart(2, '0'));

  // Show tonight's meal before 6 pm, tomorrow's meal from 6 pm onwards
  public upcomingMeal = computed(() => {
    const now = this.now();
    const isEvening = now.getHours() >= 18;
    const targetDate = new Date(now);
    if (isEvening) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    const dateStr = targetDate.toISOString().split('T')[0];
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

}
