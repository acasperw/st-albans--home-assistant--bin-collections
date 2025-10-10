import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./next-bin-collection/next-bin-collection').then(m => m.NextBinCollection)
  },
  {
    path: 'food',
    loadComponent: () => import('./food-inventory/food-inventory.component').then(m => m.FoodInventoryComponent)
  }
];