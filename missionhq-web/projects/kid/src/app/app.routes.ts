import { Routes } from '@angular/router';
import { pairedGuard } from './core/paired.guard';

export const routes: Routes = [
  { path: 'pair', loadComponent: () => import('./features/pair/pair.component').then(m => m.PairComponent) },
  { path: 'hq', canActivate: [pairedGuard], loadComponent: () => import('./features/hq/hq.component').then(m => m.HqComponent) },
  { path: 'shop', canActivate: [pairedGuard], loadComponent: () => import('./features/shop/shop.component').then(m => m.ShopComponent) },
  { path: 'locker', canActivate: [pairedGuard], loadComponent: () => import('./features/locker/locker.component').then(m => m.LockerComponent) },
  { path: 'squad', canActivate: [pairedGuard], loadComponent: () => import('./features/squad/squad.component').then(m => m.SquadComponent) },
  { path: '', pathMatch: 'full', redirectTo: 'hq' },
  { path: '**', redirectTo: 'hq' },
];
