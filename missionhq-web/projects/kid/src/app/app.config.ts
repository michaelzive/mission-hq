import { ApplicationConfig, inject, isDevMode, provideBrowserGlobalErrorListeners, provideEnvironmentInitializer } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { API_BASE_URL, DEVICE_TOKEN, deviceTokenInterceptor } from 'shared';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { UpdateService } from './core/update.service';
import { PushService } from './core/push.service';
import { SessionService } from './core/session.service';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([deviceTokenInterceptor])),
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
    {
      provide: DEVICE_TOKEN,
      useFactory: (s: SessionService) => () => s.deviceToken(),
      deps: [SessionService],
    },
    provideEnvironmentInitializer(() => { inject(UpdateService); inject(PushService); }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
