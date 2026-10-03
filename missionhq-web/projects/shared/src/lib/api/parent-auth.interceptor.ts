import { HttpInterceptorFn } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { API_BASE_URL } from './api-config';

/**
 * Supplies the parent app's Authorization header value ("Bearer <Firebase ID token>" or "Basic …"), or null when signed
 * out. Async because Firebase refreshes the token itself when it is close to expiry.
 */
export const PARENT_AUTHORIZATION = new InjectionToken<() => Promise<string | null>>('PARENT_AUTHORIZATION');

/** Prefixes relative API calls with the base URL and signs them. Absolute URLs (presigned photo links) never get the header. */
export const parentAuthInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.startsWith('http')) return next(req);
  const r = req.clone({ url: inject(API_BASE_URL) + req.url });
  const authorization = inject(PARENT_AUTHORIZATION, { optional: true });
  if (!authorization) return next(r);
  return from(authorization()).pipe(switchMap(h => next(h ? r.clone({ setHeaders: { Authorization: h } }) : r)));
};
