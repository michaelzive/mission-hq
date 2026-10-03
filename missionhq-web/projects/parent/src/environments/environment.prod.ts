import type { FirebaseOptions } from 'firebase/app';

export const environment = {
  production: true,
  /** Injected at build time by scripts/pages-build.mjs from API_BASE_URL on the Pages Production environment. Relative works only when the API shares the origin. */
  apiBaseUrl: '/api/v1',
  /** Firebase project parents sign in with (the prod one). Not a secret: access is gated by Firebase's authorized domains and the backend. */
  firebase: {
    apiKey: 'AIzaSyCk4KmUTcvGvbPXGa76STVJ8RL09lkY2zA',
    authDomain: 'missionhq-prod.firebaseapp.com',
    projectId: 'missionhq-prod',
    appId: '1:539493840427:web:9e2c0e91a03898bf129c6e',
  } as FirebaseOptions | null,
};
