import { InjectionToken } from '@angular/core';

/** Base URL of the Spring Boot API, e.g. '/api/v1' behind the dev proxy or 'https://api.example.com/api/v1'. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');

/** Supplies the device token for kid requests; the kid app provides this from its session. */
export const DEVICE_TOKEN = new InjectionToken<() => string | null>('DEVICE_TOKEN');
