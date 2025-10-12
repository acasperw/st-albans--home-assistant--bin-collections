import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FoodInventoryService, FoodItem, AddFoodItemRequest } from '../shared/services/food-inventory.service';
import { BarcodeListenerService } from '../shared/services/barcode-listener.service';
import { OpenFoodFactsService } from '../shared/services/open-food-facts.service';

@Component({
  selector: 'app-food-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './food-inventory.component.html',
  styleUrl: './food-inventory.component.scss'
})
export class FoodInventoryComponent implements OnInit {
  private foodService = inject(FoodInventoryService);
  private barcodeService = inject(BarcodeListenerService);
  private openFoodFacts = inject(OpenFoodFactsService);
  private router = inject(Router);

  // UI state
  public showAddForm = signal(false);
  public lastScannedCode = signal<string | null>(null);
  public fetchingProductInfo = signal(false);

  // Form data
  public newItem = signal<Partial<AddFoodItemRequest>>({
    name: '',
    expiry: '',
    quantity: 1,
    source: 'manual'
  });

  // Quick access to service data
  public items = this.foodService.activeItems;
  public expiringSoon = this.foodService.expiringSoon;
  public loading = this.foodService.loading;
  public error = this.foodService.error;

  constructor() {
    // React to barcode scans
    effect(() => {
      const scannedCode = this.barcodeService.lastScan();
      if (scannedCode && scannedCode !== this.lastScannedCode()) {
        this.handleBarcodeScan(scannedCode);
        this.lastScannedCode.set(scannedCode);
      }
    });
  }

  ngOnInit(): void {
    this.foodService.loadItems().subscribe();
  }

  /**
   * Handle a barcode scan
   */
  handleBarcodeScan(code: string): void {
    console.log('Processing barcode:', code);
    
    // Validate barcode
    if (!BarcodeListenerService.isValidBarcode(code)) {
      alert(`Invalid barcode: ${code}`);
      return;
    }

    // Check if item already exists
    const existingItem = this.items().find(item => item.barcode === code);
    if (existingItem) {
      // Increment quantity
      this.foodService.updateItem(existingItem.id, { 
        quantity: existingItem.quantity + 1 
      }).subscribe();
      this.showToast(`Increased quantity of ${existingItem.name}`);
      return;
    }

    // Fetch product info from Open Food Facts
    this.fetchingProductInfo.set(true);
    this.showToast(`🔍 Looking up product...`);

    this.openFoodFacts.getProduct(code).subscribe(productInfo => {
      this.fetchingProductInfo.set(false);

      // Default expiry: 5 days from now
      const defaultExpiry = new Date();
      defaultExpiry.setDate(defaultExpiry.getDate() + 5);

      if (productInfo.found && productInfo.name) {
        // Product found! Pre-fill the form
        this.newItem.set({
          barcode: code,
          name: productInfo.name,
          category: productInfo.category,
          expiry: defaultExpiry.toISOString().split('T')[0],
          quantity: 1,
          notes: productInfo.brand ? `Brand: ${productInfo.brand}` : undefined,
          source: 'scan'
        });
        this.showToast(`✅ Found: ${productInfo.name}`);
      } else {
        // Product not found - open form with just barcode
        this.newItem.set({
          barcode: code,
          name: '',
          category: undefined,
          expiry: defaultExpiry.toISOString().split('T')[0],
          quantity: 1,
          source: 'scan'
        });
        this.showToast(`⚠️ Product not found - please enter details manually`);
      }

      this.showAddForm.set(true);
    });
  }

  /**
   * Open the add item form
   */
  openAddForm(): void {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 5); // Default 5 days
    
    this.newItem.set({
      name: '',
      expiry: tomorrow.toISOString().split('T')[0],
      quantity: 1,
      source: 'manual'
    });
    this.showAddForm.set(true);
  }

  /**
   * Close the add item form
   */
  closeAddForm(): void {
    this.showAddForm.set(false);
    this.newItem.set({
      name: '',
      expiry: '',
      quantity: 1,
      source: 'manual'
    });
  }

  /**
   * Submit the add item form
   */
  submitAddForm(): void {
    const item = this.newItem();
    
    if (!item.name || !item.expiry) {
      alert('Name and expiry date are required');
      return;
    }

    const addRequest: AddFoodItemRequest = {
      barcode: item.barcode,
      name: item.name,
      category: item.category,
      expiry: item.expiry,
      quantity: item.quantity || 1,
      notes: item.notes,
      source: item.source || 'manual'
    };

    this.foodService.addItem(addRequest).subscribe(result => {
      if (result) {
        this.closeAddForm();
        this.showToast(`Added ${item.name}`);
      }
    });
  }

  /**
   * Mark item as used
   */
  markAsUsed(item: FoodItem): void {
    this.foodService.markAsUsed(item.id).subscribe(() => {
      this.showToast(`Marked ${item.name} as used`);
    });
  }

  /**
   * Mark item as discarded
   */
  markAsDiscarded(item: FoodItem): void {
    this.foodService.markAsDiscarded(item.id).subscribe(() => {
      this.showToast(`Marked ${item.name} as discarded`);
    });
  }

  /**
   * Extend expiry by 1 day
   */
  extendExpiry(item: FoodItem): void {
    this.foodService.extendExpiry(item.id, 1).subscribe(() => {
      this.showToast(`Extended ${item.name} by 1 day`);
    });
  }

  /**
   * Delete item
   */
  deleteItem(item: FoodItem): void {
    if (confirm(`Delete ${item.name}?`)) {
      this.foodService.deleteItem(item.id).subscribe(() => {
        this.showToast(`Deleted ${item.name}`);
      });
    }
  }

  /**
   * Get days until expiry
   */
  getDaysUntilExpiry(expiryDate: string): number {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get expiry status class
   */
  getExpiryClass(expiryDate: string): string {
    const days = this.getDaysUntilExpiry(expiryDate);
    if (days < 0) return 'expired';
    if (days === 0) return 'expires-today';
    if (days === 1) return 'expires-tomorrow';
    if (days <= 3) return 'expires-soon';
    return 'expires-later';
  }

  /**
   * Format expiry display text
   */
  getExpiryText(expiryDate: string): string {
    const days = this.getDaysUntilExpiry(expiryDate);
    if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
    if (days === 0) return 'Expires today';
    if (days === 1) return 'Expires tomorrow';
    return `Expires in ${days} day${days === 1 ? '' : 's'}`;
  }

  /**
   * Update form field
   */
  updateFormField(field: keyof AddFoodItemRequest, value: any): void {
    this.newItem.update(item => ({ ...item, [field]: value }));
  }

  /**
   * Show a toast message (simple implementation)
   */
  private showToast(message: string): void {
    // Simple toast - could be replaced with a proper toast service
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 10000;
      background: #333; color: white; padding: 12px 16px;
      border-radius: 4px; font-size: 14px; max-width: 300px;
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  /**
   * Navigate back to bins page
   */
  navigateBack(): void {
    this.router.navigate(['/']);
  }
}