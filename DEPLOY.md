# Deploying Mission HQ

One hosting shape is automated and this is it:

| Piece | Runs on | Deployed by |
|---|---|---|
| Spring Boot API | Google Cloud Run, one service per branch (`develop` → `missionhq-dev`, `main` → `missionhq-prod`) | `.github/workflows/backend-deploy.yml` |
| Kid + parent PWAs | Cloudflare Pages, one project per app (`main` → production, `develop` → preview) | Pages' GitHub integration running `scripts/pages-build.mjs` |
| Postgres | Any managed Postgres reachable from Cloud Run | you, once |
| Photos | Cloudflare R2 (any S3-compatible bucket works) | you, once |

Both apps need HTTPS to install as PWAs and to receive push; Pages gives that for free. The API is reached cross-origin,
so `CORS_ORIGINS` on the backend and `API_BASE_URL` on Pages are what tie the two halves together.

Do the steps in order — later ones need URLs from earlier ones. Everything is set up twice (dev and prod) except the
GitHub repo and the service account.

## Where things live

| | dev | prod |
|---|---|---|
| Backend | `missionhq-dev` in GCP project `missionhq-zive`, `europe-west1` — https://missionhq-dev-qebt27j2ma-ew.a.run.app | `missionhq-prod`, same project/region — https://missionhq-prod-qebt27j2ma-ew.a.run.app |
| Database | Neon project `missionhq-dev` (Frankfurt) | Neon project `missionhq-prod` |
| Photos | R2 bucket `missionhq-photos-dev` | `missionhq-photos-prod` |
| Parent login | Firebase project `missionhq-dev`; the demo household belongs to `PARENT_EMAIL` | Firebase project `missionhq-prod`; `PARENT_EMAIL` links on first Google sign-in |

Secrets and variables are managed with the GitHub CLI: `gh secret set NAME --env dev` (prompts for the value) and
`gh variable set NAME --env dev --body VALUE`; `gh secret list --env dev` / `gh variable list --env dev` to review.

## 0. GitHub

1. Push this repo to GitHub and create a `develop` branch from `main`. Both workflows trigger on those two branches only.
2. Settings → Environments: create `dev` and `prod`. Each holds its own variables/secrets (listed in step 4), so the two
   deployments differ only by what is pasted there.

## 1. Postgres (once per environment)

Any Postgres 16 works. Recommended: [Neon](https://neon.tech) free tier — serverless, sleeps when idle like the Cloud Run
service does, no cost until you outgrow it. Cloud SQL is the "same cloud" option but has no free tier.

Create a database per environment and note the JDBC URL. Neon's looks like
`jdbc:postgresql://<host>/<db>?sslmode=require`. Neon shows two hosts; use the **direct** one (without `-pooler`) —
Flyway's migration lock needs a single session, which the pooled endpoint doesn't guarantee. Postgres 16 is what the
integration tests run against; a newer Neon default (18 at the time of writing) works but Flyway logs an "untested
version" warning on startup.

Flyway creates the schema on first boot (`db/migration`); the `dev` Spring profile also loads `db/seed` (demo household,
kids, and the `dev-token-viper` / `dev-token-nova` device tokens — these are public knowledge, so the dev API is only
ever demo data).

## 2. Cloudflare R2 (once per environment)

The deploy workflow hard-codes `STORAGE_TYPE=s3`; Cloud Run has no persistent disk, so a bucket is not optional.

1. R2 → Create bucket, e.g. `missionhq-photos-prod` / `missionhq-photos-dev`.
2. R2 → Manage API tokens → create a token with **Object Read & Write** on that bucket. Save the Access Key ID and
   Secret Access Key; the S3 endpoint is `https://<account-id>.r2.cloudflarestorage.com`.
3. Bucket → Settings → CORS policy. The kid app `PUT`s the photo straight to a presigned URL from the browser, so the
   bucket must allow it from the kid app's origin (fill in after step 6 if you prefer, but don't forget):
   ```json
   [{
     "AllowedOrigins": ["https://missionhq-kid.pages.dev"],
     "AllowedMethods": ["PUT", "GET"],
     "AllowedHeaders": ["Content-Type"],
     "MaxAgeSeconds": 3600
   }]
   ```
   Region is `auto`. Photos are private; the API hands out 30-minute signed view links and purges approved photos after
   `photo-ttl-days` (30).

## 3. Google Cloud (once)

1. Create a project; enable **Cloud Run**, **Cloud Build** and **Artifact Registry** APIs.
2. Create a service account for GitHub Actions with roles: Cloud Run Admin, Cloud Build Editor, Artifact Registry
   Administrator, Storage Admin (Cloud Build stages the source in a bucket), Service Account User.
3. Create a JSON key for it — that is `GCP_SA_KEY`.

The workflow deploys from source (`source: missionhq-backend/missionhq`), so Cloud Build builds the `Dockerfile` for
you; nothing to build or push locally. The service runs with `--min-instances=0`, so it scales to zero and cold-starts in
a few seconds — fine for a family, revisit if it ever annoys you.

## 4. GitHub environment variables and secrets

Set these on **both** `dev` and `prod` (values differ). Names are exactly what `backend-deploy.yml` reads.

| Kind | Name | Value |
|---|---|---|
| secret | `GCP_SA_KEY` | JSON key from step 3 (same for both) |
| var | `GCP_PROJECT_ID` | GCP project id |
| var | `GCP_REGION` | e.g. `europe-west1` |
| secret | `DB_URL` | JDBC URL from step 1 |
| secret | `DB_USER` / `DB_PASSWORD` | from step 1 |
| var | `PARENT_EMAIL` | prod: your sign-in email — `ParentBootstrap` creates the first household + parent from these on first boot. dev: your own Gmail. The dev seed (`db/seed/V9`) hands the demo household to it, so signing in with Google lands among the demo kids. Set it **before** the first deploy that applies V9: that seed runs once, and a later change makes `ParentBootstrap` create a new empty household instead |
| secret | `PARENT_PASSWORD` | rotate any time; the backend re-syncs the stored hash on startup. Backs the household-password sign-in kept during the move to Firebase |
| var | `FIREBASE_PROJECT_ID` | the Firebase project ID from step 6a (`missionhq-dev` on dev, `missionhq-prod` on prod). Empty = Firebase sign-in off, household password only |
| var | `ADMIN_EMAILS` | parents who may invite a new family (Kids → Parents → Invite a family), **space**-separated like `CORS_ORIGINS`. Empty = nobody. Locally the dev profile defaults it to `PARENT_EMAIL` |
| var | `CORS_ORIGINS` | **space**-separated Pages origins from step 6, e.g. `https://missionhq-kid.pages.dev https://missionhq-parent.pages.dev` (dev: the `develop.` branch aliases). Not commas — the deploy action uses commas to separate env vars and silently drops everything after the first |
| secret | `STORAGE_SECRET` | any long random string (signs photo URLs); `openssl rand -hex 32` |
| var | `S3_ENDPOINT` / `S3_BUCKET` | from step 2 |
| secret | `S3_ACCESS_KEY` / `S3_SECRET_KEY` | from step 2 |
| var | `VAPID_PUBLIC_KEY` / `VAPID_SUBJECT` | step 7; leave empty until then (push is silently off) |
| secret | `VAPID_PRIVATE_KEY` | step 7 |

`CORS_ORIGINS` depends on the Pages project names you pick in step 6; pages.dev subdomains are `<project>.pages.dev`,
so choose the names now and fill this in before the first backend deploy.

## 5. First backend deploy

Push to `develop`. The workflow deploys `missionhq-dev` and curls `/actuator/health`. The Cloud Run URL is in the
job summary and in the GitHub environment's "deployment" link — you need it for step 6.

The workflow only runs when a push touches `missionhq-backend/**` (or the workflow file). To deploy after changing only
secrets or variables, trigger it by hand: `gh workflow run backend-deploy.yml --ref develop` (or `--ref main`), then
`gh run watch`.

Check the logs for `Bootstrapped household 1 with parent <email>`, then: `curl -u <email>:<password> <url>/api/v1/household`.

Merge to `main` for prod once dev works end to end.

## 6. Cloudflare Pages (two projects per repo)

Workers & Pages → Create → **Pages** → connect the GitHub repo. Do this twice:

Make sure you are on the Pages tab. Connecting the repo from the Workers side ("Import a repository") creates a
**Worker** named after the repo (`mission-hq`) instead. Its build runs `npx wrangler versions upload` and fails on every
push with `Missing entry-point to Worker script or to assets directory`, because this repo has no Worker. If one shows
up, check its Settings → Domains & Routes is empty and delete it. Workers & Pages should list exactly
`missionhq-kid` and `missionhq-parent`.

| Setting | Kid app | Parent app |
|---|---|---|
| Project name | `missionhq-kid` | `missionhq-parent` |
| Production branch | `main` | `main` |
| Root directory | `missionhq-web` | `missionhq-web` |
| Build command | `npm run build:pages:kid` | `npm run build:pages:parent` |
| Build output directory | `dist/kid/browser` | `dist/parent/browser` |

Environment variables, set separately for **Production** and **Preview**:

- `NODE_VERSION` = an exact current release, e.g. `24.21.0` — Angular 22.1 requires Node ≥ 24.15, and a bare `24` resolved to an older 24.x on Pages (`EBADENGINE` warnings in the build log)
- `API_BASE_URL` = the Cloud Run URL from step 5 plus `/api/v1` — prod URL on Production, dev URL on Preview.
  `scripts/pages-build.mjs` writes it into `environment.prod.ts` / `environment.dev.ts` at build time and refuses to
  build without it.

Preview deployments build every non-`main` branch; the stable alias for `develop` is `https://develop.<project>.pages.dev`.
Pages only builds a branch when a push to it arrives *after* the project was connected, so a freshly connected project
has a production build but no preview (or vice versa) until the next push to the other branch; a failed first build
stays failed until "Retry deployment" or a new push.
`public/_redirects` already handles SPA routing. If `CORS_ORIGINS` on the backend doesn't list these origins exactly
(scheme + host, no trailing slash), the app loads but every API call fails in the console. To check what a running
service actually has: `gcloud run services describe missionhq-prod --region europe-west1 --format='value(spec.template.spec.containers[0].env)'`.

Custom domains are optional — pages.dev is HTTPS and installable. If you add one, add it to `CORS_ORIGINS` and the R2 CORS
policy too.

## 6a. Firebase Authentication (parent sign-in, once per environment)

Firebase holds parents' sign-in accounts (Google and email/password) and sends the verification and password-reset
emails. The backend never sees a password: it checks that each request's token was issued by *its* Firebase project.
Use a Firebase project of its own, not the Cloud Run project; a Google Cloud project can hold only one.

1. https://console.firebase.google.com → **Create a project** (`MissionHQ Dev` / `MissionHQ`), Google Analytics off. Note
   the project ID it shows.
2. **Build → Authentication → Get started → Sign-in method**: enable **Email/Password** (first toggle only) and
   **Google** (public name `Mission HQ`, your support email).
3. **Authentication → Settings → Authorized domains**: add the parent app's origin host (`develop.missionhq-parent.pages.dev`
   on dev, `missionhq-parent.pages.dev` on prod). Dev also needs `localhost`: projects created after April 2025 no longer
   include it by default. Under **User account linking**, keep **Link accounts that use the same email**.
4. **Project settings → General → Your apps → Web (`</>`)**, no Firebase Hosting. Copy `apiKey`, `authDomain`,
   `projectId` and `appId` into `firebase` in `missionhq-web/projects/parent/src/environments/environment.dev.ts` (and
   `environment.ts` for local runs) or `environment.prod.ts`. These values are public by design; the authorized domains
   and the backend's project check are what protect it.
5. Set `FIREBASE_PROJECT_ID` on the GitHub environment (step 4) and redeploy the backend.

## 7. Push notifications (optional, but the point of the parent app)

Generate a key pair once per environment:
```bash
npx web-push generate-vapid-keys
```
Set `VAPID_PUBLIC_KEY` (var), `VAPID_PRIVATE_KEY` (secret) and `VAPID_SUBJECT` (var, `mailto:you@example.com`) in the GitHub
environment and redeploy the backend. Without a public key the backend logs `Push disabled` and everything else works.

Push only arrives in the **installed** app (production build, HTTPS) — not in a browser tab.

## 8. Devices

1. Parent app: sign in with Google as `PARENT_EMAIL` (or, until Firebase is on in that environment, the household
   password `PARENT_EMAIL` / `PARENT_PASSWORD`), then Kids → generate a pairing code.
2. Kid tablet: open the kid app URL in Chrome, enter the code, accept "Add to home screen" and the alerts prompt. The
   device token is stored on the tablet; the code is single-use.
3. Parent phone: open the parent app, "Add to home screen", turn on alerts from the header.

Kids, missions (for everyone or directed at one kid) and rewards are all managed from the parent app.

## Operating it

**Releasing to prod** — test on dev first, then fast-forward `main` to `develop` so history stays linear:
`git push origin develop:main` (it refuses if `main` has commits `develop` lacks). That push runs CI, CodeQL and
"Deploy backend" (only if `missionhq-backend/**` changed) on GitHub, and the Pages production builds on Cloudflare.
To confirm a new migration ran, read the startup log:
```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="missionhq-prod" AND textPayload:"Successfully applied"' --freshness=1h --limit=3 --format="value(timestamp,textPayload)"
```

**Installed apps update themselves.** Each app's `UpdateService` checks for a new version on launch and hourly, then
activates it and reloads once the screen is idle. Nobody reinstalls; closing and reopening the app picks it up sooner.
The flip side: for up to an hour, devices still run the *previous* app against the *new* backend. Keep API changes
additive (new optional fields; Spring ignores fields it doesn't know, and old apps ignore new ones). Don't rename or
remove a field until a release after the last app that used it has gone.

**Rollback** — Cloud Run keeps every revision. Cloud Run → service → Revisions → "Manage traffic" → 100% to the previous
revision, or `gcloud run services update-traffic missionhq-prod --to-revisions=<revision>=100`. Pages: Deployments →
"Rollback to this deployment".

**Migrations are forward-only.** `spring.jpa.hibernate.ddl-auto=validate` means a rolled-back image will refuse to start
if the schema no longer matches its entities. Write migrations expand/contract: add columns/tables in one release, drop
old ones only after the previous release is gone. Never edit an applied migration, `db/seed` included; Flyway checksums
it. If you do, startup fails with what looks like a bean error (`Error creating bean with name 'deviceTokenFilter'` …
`entityManagerFactory`). The real cause is in the last `Caused by`: `Migration checksum mismatch for migration version N`.
On dev/prod, revert the edit and put the change in a new migration. Avoid `flyway repair` if the file's content really
changed: it only accepts the new checksum and leaves the database as the old version made it.

**Secrets rotation** — change the value in the GitHub environment and re-run the "Deploy backend" workflow
(`workflow_dispatch`); Cloud Run picks up env vars per revision.

**Costs** — Cloud Run scale-to-zero, Neon free tier, R2 free tier (10 GB) and Pages are all $0 at family scale.

## Local development is unchanged

`docker compose up -d` + the IntelliJ `backend` run config (or `SPRING_PROFILES_ACTIVE=dev ./mvnw spring-boot:run`) and
`npm start` / `npm run start:parent`. Local uses `STORAGE_TYPE=local` and no CORS config; nothing here applies.

- **Your email, once:** create `missionhq-backend/missionhq/config/application-local.yml` (gitignored) with
  `missionhq: { parent: { email: you@gmail.com } }`. The IntelliJ `backend` run config uses profiles `dev,local`, and
  the `local` profile loads that file; from a terminal, set `SPRING_PROFILES_ACTIVE=dev,local` the same way. Without it,
  every start creates an empty household for `dad@example.com`, and nobody is a local admin.
- **Parent sign-in:** Google as that email; local runs use the `missionhq-dev` Firebase project. The dev seed hands the
  demo household to that address once per database, and the dev profile makes it an admin (Invite a family). The
  household password (your email / `change-me`) still works during the transition.
- **"http proxy error … ECONNREFUSED" in the parent dev server:** the backend isn't listening yet. The `stack` run config
  starts all three apps at once and Spring takes a few seconds; reload once you see `Started MissionHqApplication`.
  The login page says "Could not reach the HQ server" when the backend is down and "Wrong email or password" only on a
  real 401. On a deployed app, the unreachable message means the backend is down, `API_BASE_URL` is wrong, or
  `CORS_ORIGINS` doesn't list the page's origin.
- **Kid tablets:** pair from the parent app's Kids → New pairing code. The pairing lives in the browser, so use a
  private window to be a second kid at the same time.
- **Checksum mismatch on startup:** the local database was built from an older copy of a migration or seed file.
  Local data is only the demo seed, so rebuild it: `docker compose down -v && docker compose up -d`, then start the
  backend, which reapplies everything.
- **Port 8080 already in use:** stopping `spring-boot:run` can leave its Java process behind. On Windows,
  `Get-NetTCPConnection -LocalPort 8080 | Select OwningProcess`, then stop that process.
