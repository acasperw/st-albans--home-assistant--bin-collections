import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// ── Types ──

export interface Meal {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface MealPlanEntry {
  id: number;
  date: string;
  meal_id: number | null;
  custom_name: string | null;
  notes: string | null;
  meal_name: string | null;
}

export interface MealPlanDay {
  date: string;
  dayName: string;
  entry: MealPlanEntry | null;
}

export interface MealPlanResponse {
  plan: MealPlanDay[];
}

export interface Suggestion {
  id: number;
  meal_name: string;
  suggested_by: string;
  status: 'pending' | 'accepted' | 'dismissed';
  created_at: string;
}

const STORAGE_KEY = 'meal_admin_token';

@Injectable({ providedIn: 'root' })
export class MealService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/api/meals`;

  // ── Auth ──

  getToken(): string | null {
    return localStorage.getItem(STORAGE_KEY);
  }

  setToken(password: string): void {
    localStorage.setItem(STORAGE_KEY, password);
  }

  clearToken(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.getToken()}` });
  }

  validatePassword(password: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.baseUrl}/auth`, { password });
  }

  // ── Public ──

  getPlan(): Observable<MealPlanResponse> {
    return this.http.get<MealPlanResponse>(`${this.baseUrl}/plan`);
  }

  submitSuggestion(mealName: string, suggestedBy: string): Observable<Suggestion> {
    return this.http.post<Suggestion>(`${this.baseUrl}/suggestions`, { mealName, suggestedBy });
  }

  // ── Admin ──

  getSuggestions(): Observable<Suggestion[]> {
    return this.http.get<Suggestion[]>(`${this.baseUrl}/suggestions`, {
      headers: this.authHeaders(),
    });
  }

  updateSuggestion(id: number, status: 'accepted' | 'dismissed'): Observable<Suggestion> {
    return this.http.put<Suggestion>(`${this.baseUrl}/suggestions/${id}`, { status }, {
      headers: this.authHeaders(),
    });
  }

  getLibrary(): Observable<Meal[]> {
    return this.http.get<Meal[]>(`${this.baseUrl}/library`, {
      headers: this.authHeaders(),
    });
  }

  addToLibrary(name: string, description?: string): Observable<Meal> {
    return this.http.post<Meal>(`${this.baseUrl}/library`, { name, description }, {
      headers: this.authHeaders(),
    });
  }

  deleteFromLibrary(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/library/${id}`, {
      headers: this.authHeaders(),
    });
  }

  setPlanEntry(date: string, mealId: number | null, customName: string | null, notes?: string): Observable<MealPlanEntry> {
    return this.http.post<MealPlanEntry>(`${this.baseUrl}/plan`, { date, mealId, customName, notes }, {
      headers: this.authHeaders(),
    });
  }

  deletePlanEntry(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/plan/${id}`, {
      headers: this.authHeaders(),
    });
  }
}
