import { HttpClient } from '@angular/common/http';
import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { environment } from '../../environments/environment';
import { ApiResponse, VeoliaService, CollectionGroup } from './models';
import { CommonModule } from '@angular/common';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-next-bin-collection',
  imports: [
    CommonModule
  ],
  templateUrl: './next-bin-collection.html'
})
export class NextBinCollection implements OnInit {

  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  public loading = signal(true);
  public collectionDates = signal<VeoliaService[]>([]);
  public groupedCollections = signal<CollectionGroup[]>([]);
  public errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.fetchCollectionDates();
    
    // Set up automatic refresh every 12 hours (43200000 milliseconds)
    interval(12 * 60 * 60 * 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.fetchCollectionDates();
      });
  }

  private fetchCollectionDates(): void {
    this.loading.set(true);

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
        return {
          date: dateString,
          formattedDate: this.formatDate(dateString),
          daysUntil: this.getDaysUntil(dateString),
          daysUntilText: this.getDaysUntilText(dateString),
          isCollectionSoon: this.isCollectionSoon(dateString),
          services: services
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  getBinType(serviceName: string): string {
    if (serviceName.includes('Refuse')) return 'refuse';
    if (serviceName.includes('Recycling')) return 'recycling';
    if (serviceName.includes('Food')) return 'food';
    if (serviceName.includes('Garden')) return 'garden';
    return 'default';
  }

  getBinIcon(serviceName: string): string {
    if (serviceName.includes('Refuse')) return '🗑️';
    if (serviceName.includes('Recycling')) return '♻️';
    if (serviceName.includes('Food')) return '🍎';
    if (serviceName.includes('Garden')) return '🌿';
    return '📦';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short'
    };
    return date.toLocaleDateString('en-GB', options);
  }

  getDaysUntil(dateString: string): number {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    const diff = date.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  getDaysUntilText(dateString: string): string {
    const days = this.getDaysUntil(dateString);
    if (days === 0) return 'Today!';
    if (days === 1) return 'Tomorrow';
    if (days < 0) return 'Overdue';
    return `in ${days} days`;
  }

  isCollectionSoon(dateString: string): boolean {
    const days = this.getDaysUntil(dateString);
    return days >= 0 && days <= 3;
  }

}
