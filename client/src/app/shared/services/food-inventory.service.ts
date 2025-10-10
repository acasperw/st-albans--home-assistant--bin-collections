import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FoodItem {
  id: string;
  barcode?: string;
  name: string;
  category?: string;
  addedAt: string;
  expiry: string;
  quantity: number;
  status: 'active' | 'used' | 'discarded' | 'expired';
  notes?: string;
  source: 'scan' | 'manual';
}

export interface AddFoodItemRequest {
  barcode?: string;
  name: string;
  category?: string;
  expiry: string;
  quantity?: number;
  notes?: string;
  source: 'scan' | 'manual';
}

export interface UpdateFoodItemRequest {
  status?: 'active' | 'used' | 'discarded' | 'expired';
  quantity?: number;
  expiry?: string;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class FoodInventoryService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiBaseUrl}/api/food-inventory`;

  // Signals for reactive state
  public items = signal<FoodItem[]>([]);
  public loading = signal(false);
  public error = signal<string | null>(null);

  // Computed values
  public expiringSoon = computed(() => {
    const today = new Date();
    const threeDaysFromNow = new Date(today.getTime() + (3 * 24 * 60 * 60 * 1000));
    
    return this.items()
      .filter(item => item.status === 'active')
      .filter(item => {
        const expiryDate = new Date(item.expiry);
        return expiryDate <= threeDaysFromNow;
      })
      .sort((a, b) => a.expiry.localeCompare(b.expiry));
  });

  public expired = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.items()
      .filter(item => item.status === 'active')
      .filter(item => {
        const expiryDate = new Date(item.expiry);
        return expiryDate < today;
      });
  });

  public activeItems = computed(() => 
    this.items()
      .filter(item => item.status === 'active')
      .sort((a, b) => a.expiry.localeCompare(b.expiry))
  );

  /**
   * Load all food items from server
   */
  loadItems(): Observable<FoodItem[]> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.get<FoodItem[]>(this.apiUrl).pipe(
      tap(items => {
        this.items.set(items);
        this.loading.set(false);
      }),
      catchError(error => {
        this.error.set('Failed to load food inventory');
        this.loading.set(false);
        console.error('Error loading food inventory:', error);
        return of([]);
      })
    );
  }

  /**
   * Add a new food item
   */
  addItem(itemData: AddFoodItemRequest): Observable<FoodItem | null> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.post<FoodItem>(this.apiUrl, itemData).pipe(
      tap(newItem => {
        this.items.update(items => [...items, newItem]);
        this.loading.set(false);
      }),
      catchError(error => {
        this.error.set('Failed to add food item');
        this.loading.set(false);
        console.error('Error adding food item:', error);
        return of(null);
      })
    );
  }

  /**
   * Update an existing food item
   */
  updateItem(id: string, updates: UpdateFoodItemRequest): Observable<FoodItem | null> {
    return this.http.put<FoodItem>(`${this.apiUrl}/${id}`, updates).pipe(
      tap(updatedItem => {
        this.items.update(items => 
          items.map(item => item.id === id ? updatedItem : item)
        );
      }),
      catchError(error => {
        this.error.set('Failed to update food item');
        console.error('Error updating food item:', error);
        return of(null);
      })
    );
  }

  /**
   * Delete a food item
   */
  deleteItem(id: string): Observable<boolean> {
    return this.http.delete(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        this.items.update(items => items.filter(item => item.id !== id));
      }),
      map(() => true),
      catchError(error => {
        this.error.set('Failed to delete food item');
        console.error('Error deleting food item:', error);
        return of(false);
      })
    );
  }

  /**
   * Mark item as used
   */
  markAsUsed(id: string): Observable<FoodItem | null> {
    return this.updateItem(id, { status: 'used' });
  }

  /**
   * Mark item as discarded
   */
  markAsDiscarded(id: string): Observable<FoodItem | null> {
    return this.updateItem(id, { status: 'discarded' });
  }

  /**
   * Extend expiry date by specified days
   */
  extendExpiry(id: string, additionalDays: number): Observable<FoodItem | null> {
    const item = this.items().find(i => i.id === id);
    if (!item) return of(null);

    const currentExpiry = new Date(item.expiry);
    const newExpiry = new Date(currentExpiry.getTime() + (additionalDays * 24 * 60 * 60 * 1000));
    const newExpiryStr = newExpiry.toISOString().split('T')[0]; // YYYY-MM-DD

    return this.updateItem(id, { expiry: newExpiryStr });
  }

  /**
   * Get suggested expiry date based on item name/category
   */
  getSuggestedExpiryDays(name: string, category?: string): number {
    const nameLC = name.toLowerCase();
    const categoryLC = category?.toLowerCase() || '';

    // Simple mapping - extend as needed
    const rules = [
      { keywords: ['milk', 'yogurt', 'yoghurt'], days: 7 },
      { keywords: ['bread', 'bagel'], days: 5 },
      { keywords: ['banana', 'apple', 'orange'], days: 7 },
      { keywords: ['lettuce', 'salad', 'spinach'], days: 3 },
      { keywords: ['cheese'], days: 14 },
      { keywords: ['eggs'], days: 21 },
      { keywords: ['chicken', 'beef', 'pork', 'fish'], days: 2 },
      { keywords: ['berries', 'strawberries', 'blueberries'], days: 4 }
    ];

    for (const rule of rules) {
      if (rule.keywords.some(keyword => nameLC.includes(keyword) || categoryLC.includes(keyword))) {
        return rule.days;
      }
    }

    return 5; // Default
  }

  /**
   * Generate expiry date string from days
   */
  getExpiryDateString(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }
}