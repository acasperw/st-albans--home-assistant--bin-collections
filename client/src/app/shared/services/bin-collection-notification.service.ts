import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval } from 'rxjs';
import { NotificationService, NotificationData } from './notification.service';
import { environment } from '../../../environments/environment';
import { BinCollectionUtils } from '../utils/bin-collection.utils';
import type { ProcessedApiResponse, ProcessedCollectionDate } from '../../next-bin-collection/models';

/**
 * Service to manage bin collection reminder notifications
 * Shows a warning 12 hours before bins need to be put out
 */
@Injectable({
  providedIn: 'root'
})
export class BinCollectionNotificationService {
  private http = inject(HttpClient);
  private notificationService = inject(NotificationService);

  private lastCheckedCollection: string | null = null;

  /**
   * Start monitoring for bin collection reminders
   * Checks every 30 minutes
   */
  startMonitoring(): void {
    // Initial check
    this.checkBinCollections();

    // Check every 30 minutes
    interval(30 * 60 * 1000).subscribe(() => {
      this.checkBinCollections();
    });
  }

  /**
   * Check if bins need to be put out soon and show notification
   */
  private checkBinCollections(): void {
    const apiUrl = `${environment.apiBaseUrl}/api/bin-collection`;
    
    this.http.get<ProcessedApiResponse>(apiUrl).subscribe({
      next: (data) => {
        this.evaluateCollections(data.collections);
      },
      error: (error) => {
        console.error('Failed to fetch bin collections for notification check:', error);
      }
    });
  }

  /**
   * Evaluate collections and show notification if appropriate
   */
  private evaluateCollections(collections: ProcessedCollectionDate[]): void {
    const now = new Date();
    const currentHour = now.getHours();

    // Find tomorrow's collection (daysUntil === 1)
    const tomorrowCollection = collections.find(c => c.daysUntil === 1);

    if (!tomorrowCollection) {
      // No collection tomorrow, clear any existing notification
      this.clearBinNotification();
      return;
    }

    // Show notification between 12:00 (noon) and 23:59 on the day before collection
    // This gives a ~12 hour window to put bins out
    if (currentHour >= 12) {
      this.showBinReminder(tomorrowCollection);
    } else {
      // Before noon, don't show the notification yet
      this.clearBinNotification();
    }
  }

  /**
   * Show bin collection reminder notification
   */
  private showBinReminder(collection: ProcessedCollectionDate): void {
    // Check if we've already shown notification for this specific collection
    const collectionKey = `${collection.date}-${collection.services.map(s => s.serviceType).join(',')}`;
    
    if (this.lastCheckedCollection === collectionKey) {
      // Already showing this notification, don't reset it
      return;
    }

    this.lastCheckedCollection = collectionKey;

    // Build the notification message using shared utils
    const binTypes = BinCollectionUtils.getBinTypesDescription(collection);
    const icon = BinCollectionUtils.getCollectionIcon(collection);

    const notification: NotificationData = {
      type: 'warning',
      title: 'Put bins out tonight!',
      message: `Tomorrow: ${binTypes}`,
      icon,
      metadata: { 
        collectionDate: collection.date,
        services: collection.services.map(s => s.serviceType)
      }
    };

    this.notificationService.setNotification(notification);
  }

  /**
   * Clear bin collection notification
   */
  private clearBinNotification(): void {
    const current = this.notificationService.notification();
    
    // Only clear if it's a bin notification
    if (current && current.metadata && 'collectionDate' in current.metadata) {
      this.notificationService.clearNotification();
      this.lastCheckedCollection = null;
    }
  }
}
