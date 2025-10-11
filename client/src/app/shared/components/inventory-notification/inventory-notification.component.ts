import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { InventoryNotificationService } from '../../services/inventory-notification.service';
import { NotificationComponent } from '../notification/notification.component';

/**
 * Example inventory notification component showing how the generic system can be reused
 * Usage: <app-inventory-notification [active]="true" [allowDismiss]="true" />
 */
@Component({
  selector: 'app-inventory-notification',
  imports: [NotificationComponent],
  template: `
    <app-notification
      [notification]="inventoryService.notification()"
      [active]="active()"
      [allowDismiss]="allowDismiss()"
      (dismiss)="dismissNotification()">
    </app-notification>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryNotificationComponent {
  protected inventoryService = inject(InventoryNotificationService);
  
  // Show when active
  public active = input<boolean>(true);
  
  // Allow dismissing inventory notifications by default
  public allowDismiss = input<boolean>(true);

  public dismissNotification(): void {
    this.inventoryService.clearNotification();
  }

  // Example usage methods (would be called from your inventory management logic)
  public checkStockLevel(itemName: string, stockLevel: number, minimumThreshold: number): void {
    this.inventoryService.checkInventoryLevel(itemName, stockLevel, minimumThreshold);
  }
}