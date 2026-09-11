import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

export const pairedGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  return session.isPaired() ? true : inject(Router).createUrlTree(['/pair']);
};
