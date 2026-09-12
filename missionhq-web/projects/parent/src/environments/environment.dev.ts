export const environment = {
  production: true,
  /**
   * Deployed DEV environment (Cloudflare Pages preview branch `develop`). The URL is injected at build time by
   * scripts/pages-build.mjs from the API_BASE_URL variable on that Pages environment; this value is a placeholder.
   */
  apiBaseUrl: 'https://missionhq-dev.example.run.app/api/v1',
};
