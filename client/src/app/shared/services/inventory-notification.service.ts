import { Injectable } from '@angular/core';
import { NotificationService, NotificationData } from './notification.service';

export interface InventoryNotification extends NotificationData {
  itemName: string;
  stockLevel: number;
  minimumThreshold: number;
}

/**
 * Example service for inventory stock control notifications
 * Extends the generic NotificationService for inventory-specific logic
 */
@Injectable({
  providedIn: 'root'
})
export class InventoryNotificationService extends NotificationService {

  /**
   * Check inventory levels and set appropriate notifications
   * @param itemName The name of the inventory item
   * @param stockLevel Current stock level
   * @param minimumThreshold Minimum required stock level
   */
  public checkInventoryLevel(itemName: string, stockLevel: number, minimumThreshold: number): void {
    let notification: InventoryNotification | null = null;
    
    if (stockLevel === 0) {
      notification = {
        type: 'error',
        title: `${itemName} - Out of Stock`,
        message: `Immediate reorder required`,
        icon: '🚨',
        itemName,
        stockLevel,
        minimumThreshold,
        metadata: { severity: 'critical', priority: 'urgent' }
      };
    } else if (stockLevel <= minimumThreshold) {
      notification = {
        type: 'warning',
        title: `${itemName} - Low Stock`,
        message: `Only ${stockLevel} units remaining`,
        icon: '⚠️',
        itemName,
        stockLevel,
        minimumThreshold,
        metadata: { severity: 'medium', priority: 'normal' }
      };
    } else if (stockLevel <= minimumThreshold * 1.5) {
      notification = {
        type: 'info',
        title: `${itemName} - Stock Notice`,
        message: `Consider reordering soon (${stockLevel} units left)`,
        icon: 'ℹ️',
        itemName,
        stockLevel,
        minimumThreshold,
        metadata: { severity: 'low', priority: 'low' }
      };
    }

    this.setNotification(notification);
  }

  /**
   * Override suppression logic to consider item name and stock level
   */
  protected override isNotificationSuppressed(
    notification: NotificationData, 
    suppressed: NotificationData | null
  ): boolean {
    if (!suppressed) return false;
    
    // For inventory notifications, also check item name and stock level
    const invNotification = notification as InventoryNotification;
    const invSuppressed = suppressed as InventoryNotification;
    
    return notification.type === suppressed.type &&
           notification.message === suppressed.message &&
           invNotification.itemName === invSuppressed.itemName &&
           invNotification.stockLevel === invSuppressed.stockLevel;
  }
}