import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { BinCollectionUtils } from '../utils/bin-collection.utils';
import type { ProcessedApiResponse, ProcessedCollectionDate } from '../../next-bin-collection/models';
import { NotificationCenter } from './notification-center.service';
import { PollManager } from './poll-manager.service';

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const NOTIFICATION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // self-expire after 24h
const CATEGORY = 'bin-collection';

/**
 * Monitors upcoming bin collections and publishes a "put bins out tonight"
 * reminder via {@link NotificationCenter}. The reminder appears from noon on
 * the day before collection. The notification id encodes the date + service
 * types, so a fresh notification is published whenever the collection changes
 * (and dismissal memory is keyed naturally per-collection).
 */
@Injectable({ providedIn: 'root' })
export class BinCollectionNotificationService {
  private http = inject(HttpClient);
  private center = inject(NotificationCenter);
  private pollManager = inject(PollManager);
  private started = false;

  startMonitoring(): void {
    if (this.started) return;
    this.started = true;
    this.pollManager.register({
      intervalMs: CHECK_INTERVAL_MS,
      fn: () => this.check(),
      // Reminders should keep ticking even when the kitchen is unattended,
      // so the message is ready as soon as someone walks back in.
      pauseWhenIdle: false,
    });
  }

  private check(): void {
    const apiUrl = `${environment.apiBaseUrl}/api/bin-collection`;
    this.http.get<ProcessedApiResponse>(apiUrl).subscribe({
      next: (data) => this.evaluate(data.collections),
      error: (err) => console.error('Failed to fetch bin collections for notification check:', err),
    });
  }

  private evaluate(collections: ProcessedCollectionDate[]): void {
    const tomorrow = collections.find(c => c.daysUntil === 1);

    // Show only on the day before collection, from noon onwards.
    if (!tomorrow || new Date().getHours() < 12) {
      this.center.clearCategory(CATEGORY);
      return;
    }

    const services = tomorrow.services.map(s => s.serviceType).join(',');
    const id = `${CATEGORY}:${tomorrow.date}:${services}`;
    const binTypes = BinCollectionUtils.getBinTypesDescription(tomorrow);
    const icon = BinCollectionUtils.getCollectionIcon(tomorrow);

    this.center.publish({
      id,
      category: CATEGORY,
      type: 'warning',
      title: 'Put bins out tonight!',
      message: `Tomorrow: ${binTypes}`,
      icon,
      createdAt: Date.now(),
      maxAgeMs: NOTIFICATION_MAX_AGE_MS,
      priority: 1,
    });
  }
}
