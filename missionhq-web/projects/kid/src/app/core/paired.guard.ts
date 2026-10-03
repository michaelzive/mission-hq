import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

/** Not paired → pair; a shared tablet with nobody picked → who's reporting; otherwise in. */
export const pairedGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  if (!session.isPaired()) return inject(Router).createUrlTree(['/pair']);
  return session.current() ? true : inject(Router).createUrlTree(['/who']);
};
