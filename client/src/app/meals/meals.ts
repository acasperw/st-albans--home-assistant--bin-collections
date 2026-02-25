import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
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

  // Near-match confirmation state
  nearMatch = signal<string | null>(null);
  nearMatchOriginal = signal<string | null>(null);
  exactMatch = signal<string | null>(null);

  // Rejection message from server validation
  rejectionMessage = signal<string | null>(null);

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
    this.nearMatch.set(null);
    this.exactMatch.set(null);
    this.rejectionMessage.set(null);
    this.mealService.submitSuggestion(mealName, name).subscribe({
      next: (res) => {
        if (res.exactMatch) {
          // Meal already exists — inform user
          this.exactMatch.set(res.exactMatch);
          this.submitting.set(false);
        } else if (res.nearMatch) {
          // Server found a similar meal — ask user to confirm
          this.nearMatch.set(res.nearMatch);
          this.nearMatchOriginal.set(res.original ?? mealName);
          this.submitting.set(false);
        } else {
          this.completeSuggestion(name);
        }
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 422 && err.error?.error) {
          this.rejectionMessage.set(err.error.error);
        }
        this.submitting.set(false);
      },
    });
  }

  onAcceptMatch(): void {
    const match = this.nearMatch();
    const name = this.suggestName().trim();
    if (!match || !name) return;

    this.submitting.set(true);
    this.mealService.submitSuggestion(match, name, true).subscribe({
      next: () => this.completeSuggestion(name),
      error: () => this.submitting.set(false),
    });
  }

  onKeepOriginal(): void {
    const original = this.nearMatchOriginal();
    const name = this.suggestName().trim();
    if (!original || !name) return;

    this.submitting.set(true);
    this.mealService.submitSuggestion(original, name, true).subscribe({
      next: () => this.completeSuggestion(name),
      error: () => this.submitting.set(false),
    });
  }

  private completeSuggestion(name: string): void {
    this.lastSuggestedBy.set(name);
    this.suggestionSent.set(true);
    this.submitting.set(false);
    this.suggestMealName.set('');
    this.nearMatch.set(null);
    this.nearMatchOriginal.set(null);
    this.exactMatch.set(null);
    this.rejectionMessage.set(null);
    this.queueSuccessReset();
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
