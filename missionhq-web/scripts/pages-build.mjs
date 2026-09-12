#!/usr/bin/env node
/**
 * Cloudflare Pages build entry point:  node scripts/pages-build.mjs <kid|parent>
 *
 * Pages builds every branch with the same command, so this script picks the Angular configuration from the
 * branch being built (CF_PAGES_BRANCH: `main` -> production, anything else -> dev) and injects the backend URL
 * from API_BASE_URL, which you define separately on the Pages "Production" and "Preview" environments.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const app = process.argv[2];
if (!['kid', 'parent'].includes(app)) {
  console.error('usage: node scripts/pages-build.mjs <kid|parent>');
  process.exit(1);
}
const branch = process.env.CF_PAGES_BRANCH ?? 'local';
const configuration = branch === 'main' ? 'production' : 'dev';
const apiBaseUrl = process.env.API_BASE_URL;
if (!apiBaseUrl) {
  console.error(`[pages-build] API_BASE_URL is not set for this Pages environment (branch "${branch}").`);
  process.exit(1);
}
const envFile = `projects/${app}/src/environments/environment.${configuration === 'production' ? 'prod' : 'dev'}.ts`;
const before = readFileSync(envFile, 'utf8');
const after = before.replace(/apiBaseUrl:\s*'[^']*'/, `apiBaseUrl: '${apiBaseUrl}'`);
if (!after.includes(`apiBaseUrl: '${apiBaseUrl}'`)) {
  console.error(`[pages-build] could not set apiBaseUrl in ${envFile}`);
  process.exit(1);
}
writeFileSync(envFile, after);
console.log(`[pages-build] app=${app} branch=${branch} configuration=${configuration} apiBaseUrl=${apiBaseUrl}`);
execSync(`npx ng build ${app} --configuration ${configuration}`, { stdio: 'inherit' });
