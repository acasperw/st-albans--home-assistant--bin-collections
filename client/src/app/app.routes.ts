import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./next-bin-collection/next-bin-collection').then(m => m.NextBinCollection)
  },
  {
    path: 'train',
    loadComponent: () => import('./next-train/next-train.component').then(m => m.NextTrainComponent)
  }
];