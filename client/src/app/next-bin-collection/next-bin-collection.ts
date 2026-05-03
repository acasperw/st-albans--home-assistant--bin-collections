import { HttpClient } from '@angular/common/http';
import { Component, inject, signal, OnInit, OnDestroy, computed, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { environment } from '../../environments/environment';
import { ProcessedApiResponse, EnhancedCollectionDate } from './models';

import { FoodCaddyComponent } from '../shared/components/food-caddy/food-caddy.component';
import { WheelieBinComponent } from '../shared/components/wheelie-bin/wheelie-bin.component';
import { BinCollectionUtils } from '../shared/utils/bin-collection.utils';
import { PollManager, PollHandle } from '../shared/services/poll-manager.service';

@Component({
  selector: 'app-next-bin-collection',
  imports: [
    WheelieBinComponent,
    FoodCaddyComponent
],
  templateUrl: './next-bin-collection.html',
  styleUrls: ['./next-bin-collection.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NextBinCollection implements OnInit, OnDestroy {

  private http = inject(HttpClient);
  private pollManager = inject(PollManager);
  private collectionPoll: PollHandle | null = null;
  private nightModePoll: PollHandle | null = null;

  public loading = signal(true);
  public collectionDates = signal<EnhancedCollectionDate[]>([]);
  public errorMessage = signal<string | null>(null);
  public nightMode = signal(false);
  public hasLoadedDataBefore = signal(false); // Track if we ever had successful data
  public isFallback = signal(false); // Track if using fallback schedule

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

    // Refresh collection data every 3 hours (server cache handles upstream throttling).
    // Idle-aware: pauses when no one's around, refreshes once on activity.
    this.collectionPoll = this.pollManager.register({
      intervalMs: 3 * 60 * 60 * 1000,
      fn: () => this.fetchCollectionDates(),
    });

    // Night-mode reassessment must keep ticking even when idle so the display
    // dims/brightens at the right moment.
    this.nightModePoll = this.pollManager.register({
      intervalMs: 10 * 60 * 1000,
      fn: () => this.updateNightMode(),
      runImmediately: false,
      pauseWhenIdle: false,
    });
  }

  ngOnDestroy(): void {
    this.collectionPoll?.stop();
    this.nightModePoll?.stop();
  }

  private updateNightMode(): void {
    const hour = new Date().getHours();
    const shouldBeNight = hour >= 19 || hour < 6;
    this.nightMode.set(shouldBeNight);
  }

  private fetchCollectionDates(): void {
    this.loading.set(true);
    this.updateNightMode(); // Re-evaluate night mode on each fetch

    const apiUrl = `${environment.apiBaseUrl}/api/bin-collection`;
    this.http.get<ProcessedApiResponse>(apiUrl).subscribe({
      next: (data) => {
        this.collectionDates.set(this.transformCollections(data));
        this.errorMessage.set(null); // Clear any previous error
        this.hasLoadedDataBefore.set(true); // Mark that we have data
        this.isFallback.set(data.isFallback || false); // Track fallback state
        this.loading.set(false);
      },
      error: () => {
        // Only show error if we've never loaded data before
        if (!this.hasLoadedDataBefore()) {
          this.errorMessage.set('Failed to load bin collection dates. Please try again later.');
        } else {
          this.errorMessage.set(null);
        }
        this.loading.set(false);
      }
    });
  }

  private transformCollections(data: ProcessedApiResponse): EnhancedCollectionDate[] {
    return data.collections.map(collection => ({
      date: collection.date,
      daysUntil: collection.daysUntil,
      formattedDate: BinCollectionUtils.formatDate(collection.date),
      services: collection.services.map(service => ({
        ...service,
        binIcon: BinCollectionUtils.getBinIcon(service.serviceType)
      }))
    }));
  }

  // Helper method to get appropriate bin type for wheelie bins
  public getBinType(serviceType: string): 'brown' | 'black' | 'blue' | 'green' | 'black-body-blue-lid' | 'black-body-purple-lid' {
    return BinCollectionUtils.getBinType(serviceType);
  }

}
