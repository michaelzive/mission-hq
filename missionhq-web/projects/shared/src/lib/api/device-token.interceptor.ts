import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL, DEVICE_TOKEN } from './api-config';

/** Prefixes relative API calls with the base URL and adds "Authorization: Device <token>" when paired. */
export const deviceTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_BASE_URL);
  const token = inject(DEVICE_TOKEN, { optional: true })?.();
  let r = req.url.startsWith('http') ? req : req.clone({ url: base + req.url });
  if (token) r = r.clone({ setHeaders: { Authorization: `Device ${token}` } });
  return next(r);
};
