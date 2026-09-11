import { HttpInterceptorFn } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { API_BASE_URL } from './api-config';

/** Supplies "email:password" for the parent app; null when signed out. */
export const PARENT_CREDENTIALS = new InjectionToken<() => string | null>('PARENT_CREDENTIALS');

export const basicAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_BASE_URL);
  const creds = inject(PARENT_CREDENTIALS, { optional: true })?.();
  let r = req.url.startsWith('http') ? req : req.clone({ url: base + req.url });
  if (creds) r = r.clone({ setHeaders: { Authorization: `Basic ${btoa(creds)}` } });
  return next(r);
};
