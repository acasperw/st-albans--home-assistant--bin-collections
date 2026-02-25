import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MealService, MealPlanDay } from '../shared/services/meal.service';

const NAME_STORAGE_KEY = 'meal_suggested_by';
const SUCCESS_RESET_MS = 3000;

@Component({
  selector: 'app-meals',
  imports: [DatePipe],
  templateUrl: './meals.html',
  styleUrls: ['./meals.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MealsComponent implements OnInit, OnDestroy {
  private mealService = inject(MealService);

  plan = signal<MealPlanDay[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // Today's date string for highlighting
  todayStr = signal(new Date().toISOString().split('T')[0]!);

  // Suggestion form state
  suggestMealName = signal('');
  suggestName = signal('');
  submitting = signal(false);
  suggestionSent = signal(false);
  lastSuggestedBy = signal('');
  private resetTimerId: number | null = null;

  ngOnInit(): void {
    this.loadPlan();
    const savedName = localStorage.getItem(NAME_STORAGE_KEY);
    if (savedName) {
      this.suggestName.set(savedName);
    }
  }

  ngOnDestroy(): void {
    if (this.resetTimerId !== null) {
      window.clearTimeout(this.resetTimerId);
      this.resetTimerId = null;
    }
  }

  private loadPlan(): void {
    this.mealService.getPlan().subscribe({
      next: (res) => {
        this.plan.set(res.plan);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load the meal plan. Try again later.');
        this.loading.set(false);
      },
    });
  }

  onSuggest(event: Event): void {
    event.preventDefault();
    const mealName = this.suggestMealName().trim();
    const name = this.suggestName().trim();
    if (!mealName || !name) return;

    this.submitting.set(true);
    this.mealService.submitSuggestion(mealName, name).subscribe({
      next: () => {
        this.lastSuggestedBy.set(name);
        this.suggestionSent.set(true);
        this.submitting.set(false);
        this.suggestMealName.set('');
        this.queueSuccessReset();
      },
      error: () => {
        this.submitting.set(false);
      },
    });
  }

  onNameInput(event: Event): void {
    const value = this.asInputValue(event);
    this.suggestName.set(value);
    if (value.trim()) {
      localStorage.setItem(NAME_STORAGE_KEY, value.trim());
    } else {
      localStorage.removeItem(NAME_STORAGE_KEY);
    }
  }

  private queueSuccessReset(): void {
    if (this.resetTimerId !== null) {
      window.clearTimeout(this.resetTimerId);
    }

    this.resetTimerId = window.setTimeout(() => {
      this.suggestionSent.set(false);
      this.resetTimerId = null;
    }, SUCCESS_RESET_MS);
  }

  asInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
