import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval, Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../environments/environment';
import { ApiResponse, VeoliaService, CollectionGroup } from './models';

@Injectable({
  providedIn: 'root'
})
export class BinCollectionService {
  private http = inject(HttpClient);

  public loading = signal(true);
  public collectionDates = signal<VeoliaService[]>([]);
  public groupedCollections = signal<CollectionGroup[]>([]);
  public errorMessage = signal<string | null>(null);

  // Computed signals for enhanced collections with bin type and icon data
  public enhancedGroupedCollections = computed(() => {
    return this.groupedCollections().map(group => ({
      ...group,
      services: group.services.map(service => ({
        ...service,
        binType: this.getBinType(service.ServiceName),
        binIcon: this.getBinIcon(service.ServiceName)
      }))
    }));
  });

  /**
   * Initialize automatic data fetching with 12-hour refresh interval
   */
  initializeAutoRefresh(): void {
    this.fetchCollectionDates();
    
    // Set up automatic refresh every 12 hours (43200000 milliseconds)
    interval(12 * 60 * 60 * 1000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.fetchCollectionDates();
      });
  }

  /**
   * Fetch collection dates from API
   */
  fetchCollectionDates(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const apiUrl = `${environment.apiBaseUrl}/api/bin-collection`;
    this.http.get<ApiResponse>(apiUrl).subscribe({
      next: (data) => {
        // Sort collection dates by next collection date (earliest first)
        const sortedData = data.d.sort((a, b) => {
          // Get the next collection date from the first service header
          const dateA = a.ServiceHeaders?.[0]?.Next ? new Date(a.ServiceHeaders[0].Next).getTime() : 0;
          const dateB = b.ServiceHeaders?.[0]?.Next ? new Date(b.ServiceHeaders[0].Next).getTime() : 0;
          return dateA - dateB;
        });
        
        this.collectionDates.set(sortedData);
        this.groupedCollections.set(this.groupCollectionsByDate(sortedData));
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Failed to load bin collection dates. Please try again later.');
        this.loading.set(false);
      }
    });
  }

  /**
   * Group collection services by their collection date
   */
  private groupCollectionsByDate(collections: VeoliaService[]): CollectionGroup[] {
    const groups = new Map<string, VeoliaService[]>();
    
    // Group services by their next collection date
    collections.forEach(service => {
      const nextDate = service.ServiceHeaders?.[0]?.Next;
      if (nextDate) {
        const dateKey = new Date(nextDate).toDateString();
        if (!groups.has(dateKey)) {
          groups.set(dateKey, []);
        }
        groups.get(dateKey)!.push(service);
      }
    });
    
    // Convert to CollectionGroup array and sort by date
    return Array.from(groups.entries())
      .map(([dateKey, services]) => {
        const date = new Date(dateKey);
        const dateString = services[0].ServiceHeaders[0].Next;
        
        // Sort services within each group - Food collections come last
        const sortedServices = services.sort((a, b) => {
          const aIsFood = a.ServiceName.includes('Food');
          const bIsFood = b.ServiceName.includes('Food');
          
          // If one is food and the other isn't, food goes last
          if (aIsFood && !bIsFood) return 1;
          if (!aIsFood && bIsFood) return -1;
          
          // If both are food or both are not food, sort alphabetically
          return a.ServiceName.localeCompare(b.ServiceName);
        });
        
        return {
          date: dateString,
          formattedDate: this.formatDate(dateString),
          daysUntil: this.getDaysUntil(dateString),
          daysUntilText: this.getDaysUntilText(dateString),
          isCollectionSoon: this.isCollectionSoon(dateString),
          services: sortedServices
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * Get bin type based on service name
   */
  private getBinType(serviceName: string): string {
    if (serviceName.includes('Refuse')) return 'refuse';
    if (serviceName.includes('Recycling')) return 'recycling';
    if (serviceName.includes('Food')) return 'food';
    if (serviceName.includes('Garden')) return 'garden';
    return 'default';
  }

  /**
   * Get bin icon based on service name
   */
  private getBinIcon(serviceName: string): string {
    if (serviceName.includes('Refuse')) return '🗑️';
    if (serviceName.includes('Recycling')) return '♻️';
    if (serviceName.includes('Food')) return '🍎';
    if (serviceName.includes('Garden')) return '🌿';
    return '📦';
  }

  /**
   * Format date string for display
   */
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short'
    };
    return date.toLocaleDateString('en-GB', options);
  }

  /**
   * Calculate days until collection
   */
  private getDaysUntil(dateString: string): number {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    const diff = date.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Get text representation of days until collection
   */
  private getDaysUntilText(dateString: string): string {
    const days = this.getDaysUntil(dateString);
    if (days === 0) return 'Today!';
    if (days === 1) return 'Tomorrow';
    if (days < 0) return 'Overdue';
    return `in ${days} days`;
  }

  /**
   * Check if collection is soon (within 3 days)
   */
  private isCollectionSoon(dateString: string): boolean {
    const days = this.getDaysUntil(dateString);
    return days >= 0 && days <= 3;
  }
}
