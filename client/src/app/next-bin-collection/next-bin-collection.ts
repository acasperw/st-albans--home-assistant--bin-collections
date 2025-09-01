import { HttpClient } from '@angular/common/http';
import { Component, inject, signal, OnInit, DestroyRef, computed } from '@angular/core';
import { environment } from '../../environments/environment';
import { ProcessedApiResponse, EnhancedCollectionDate, EnhancedProcessedService } from './models';
import { CommonModule } from '@angular/common';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FoodCaddyComponent } from '../shared/components/food-caddy/food-caddy.component';
import { WheelieBinComponent } from '../shared/components/wheelie-bin/wheelie-bin.component';

@Component({
  selector: 'app-next-bin-collection',
  imports: [
    CommonModule,
    WheelieBinComponent,
    FoodCaddyComponent
  ],
  templateUrl: './next-bin-collection.html'
})
export class NextBinCollection implements OnInit {

  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  public loading = signal(true);
  public collectionDates = signal<EnhancedCollectionDate[]>([]);
  public errorMessage = signal<string | null>(null);

  // Computed signals for enhanced collections with bin type and icon data
  public enhancedGroupedCollections = computed(() => {
    return this.collectionDates();
  });

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
    this.http.get<ProcessedApiResponse>(apiUrl).subscribe({
      next: (data) => {
        // Transform processed data to enhanced format with presentation data
        const enhancedCollections = data.collections.map(collection => ({
          date: collection.date, // Already ISO 8601 format from server
          daysUntil: collection.daysUntil, // Already calculated by server
          formattedDate: this.formatDate(collection.date),
          daysUntilText: this.getDaysUntilText(collection.daysUntil),
          isCollectionSoon: this.isCollectionSoon(collection.daysUntil),
          services: collection.services.map(service => ({
            ...service,
            binIcon: this.getBinIcon(service.serviceType)
          }))
        }));
        
        this.collectionDates.set(enhancedCollections);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Failed to load bin collection dates. Please try again later.');
        this.loading.set(false);
      }
    });
  }

  // Updated helper methods for the new API response format
  private getBinIcon(serviceType: string): string {
    switch (serviceType) {
      case 'refuse': return '🗑️';
      case 'recycling': return '♻️';
      case 'food': return '🍎';
      case 'garden': return '🌿';
      default: return '📦';
    }
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short'
    };
    return date.toLocaleDateString('en-GB', options);
  }

  private getDaysUntilText(daysUntil: number): string {
    if (daysUntil === 0) return 'Today!';
    if (daysUntil === 1) return 'Tomorrow';
    if (daysUntil < 0) return 'Overdue';
    return `in ${daysUntil} days`;
  }

  private isCollectionSoon(daysUntil: number): boolean {
    return daysUntil >= 0 && daysUntil <= 6;
  }

}
