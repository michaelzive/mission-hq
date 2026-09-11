import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent) },
  {
    path: '', canActivate: [authGuard],
    loadComponent: () => import('./shell.component').then(m => m.ShellComponent),
    children: [
      { path: 'approvals', loadComponent: () => import('./features/approvals/approvals.component').then(m => m.ApprovalsComponent) },
      { path: 'kids', loadComponent: () => import('./features/kids/kids.component').then(m => m.KidsComponent) },
      { path: '', pathMatch: 'full', redirectTo: 'approvals' },
    ],
  },
  { path: '**', redirectTo: 'approvals' },
];
