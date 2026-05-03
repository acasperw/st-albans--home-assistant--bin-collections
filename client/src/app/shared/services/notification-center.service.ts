import { Injectable, computed, signal } from '@angular/core';

export type NotificationType = 'info' | 'warning' | 'error' | 'success';

/**
 * A category groups related notifications from the same source. Sources can
 * clear all of their notifications at once via `clearCategory()`.
 */
export type NotificationCategory =
  | 'bin-collection'
  | 'temperature'
  | 'barcode'
  | string;

export interface Notification {
  /**
   * Stable identifier for this notification. Used for de-duplication and
   * dismissal memory: re-publishing the same id while it's dismissed is a
   * no-op until `resetDismissals()` is called.
   */
  id: string;
  category: NotificationCategory;
  type: NotificationType;
  title: string;
  message: string;
  icon?: string;
  createdAt: number;
  /** Ms after which the notification self-expires (omit for no expiry). */
  maxAgeMs?: number;
  /** Higher = preferred when cycling. Default 0. */
  priority?: number;
  /** User can tap to dismiss while NOT idle. Default true. */
  dismissible?: boolean;
  /** User can tap to dismiss while idle. Default true. */
  dismissibleWhenIdle?: boolean;
}

/**
 * Single source of truth for app-wide notifications.
 *
 * Sources (bin-collection, temperature, barcode, …) call `publish()` /
 * `clearCategory()` on this service. The notification wrapper component reads
 * the `active` signal, cycles between entries, and dispatches user dismissals
 * back via `dismiss()`.
 */
@Injectable({ providedIn: 'root' })
export class NotificationCenter {
  private items = signal<Notification[]>([]);
  private dismissedIds = signal<Set<string>>(new Set());

  /** Currently visible notifications: not dismissed, not stale, sorted by priority desc then age. */
  public readonly active = computed<Notification[]>(() => {
    const dismissed = this.dismissedIds();
    const now = Date.now();
    return this.items()
      .filter(n => !dismissed.has(n.id))
      .filter(n => !n.maxAgeMs || now - n.createdAt <= n.maxAgeMs)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.createdAt - b.createdAt);
  });

  public readonly hasAny = computed(() => this.active().length > 0);

  /** Add or replace a notification by id. No-op if currently dismissed. */
  publish(notification: Notification): void {
    if (this.dismissedIds().has(notification.id)) return;
    this.items.update(list => {
      const filtered = list.filter(n => n.id !== notification.id);
      return [...filtered, notification];
    });
  }

  /** Remove a notification by id. Does NOT mark it as dismissed (use `dismiss` for that). */
  clear(id: string): void {
    this.items.update(list => list.filter(n => n.id !== id));
  }

  /** Remove every notification in the given category. */
  clearCategory(category: NotificationCategory): void {
    this.items.update(list => list.filter(n => n.category !== category));
  }

  /**
   * User-initiated dismissal: removes the notification AND remembers the id so
   * subsequent `publish()` calls with the same id stay quiet until
   * `resetDismissals()` is called (e.g. on barcode scan or data refresh).
   */
  dismiss(id: string): void {
    this.items.update(list => list.filter(n => n.id !== id));
    this.dismissedIds.update(set => {
      const next = new Set(set);
      next.add(id);
      return next;
    });
  }

  /** Clear dismissal memory so previously-dismissed notifications can re-appear. */
  resetDismissals(): void {
    this.dismissedIds.set(new Set());
  }
}
