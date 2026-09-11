import { ApplicationConfig, inject, isDevMode, provideBrowserGlobalErrorListeners, provideEnvironmentInitializer } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { API_BASE_URL, PARENT_CREDENTIALS, basicAuthInterceptor } from 'shared';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { UpdateService } from './core/update.service';
import { PushService } from './core/push.service';
import { AuthService } from './core/auth.service';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([basicAuthInterceptor])),
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
    {
      provide: PARENT_CREDENTIALS,
      useFactory: (a: AuthService) => () => a.credentials(),
      deps: [AuthService],
    },
    provideEnvironmentInitializer(() => { inject(UpdateService); inject(PushService); }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
