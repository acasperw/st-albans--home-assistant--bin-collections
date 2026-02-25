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
  times_planned: number;
  last_planned: string | null;
  times_requested: number;
}

export interface MealPlanEntry {
  id: number;
  date: string;
  meal_id: number | null;
  custom_name: string | null;
  notes: string | null;
  meal_name: string | null;
}

export interface PlanEntryResponse {
  /** Returned when the entry was saved successfully */
  id?: number;
  date?: string;
  meal_id?: number | null;
  custom_name?: string | null;
  notes?: string | null;
  meal_name?: string | null;
  /** When present, the server found an exact match in the library */
  exactMatch?: string;
  /** When present, the server found a near match in the library */
  nearMatch?: string;
  original?: string;
  matchedMealId?: number | null;
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

export interface SuggestionResponse {
  /** When present, the server found an exact match already in the library/pending */
  exactMatch?: string;
  /** When present, the server found a near match and wants confirmation */
  nearMatch?: string;
  original?: string;
  /** When true, the meal was already in the library and a request (vote) was recorded */
  requested?: boolean;
  /** The library meal name that was requested */
  mealName?: string;
  /** When a suggestion was actually created */
  id?: number;
  meal_name?: string;
  suggested_by?: string;
  status?: string;
  created_at?: string;
}

export interface LibraryAddResponse {
  /** Exact match found */
  exactMatch?: string;
  /** Near match found */
  nearMatch?: string;
  original?: string;
  /** When actually created */
  id?: number;
  name?: string;
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

  submitSuggestion(mealName: string, suggestedBy: string, useExisting = false): Observable<SuggestionResponse> {
    return this.http.post<SuggestionResponse>(`${this.baseUrl}/suggestions`, { mealName, suggestedBy, useExisting });
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

  addToLibrary(name: string, description?: string, force = false): Observable<LibraryAddResponse> {
    return this.http.post<LibraryAddResponse>(`${this.baseUrl}/library`, { name, description, force }, {
      headers: this.authHeaders(),
    });
  }

  deleteFromLibrary(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/library/${id}`, {
      headers: this.authHeaders(),
    });
  }

  setPlanEntry(date: string, mealId: number | null, customName: string | null, notes?: string, force = false): Observable<PlanEntryResponse> {
    return this.http.post<PlanEntryResponse>(`${this.baseUrl}/plan`, { date, mealId, customName, notes, force }, {
      headers: this.authHeaders(),
    });
  }

  deletePlanEntry(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/plan/${id}`, {
      headers: this.authHeaders(),
    });
  }
}
