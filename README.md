# Mission HQ

A family chore-and-reward app with a game face on it. Kids get a "mission" list on a tablet, complete missions with a photo,
and earn points, ranks, streaks, gear for an avatar and a shared squad goal. Parents approve missions from their phone,
price rewards, and hand out bonuses. Each household is its own world — its kids, behaviours, rewards and exchange rate.

Two themed worlds ship today: **AIRSOFT** (Recruit → Commander) and **HERO** (Sidekick → Legend).

## How it fits together

```
missionhq-backend/missionhq   Spring Boot 3.3 · Java 21 · PostgreSQL · Flyway      → Cloud Run
missionhq-web/projects/kid    Angular 22 PWA, fullscreen landscape, for the tablet  → Cloudflare Pages
missionhq-web/projects/parent Angular 22 PWA, portrait, for the parent's phone       → Cloudflare Pages
missionhq-web/projects/shared API client, DTOs, themes (used from source)
```

- Kids authenticate with a device token issued when a tablet is paired with a one-time code; parents sign in with
  email + password. Every parent request is scoped to the parent's household.
- Points live in an append-only ledger; balances, ranks, streaks and the squad goal are all derived from it.
- Photos go straight from the tablet to object storage on presigned URLs; the API never handles image bytes.
- Web Push tells parents when there's something to approve and tells kids when it's approved.

## Run it locally

Backend (needs Docker for Postgres and Java 21):
```bash
cd missionhq-backend/missionhq
docker compose up -d
SPRING_PROFILES_ACTIVE=dev ./mvnw spring-boot:run      # dev profile seeds a demo household with two kids
```

Web (needs Node 24):
```bash
cd missionhq-web
npm install
npm start              # kid app    → http://localhost:4200
npm run start:parent   # parent app → http://localhost:4300
```

Sign in to the parent app with `dad@example.com` / `change-me`. To skip pairing on the kid app, paste into the browser console:
```js
localStorage.setItem('missionhq.session', JSON.stringify({ deviceToken: 'dev-token-viper', kidId: 1, callsign: 'Viper', themeCode: 'AIRSOFT' }))
```

Tests: `./mvnw verify` in the backend (unit tests plus Testcontainers integration tests, so Docker must be running);
`npm test` in the web workspace.

## Deploying

Pushing `develop` deploys a dev environment and pushing `main` deploys prod, via GitHub Actions (backend) and Cloudflare
Pages (web). Provisioning the accounts, buckets, database and secrets is a one-time job described step by step in
[DEPLOY.md](DEPLOY.md).

## More

- [Backend README](missionhq-backend/missionhq/README.md) — module layout, API sketch, storage and push details
- [Web README](missionhq-web/README.md) — what each screen does, PWA and push notes
- [CLAUDE.md](CLAUDE.md) — orientation for AI coding assistants (commands, invariants)

## Status

Single household in daily use is the current target; multi-household support is next (auth and data are already scoped
by household, sign-up/invites and admin screens are not built yet). Kids and behaviours are still inserted in the
database by hand.
