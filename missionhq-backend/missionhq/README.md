# Mission HQ — backend

Spring Boot 3.3 / Java 21 / PostgreSQL / Flyway.

## Run locally
```bash
docker compose up -d          # PostgreSQL 16 on :5432
./mvnw spring-boot:run        # or mvn spring-boot:run
```
`V2__seed_dev.sql` creates one household, two kids (Viper / Nova), three behaviours, rewards and two pre-paired dev device tokens.

## Try it
```bash
# kid side (device token from seed)
curl -H "Authorization: Device dev-token-viper" localhost:8080/api/v1/me
curl -H "Authorization: Device dev-token-viper" localhost:8080/api/v1/me/missions
curl -H "Authorization: Device dev-token-viper" -H "Content-Type: application/json" \
     -d '{"photoKey":"demo.jpg"}' localhost:8080/api/v1/me/missions/1/submit

# parent side (basic auth from application.yml)
curl -u dad@example.com:change-me localhost:8080/api/v1/approvals
curl -u dad@example.com:change-me -X POST -H "Content-Type: application/json" \
     -d '{"bonusPoints":5}' localhost:8080/api/v1/approvals/missions/1/approve

# kid opens HQ: celebrations to play, then ack each
curl -H "Authorization: Device dev-token-viper" localhost:8080/api/v1/me/celebrations
```

## Layout
```
household/    Household, Parent, exchange rate
kid/          Kid, Device pairing
mission/      Behaviour (templates), MissionCompletion (submit / approve / send back), streaks
ledger/       PointEntry (append-only) + LedgerService, the only writer of points
rank/         RankDefinition ladder + RankService (listens to PointsAwarded)
celebration/  Celebration queue the kid app drains and acks
reward/       Reward catalogue, suggestions, pricing rules, Redemption
security/     Device token filter for kids; HTTP Basic against the parent table for parents (CurrentParent scopes every
              parent endpoint to the signed-in parent's household)
api/          Controllers: /api/v1/me/** (kid), /api/v1/** (parent), /api/v1/devices/pair
```

## Parents and households
Parents sign in with HTTP Basic against the `parent` table. `ParentBootstrap` runs at startup: if `PARENT_EMAIL` is unknown it
creates a household plus that parent from `PARENT_PASSWORD`; if known, it re-syncs the password so rotating the env var works.
That is the whole provisioning story for the first household. Additional parents/households are inserted directly for now —
there is no sign-up or invite flow yet.

## Not yet in this cut
- Parent sign-up / invites, password reset
- Season reset

## Avatar & cosmetics (V3)
- `cosmetic/` — `Avatar` (colour + JSON slot map), `CosmeticItem` (per theme and slot; price 0 + unlock rank 0 = starter gear everyone owns), `KidCosmetic` (ownership), `CosmeticService` (catalogue with OWNED / BUYABLE / LOCKED, buy = spend + grant + equip, equip toggles a slot, rank-up grants the free items of that rank).
- Kid endpoints: `GET /me/avatar`, `PUT /me/avatar/colour`, `GET /me/cosmetics`, `POST /me/cosmetics/{id}/buy`, `POST /me/cosmetics/{id}/equip`, `PUT /me/theme`. `/me` now includes `avatar`.
- Cosmetics are priced in points for now. If the boys keep raiding their term-goal savings for gear, introduce a separate gear-token ledger earned only by streaks and rank-ups; the shop UI already treats gear as its own tab so the switch is contained.

## Photo storage (`storage/`)
`PhotoStorage` presigns uploads and views; Spring never handles image bytes.
- `missionhq.storage.type=local` (default): files under `./data/photos`, served by `PhotoController` at `/api/v1/photos/**` behind HMAC-signed, expiring URLs. Set `PUBLIC_BASE_URL` to whatever the tablets can reach (e.g. `http://192.168.1.20:8080`) so the signed URLs resolve on the LAN.
- `missionhq.storage.type=s3`: any S3-compatible bucket. Cloudflare R2: `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, `S3_REGION=auto`; OCI Object Storage: its S3 compatibility endpoint. Set a CORS rule on the bucket allowing `PUT` from the kid app origin.
- Flow: kid app `POST /me/missions/{behaviourId}/photo-url` → `PUT` the JPEG to `url` with the returned headers → `POST .../submit` with `photoKey`. Parent queue returns `photoUrl` (30-minute view link). Send-back deletes the photo; `PhotoPurgeJob` deletes approved photos after `photo-ttl-days`.

## Deploying
`Dockerfile` builds a small JRE image (fits Render's free tier or an OCI Always Free VM). Environment: `DB_URL`, `DB_USER`, `DB_PASSWORD`, `PARENT_EMAIL`, `PARENT_PASSWORD`, `STORAGE_TYPE=s3` + `S3_*`, `STORAGE_SECRET`, and `CORS_ORIGINS` for the two PWA origins.

## Push notifications (`push/`)
Web Push with VAPID via `nl.martijndwars:web-push`. Generate keys once (`java -cp target/classes:... com.family.missionhq.push.VapidKeyGen`, or `npx web-push generate-vapid-keys`) and set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Without a public key, push is silently disabled.
- Subscriptions: `POST /me/push/subscribe` (kid device), `POST /push/subscribe` (parent), `DELETE` to remove; `GET /push/public-key` is open.
- Services publish `PushRequested` inside their transaction; `PushService` delivers after commit, asynchronously, and drops subscriptions that come back 404/410.
- Events: mission submitted → parents; approved / sent back / bonus / suggestion approved → the kid; suggestion / redemption / rank-up → parents; rank-up → siblings.
- Payload uses the ngsw `notification` shape with `onActionClick`, so tapping opens `/hq`, `/shop`, `/approvals` etc. in the installed app.

## Squad (`squad/`)
`SquadGoal` (seeded: "Family airsoft day", 1500) + `SquadService`: progress = household lifetime points; milestones at 25/50/75/100% queue a `SQUAD_MILESTONE` celebration and a push for every kid (parents get the 100%). `GET /me/squad` returns the goal, the kid's own share, and siblings' callsign, rank, avatar and share only — never balances. High-fives also push to the sibling.
