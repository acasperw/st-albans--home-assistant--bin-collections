import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { MealService, Meal, MealPlanDay, Suggestion, PlanEntryResponse } from '../../shared/services/meal.service';

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

  // Plan fuzzy-match prompts
  planNearMatch = signal<string | null>(null);
  planExactMatch = signal<string | null>(null);
  planMatchedMealId = signal<number | null>(null);
  planSaveDate = signal<string | null>(null);

  // Suggestions
  suggestions = signal<Suggestion[]>([]);
  suggestionsLoading = signal(true);
  pendingCount = computed(() => this.suggestions().filter(s => s.status === 'pending').length);

  // Library
  library = signal<Meal[]>([]);
  newMealName = signal('');
  addingMeal = signal(false);
  libraryError = signal<string | null>(null);
  libraryNearMatch = signal<string | null>(null);
  libraryExactMatch = signal<string | null>(null);
  libraryOriginal = signal<string | null>(null);

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

  onSavePlan(date: string, force = false): void {
    const name = this.editMealName().trim();
    if (!name) return;

    this.savingPlan.set(true);
    this.planNearMatch.set(null);
    this.planExactMatch.set(null);

    const mealId = this.editMatchedMealId();
    const customName = mealId ? null : name;

    this.mealService.setPlanEntry(date, mealId, customName, this.editNotes().trim() || undefined, force).subscribe({
      next: (res: PlanEntryResponse) => {
        if (res.exactMatch) {
          this.planExactMatch.set(res.exactMatch);
          this.planMatchedMealId.set(res.matchedMealId ?? null);
          this.planSaveDate.set(date);
          this.savingPlan.set(false);
          return;
        }
        if (res.nearMatch) {
          this.planNearMatch.set(res.nearMatch);
          this.planMatchedMealId.set(res.matchedMealId ?? null);
          this.planSaveDate.set(date);
          this.savingPlan.set(false);
          return;
        }
        // Saved successfully
        this.editingDate.set(null);
        this.savingPlan.set(false);
        this.loadPlan();
        this.loadLibrary();
      },
      error: () => this.savingPlan.set(false),
    });
  }

  /** User confirmed the fuzzy match — save with the matched library meal */
  onPlanAcceptMatch(): void {
    const date = this.planSaveDate();
    const mealId = this.planMatchedMealId();
    if (!date || !mealId) return;

    this.savingPlan.set(true);
    this.planNearMatch.set(null);
    this.planExactMatch.set(null);

    this.mealService.setPlanEntry(date, mealId, null, this.editNotes().trim() || undefined).subscribe({
      next: () => {
        this.editingDate.set(null);
        this.savingPlan.set(false);
        this.loadLibrary();
        this.planMatchedMealId.set(null);
        this.planSaveDate.set(null);
        this.loadPlan();
      },
      error: () => this.savingPlan.set(false),
    });
  }

  /** User said "no, keep my name" — force-save as custom */
  onPlanForceCustom(): void {
    const date = this.planSaveDate();
    if (!date) return;

    this.planNearMatch.set(null);
    this.planExactMatch.set(null);
    this.planMatchedMealId.set(null);
    this.planSaveDate.set(null);
    this.onSavePlan(date, true);
  }

  /** Dismiss the match prompt without saving */
  onPlanDismissMatch(): void {
    this.planNearMatch.set(null);
    this.planExactMatch.set(null);
    this.planMatchedMealId.set(null);
    this.planSaveDate.set(null);
  }

  onRemovePlan(id: number): void {
    this.mealService.deletePlanEntry(id).subscribe({
      next: () => {
        this.loadPlan();
        this.loadLibrary();
      },
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
    this.libraryNearMatch.set(null);
    this.libraryExactMatch.set(null);

    this.mealService.addToLibrary(name).subscribe({
      next: (res) => {
        this.addingMeal.set(false);
        if (res.exactMatch) {
          this.libraryExactMatch.set(res.exactMatch);
          this.libraryOriginal.set(res.original ?? name);
        } else if (res.nearMatch) {
          this.libraryNearMatch.set(res.nearMatch);
          this.libraryOriginal.set(res.original ?? name);
        } else {
          this.newMealName.set('');
          this.loadLibrary();
        }
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

  onLibraryAcceptMatch(): void {
    const match = this.libraryNearMatch();
    if (!match) return;
    // The match already exists, no need to add
    this.libraryNearMatch.set(null);
    this.libraryOriginal.set(null);
    this.newMealName.set('');
    this.libraryError.set(`"${match}" is already in the library.`);
  }

  onLibraryForceAdd(): void {
    const original = this.libraryOriginal();
    if (!original) return;

    this.addingMeal.set(true);
    this.libraryNearMatch.set(null);
    this.libraryExactMatch.set(null);

    this.mealService.addToLibrary(original, undefined, true).subscribe({
      next: () => {
        this.newMealName.set('');
        this.addingMeal.set(false);
        this.libraryOriginal.set(null);
        this.loadLibrary();
      },
      error: () => {
        this.addingMeal.set(false);
        this.libraryError.set('Failed to add meal.');
      },
    });
  }

  onLibraryDismissMatch(): void {
    this.libraryNearMatch.set(null);
    this.libraryExactMatch.set(null);
    this.libraryOriginal.set(null);
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
