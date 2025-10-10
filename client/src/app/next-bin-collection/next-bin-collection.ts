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
  public nightMode = signal(false);

  // Find collection objects by relative day
  public todayCollection = computed(() => this.collectionDates().find(c => c.daysUntil === 0));
  public tomorrowCollection = computed(() => this.collectionDates().find(c => c.daysUntil === 1));

  // The next upcoming collection (today or future)
  public nextUpcomingCollection = computed(() => {
    return this.collectionDates()
      .filter(c => c.daysUntil >= 0)
      .sort((a, b) => a.daysUntil - b.daysUntil)[0];
  });

  // Always show the next upcoming collection
  public summaryCollection = computed(() => {
    return this.nextUpcomingCollection() || null;
  });

  // Headline answering: What bins do I put out tomorrow?
  public summaryHeadline = computed(() => {
    const col = this.summaryCollection();
    if (!col) return 'No upcoming collections found';
    if (col === this.tomorrowCollection()) return 'Put out tonight!';
    if (col === this.todayCollection()) return 'Today\'s collection';
    // Otherwise it's a future collection beyond tomorrow
    return 'Next collection';
  });

  // Check if this is today or tomorrow (for larger icons)
  public isUpcoming = computed(() => !!(this.todayCollection() || this.tomorrowCollection()));

  // Get the collection after the next one (for showing future date at bottom)
  public collectionAfterNext = computed(() => {
    const next = this.summaryCollection();
    if (!next) return null;
    
    return this.collectionDates()
      .filter(c => c.daysUntil > next.daysUntil)
      .sort((a, b) => a.daysUntil - b.daysUntil)[0] || null;
  });

  ngOnInit(): void {
    this.updateNightMode();
    this.fetchCollectionDates();

    // Automatic refresh every 3 hours (10800000 ms) - server cache handles upstream throttling
    interval(3 * 60 * 60 * 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.fetchCollectionDates();
      });

    // Periodic night mode reassessment every 10 minutes (in case app left running past boundary)
    interval(10 * 60 * 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateNightMode());
  }

  private updateNightMode(): void {
    const hour = new Date().getHours();
    const shouldBeNight = hour >= 19 || hour < 6;
    this.nightMode.set(true);
  }

  private fetchCollectionDates(): void {
    this.loading.set(true);
    this.updateNightMode(); // Re-evaluate night mode on each fetch

    const apiUrl = `${environment.apiBaseUrl}/api/bin-collection`;
    this.http.get<ProcessedApiResponse>(apiUrl).subscribe({
      next: (data) => {
        this.collectionDates.set(this.transformCollections(data));
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Failed to load bin collection dates. Please try again later.');
        this.loading.set(false);
      }
    });
  }

  private transformCollections(data: ProcessedApiResponse): EnhancedCollectionDate[] {
    return data.collections.map(collection => ({
      date: collection.date,
      daysUntil: collection.daysUntil,
      formattedDate: this.formatDate(collection.date),
      services: collection.services.map(service => ({
        ...service,
        binIcon: this.getBinIcon(service.serviceType)
      }))
    }));
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

  // Helper method to get appropriate bin type for wheelie bins
  public getBinType(serviceType: string): 'brown' | 'black' | 'blue' | 'green' | 'black-body-blue-lid' | 'black-body-purple-lid' {
    switch (serviceType) {
      case 'garden': return 'green';
      case 'refuse': return 'brown';
      case 'recycling': return 'black';
      case 'food': return 'green';
      default: return 'black';
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

}
