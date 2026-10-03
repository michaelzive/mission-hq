import type { FirebaseOptions } from 'firebase/app';

export const environment = {
  production: true,
  /**
   * Deployed DEV environment (Cloudflare Pages preview branch `develop`). The URL is injected at build time by
   * scripts/pages-build.mjs from the API_BASE_URL variable on that Pages environment; this value is a placeholder.
   */
  apiBaseUrl: 'https://missionhq-dev.example.run.app/api/v1',
  /** Firebase project parents sign in with (the dev one). Not a secret: access is gated by Firebase's authorized domains and the backend. */
  firebase: {
    apiKey: 'AIzaSyAeerpJcMutXRvcAwlRv2drKFLdsSJqgFI',
    authDomain: 'missionhq-dev.firebaseapp.com',
    projectId: 'missionhq-dev',
    appId: '1:272149066094:web:ddcc451eeb352ba8d2517f',
  } as FirebaseOptions | null,
};
