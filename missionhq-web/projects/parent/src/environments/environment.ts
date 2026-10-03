import type { FirebaseOptions } from 'firebase/app';

export const environment = {
  production: false,
  /** Relative: the dev server proxies /api to Spring Boot on :8080. */
  apiBaseUrl: '/api/v1',
  /** Firebase project parents sign in with (the dev one). Not a secret: access is gated by Firebase's authorized domains and the backend. */
  firebase: {
    apiKey: 'AIzaSyAeerpJcMutXRvcAwlRv2drKFLdsSJqgFI',
    authDomain: 'missionhq-dev.firebaseapp.com',
    projectId: 'missionhq-dev',
    appId: '1:272149066094:web:ddcc451eeb352ba8d2517f',
  } as FirebaseOptions | null,
};
