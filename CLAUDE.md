# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Monorepo with two independently built/deployed projects:
- `missionhq-backend/missionhq/` — Spring Boot 3.3, Java 21, PostgreSQL, Flyway.
- `missionhq-web/` — Angular 22 multi-project workspace: `projects/kid` (tablet app), `projects/parent` (admin app), `projects/shared` (API client, DTOs, theming — consumed straight from source via `tsconfig` paths, no library build step needed for dev).

## Commands

### Backend (run from `missionhq-backend/missionhq`)
```bash
docker compose up -d              # Postgres 16 on :5432
./mvnw spring-boot:run             # run the app (SPRING_PROFILES_ACTIVE=dev loads db/seed demo data)
./mvnw -B verify                   # full build + unit + Testcontainers integration tests (what CI runs; needs Docker)
./mvnw test -Dtest=LedgerServiceTest              # single unit test class
./mvnw test -Dtest=LedgerServiceTest#methodName   # single unit test method
./mvnw verify -Dit.test=MissionFlowIT             # single integration test (Testcontainers-backed)
```
The IntelliJ `backend` run config sets `SPRING_PROFILES_ACTIVE=dev`.

### Web (run from `missionhq-web`)
```bash
npm install
npm start              # kid app   → :4200, API proxied to :8080 (proxy.conf.json)
npm run start:parent   # parent app → :4300
npm run build          # production build, both kid + parent
npm run build:dev      # dev-configuration build, both apps (used for the deployed dev environment)
npm test               # vitest via `ng test`; scope to one project with `ng test kid` / `ng test parent` / `ng test shared`
```
The service worker (PWA install, offline cache) only activates on a production build — `ng serve` disables it.

## Architecture

### Backend: package-by-feature under `com.family.missionhq`
`household`, `kid`, `mission`, `ledger`, `rank`, `celebration`, `reward`, `cosmetic`, `push`, `squad`, `storage`, `security`, `api`, `common`.

Load-bearing invariants, not obvious from any single file:
- **`ledger/` is the only writer of points.** `LedgerService` appends `PointEntry` rows; every other module that affects a balance (mission approval, redemptions, bonuses) goes through it rather than mutating balances itself.
- **Cross-module reactions happen via events, not direct calls.** `rank/` listens for `PointsAwarded` to advance the rank ladder; `push/` modules publish `PushRequested` inside the originating transaction, and `PushService` delivers it asynchronously *after commit* (so a failed push never rolls back the business transaction), dropping subscriptions that come back 404/410.
- **Two parallel auth schemes**, both in `security/`: `DeviceTokenFilter` validates the kid tablets' `Authorization: Device <token>` header and exposes `CurrentKid`; parents use HTTP Basic against the `parent` table and get `CurrentParent`. **Every parent endpoint must scope by `CurrentParent.get().getHouseholdId()`** — use `CurrentParent.kid(id)` for kid-id paths and the `findByHouseholdId…` repository queries for lists; cross-household lookups deliberately read as 404. `ParentBootstrap` creates the first household + parent from `PARENT_EMAIL`/`PARENT_PASSWORD` on startup, so a blank database needs no manual inserts.
- **Flyway history is split in two.** `db/migration` (schema + reference data) always runs; `db/seed` (demo household/kids/devices) only runs when the `dev` Spring profile adds `classpath:db/seed` to `spring.flyway.locations` (see `application-dev.yml`). Don't add demo data to `db/migration`.
- **Photo bytes never touch Spring.** `storage/PhotoStorage` presigns uploads/downloads; `missionhq.storage.type=local` serves HMAC-signed, expiring URLs off disk, `type=s3` points at any S3-compatible bucket (R2, OCI). Callers only ever see a signed URL and a key.

### Frontend: Angular 22, signals throughout
- Components are `OnPush` by default; state is signals, so there's no manual change detection anywhere.
- `kid` and `parent` are separate deployable PWAs (kid: fullscreen/landscape; parent: standalone/portrait) sharing everything reusable through `projects/shared`.
- Each app has three environment files: `environment.ts` (used by `ng serve`), `environment.dev.ts`, `environment.prod.ts`. `angular.json` swaps the right one in per build configuration via `fileReplacements` — there is no runtime env switching.
- Deployment shape: each app builds to static output for Cloudflare Pages; the backend runs on Cloud Run, one service per branch (`develop` → `missionhq-dev`, `main` → `missionhq-prod` — see `.github/workflows/backend-deploy.yml`). `scripts/pages-build.mjs` injects the deployed API URL into `environment.dev.ts`/`environment.prod.ts` at Pages build time.

## CI
`.github/workflows/ci.yml` runs on every push to `main`/`develop` and on PRs: `./mvnw verify` for the backend (Testcontainers spins up real Postgres, so this exercises actual Flyway migrations) and `npm ci && npm run build && npm run build:dev` for the web workspace. There is no separate `npm test` step in CI currently.
