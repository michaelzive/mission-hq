import { Routes } from '@angular/router';
import { pairedGuard } from './core/paired.guard';

export const routes: Routes = [
  { path: 'pair', loadComponent: () => import('./features/pair/pair.component').then(m => m.PairComponent) },
  { path: 'who', loadComponent: () => import('./features/who/who.component').then(m => m.WhoComponent) },
  { path: 'hq', canActivate: [pairedGuard], loadComponent: () => import('./features/hq/hq.component').then(m => m.HqComponent) },
  { path: 'shop', canActivate: [pairedGuard], loadComponent: () => import('./features/shop/shop.component').then(m => m.ShopComponent) },
  { path: 'locker', canActivate: [pairedGuard], loadComponent: () => import('./features/locker/locker.component').then(m => m.LockerComponent) },
  { path: 'squad', canActivate: [pairedGuard], loadComponent: () => import('./features/squad/squad.component').then(m => m.SquadComponent) },
  // 3D avatar spike: unlinked and unguarded (it calls no API) so it can be opened straight on a tablet.
  { path: 'avatar-lab', loadComponent: () => import('./features/avatar-lab/avatar-lab.component').then(m => m.AvatarLabComponent) },
  { path: '', pathMatch: 'full', redirectTo: 'hq' },
  { path: '**', redirectTo: 'hq' },
];
