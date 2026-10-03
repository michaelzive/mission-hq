import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Only parents in a household get past; anyone else (signed out, unverified, no invite yet) lands on /login, which explains why. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService), router = inject(Router);
  try { return (await auth.isParent()) || router.createUrlTree(['/login']); }
  catch { return router.createUrlTree(['/login']); }
};
