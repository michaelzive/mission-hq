import type { FirebaseOptions } from 'firebase/app';

export const environment = {
  production: true,
  /** Injected at build time by scripts/pages-build.mjs from API_BASE_URL on the Pages Production environment. Relative works only when the API shares the origin. */
  apiBaseUrl: '/api/v1',
  /** No prod Firebase project yet: the parent app offers only the household password (HTTP Basic) sign-in. */
  firebase: null as FirebaseOptions | null,
};
