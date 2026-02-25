import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { MealService, Meal, MealPlanDay, Suggestion } from '../../shared/services/meal.service';

type AdminTab = 'plan' | 'suggestions' | 'library';

@Component({
  selector: 'app-meal-admin',
  templateUrl: './admin.html',
  styleUrls: ['./admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MealAdminComponent implements OnInit {
  private mealService = inject(MealService);

  // Auth
  authenticated = signal(false);
  passwordInput = signal('');
  loggingIn = signal(false);
  loginError = signal<string | null>(null);

  // Tabs
  activeTab = signal<AdminTab>('plan');

  // Plan
  plan = signal<MealPlanDay[]>([]);
  planLoading = signal(true);
  editingDate = signal<string | null>(null);
  editMealName = signal('');
  editNotes = signal('');
  savingPlan = signal(false);

  // Matched library meal for the current edit input
  private editMatchedMealId = signal<number | null>(null);

  // Suggestions
  suggestions = signal<Suggestion[]>([]);
  suggestionsLoading = signal(true);
  pendingCount = computed(() => this.suggestions().filter(s => s.status === 'pending').length);

  // Library
  library = signal<Meal[]>([]);
  newMealName = signal('');
  addingMeal = signal(false);
  libraryError = signal<string | null>(null);

  ngOnInit(): void {
    // Check if already authenticated
    if (this.mealService.isAuthenticated()) {
      this.authenticated.set(true);
      this.loadAll();
    }
  }

  // ── Auth ──

  onLogin(event: Event): void {
    event.preventDefault();
    const pw = this.passwordInput().trim();
    if (!pw) return;

    this.loggingIn.set(true);
    this.loginError.set(null);

    this.mealService.validatePassword(pw).subscribe({
      next: () => {
        this.mealService.setToken(pw);
        this.authenticated.set(true);
        this.loggingIn.set(false);
        this.loadAll();
      },
      error: () => {
        this.loginError.set('Wrong password. Try again.');
        this.loggingIn.set(false);
      },
    });
  }

  onLogout(): void {
    this.mealService.clearToken();
    this.authenticated.set(false);
    this.passwordInput.set('');
  }

  // ── Data loading ──

  private loadAll(): void {
    this.loadPlan();
    this.loadSuggestions();
    this.loadLibrary();
  }

  private loadPlan(): void {
    this.planLoading.set(true);
    this.mealService.getPlan().subscribe({
      next: (res) => {
        this.plan.set(res.plan);
        this.planLoading.set(false);
      },
      error: () => this.planLoading.set(false),
    });
  }

  private loadSuggestions(): void {
    this.suggestionsLoading.set(true);
    this.mealService.getSuggestions().subscribe({
      next: (data) => {
        this.suggestions.set(data);
        this.suggestionsLoading.set(false);
      },
      error: () => this.suggestionsLoading.set(false),
    });
  }

  private loadLibrary(): void {
    this.mealService.getLibrary().subscribe({
      next: (data) => this.library.set(data),
      error: () => {},
    });
  }

  // ── Plan management ──

  onEditDay(day: MealPlanDay): void {
    this.editingDate.set(day.date);
    this.editMealName.set(day.entry?.meal_name ?? '');
    this.editNotes.set(day.entry?.notes ?? '');
    this.editMatchedMealId.set(day.entry?.meal_id ?? null);
  }

  onEditMealInput(value: string): void {
    this.editMealName.set(value);
    // Check if typed value matches a library meal
    const match = this.library().find(m => m.name.toLowerCase() === value.toLowerCase());
    this.editMatchedMealId.set(match?.id ?? null);
  }

  onSavePlan(date: string): void {
    const name = this.editMealName().trim();
    if (!name) return;

    this.savingPlan.set(true);
    const mealId = this.editMatchedMealId();
    const customName = mealId ? null : name;

    this.mealService.setPlanEntry(date, mealId, customName, this.editNotes().trim() || undefined).subscribe({
      next: () => {
        this.editingDate.set(null);
        this.savingPlan.set(false);
        this.loadPlan();
      },
      error: () => this.savingPlan.set(false),
    });
  }

  onRemovePlan(id: number): void {
    this.mealService.deletePlanEntry(id).subscribe({
      next: () => this.loadPlan(),
    });
  }

  // ── Suggestions ──

  onSuggestionAction(id: number, status: 'accepted' | 'dismissed'): void {
    this.mealService.updateSuggestion(id, status).subscribe({
      next: () => {
        this.loadSuggestions();
        if (status === 'accepted') {
          this.loadLibrary(); // Refresh library since accepted suggestions are added
        }
      },
    });
  }

  // ── Library ──

  onAddToLibrary(event: Event): void {
    event.preventDefault();
    const name = this.newMealName().trim();
    if (!name) return;

    this.addingMeal.set(true);
    this.libraryError.set(null);

    this.mealService.addToLibrary(name).subscribe({
      next: () => {
        this.newMealName.set('');
        this.addingMeal.set(false);
        this.loadLibrary();
      },
      error: (err) => {
        this.addingMeal.set(false);
        if (err.status === 409) {
          this.libraryError.set('That meal already exists in the library.');
        } else {
          this.libraryError.set('Failed to add meal.');
        }
      },
    });
  }

  onDeleteMeal(id: number): void {
    this.mealService.deleteFromLibrary(id).subscribe({
      next: () => this.loadLibrary(),
    });
  }

  asInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
