import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';

function isPhone(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPod|Windows Phone|IEMobile|Mobile/i.test(navigator.userAgent);
}

function phoneRedirectGuard(): true | ReturnType<Router['parseUrl']> {
  if (!isPhone()) return true;
  return inject(Router).parseUrl('/meals');
}

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canMatch: [phoneRedirectGuard],
    loadComponent: () => import('./next-bin-collection/next-bin-collection').then(m => m.NextBinCollection)
  },
  {
    path: 'meals',
    loadComponent: () => import('./meals/meals').then(m => m.MealsComponent)
  },
  {
    path: 'meals/admin',
    loadComponent: () => import('./meals/admin/admin').then(m => m.MealAdminComponent)
  }
];