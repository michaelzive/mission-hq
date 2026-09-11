# Mission HQ — web

Angular 22 multi-project workspace: `projects/kid` (the tablet app), `projects/shared` (API client, DTOs, themes). A `parent` app slots in alongside later with `ng generate application parent`.

## Run
```bash
npm install
npm start            # kid app    → http://localhost:4200 (API proxied to :8080)
npm run start:parent # parent app → http://localhost:4300
```
On the pairing screen use a code from `POST /api/v1/kids/{id}/pairing-code` (parent basic auth).
For a quick start without pairing, paste the seeded dev token into the browser console:
```js
localStorage.setItem('missionhq.session', JSON.stringify({ deviceToken: 'dev-token-viper', kidId: 1, callsign: 'Viper', themeCode: 'AIRSOFT' }))
```
Then submit a mission, approve it with curl (see the backend README), and reload the kid tab to watch the celebration play.

## What's in this slice
- Pairing → device token in localStorage → `Authorization: Device …` on every call (functional interceptor in `shared`)
- HQ: `/me` + `/me/missions`, term-goal bar, stats, mission cards
- Mission sheet: camera capture, client-side resize to ~1000px JPEG, presigned upload (`POST /me/missions/{id}/photo-url` → `PUT` blob via raw fetch → `submit` with the key)
- Celebration player: drains `/me/celebrations` on open, plays each in order (stamp → coins → counter bump; rank-up takeover; confetti/fireworks), acks each
- Shop (`/shop`): real rewards with the term goal pinned first, progress bar toward anything unaffordable, redeem confirmation, then the REDEEMED celebration plays on the spot. "Suggest a reward" sheet (name, category, rough cost) with the 3-pending cap; suggestions show as "You suggested this" and "Waiting for HQ" until approved. Cosmetics tab is a placeholder.
- Gear tab in the shop: real cosmetics from `/me/cosmetics` (buyable / locked-by-rank / owned), buying equips immediately.
- Locker (`/locker`): SVG avatar built from slot asset keys, colour swatches, per-slot pickers that equip/unequip what you own and show what's locked or buyable, world switch (AIRSOFT / HERO). The rail now renders the avatar too.
- Shared `KidStateService` (/me) and `RailComponent` so every kid screen shows the same rank, balance and nav.
- Squad (`/squad`): the shared goal with each brother's share, the sibling's avatar (in *their* theme) and rank only, high-five with a push to the other tablet. Milestone celebrations at 25/50/75/100% play on every tablet.
- Theme service: `themeCode` from `/me` → vocabulary, palette, fonts as CSS custom properties on `:root`
- Sounds are synthesised (WebAudio) behind `SoundService`; swap for per-theme sample packs without touching callers

## Photos on a real tablet
The tablets fetch the signed photo URLs directly, so with local storage set `PUBLIC_BASE_URL` on the backend to your PC's LAN address (e.g. `http://192.168.1.20:8080`) and serve the kid app with `ng serve kid --host 0.0.0.0`. With S3/R2 the URLs point at the bucket and this does not matter.

## PWA (installable on the tablets)
Both apps are PWAs (`@angular/pwa`): manifest, icons, service worker with app-shell caching, and a `dataGroups` freshness cache for the API so HQ opens with the last known state when the Wi-Fi drops. `UpdateService` checks for a new version on launch and hourly and reloads when one is ready, so nobody has to press "update". The kid app runs `fullscreen` + `landscape`; the parent app `standalone` + `portrait`. The pairing screen offers "Add to home screen" when Chrome allows it.

Two things the service worker needs:
1. A production build (`npm run build`); the SW is disabled in `ng serve`.
2. HTTPS (or `localhost`). Plain `http://192.168.x.x` will run the app but not install it.

Options that satisfy both, cheapest first:
- **Cloudflare Pages** for each app (free, HTTPS, custom domain). `_redirects` is already in `public/` for SPA routing. Set `apiBaseUrl` in `environment.prod.ts` to the backend's public URL and allow that origin in the backend's `missionhq.cors.allowed-origins`.
- **Cloudflare Tunnel** to expose your home PC's Spring Boot (and, while testing, the built frontends) over HTTPS without opening ports.
- Same-origin: serve `dist/*/browser` from behind a reverse proxy that also fronts `/api`, then `apiBaseUrl` can stay `/api/v1`.

Font inlining is turned off in the production config so builds don't need internet access; fonts load from Google at runtime as before.

## Push notifications
`PushService` (both apps) subscribes through Angular's `SwPush` and posts the subscription to the backend. The kid app asks for permission during pairing (inside the tap, so browsers allow it) and shows "Turn on HQ alerts" in the rail until granted; the parent app has "Turn on alerts" in the header. Needs the production build, HTTPS, and `VAPID_*` set on the backend. Tapping a notification opens the installed app at the screen in the payload (`/hq`, `/shop`, `/approvals`, `/kids`, `/squad`).

Quick test without deploying: `npm run build`, serve `dist/parent/browser` on `localhost` (SW allowed there), sign in, turn on alerts, then submit a mission from the kid app and watch the parent notification arrive.

## Notes
- Components are OnPush by default in Angular 22; all state here is signals, so nothing needs manual change detection.
- `shared` is consumed straight from source (`tsconfig.json` paths), no library build step.
- The production build inlines Google Fonts; if you build offline, add `"fonts": { "inline": false }` under the production `optimization` in `angular.json`.

## Parent app (`projects/parent`)
Sign in with the Basic-auth parent from `application.yml` (default `dad@example.com` / `change-me`).
- **Approvals**: mission reports (approve with a +0/+5/+15 bonus, or send back with a note) and reward suggestions (rate-derived price pre-filled, editable, tier chips). Exchange rate editor at the top.
- **Kids**: rank/balance/streak per kid, surprise bonuses with a reason, and pairing-code generation for tablets.
Requires `HouseholdController` from the updated backend zip (`GET /household`, `GET /kids`).

## Next
- `ng add @angular/pwa --project kid` for the installable home-screen app
- Real avatar artwork. Parts are a registry in `projects/kid/src/app/shared/avatar-parts.ts`: one SVG fragment per (slot, assetKey) on a 100×100 canvas, colour passed in. Give an illustrator that file and the asset keys from `V3__avatar_cosmetics.sql`; new items are one row in `cosmetic_item` plus one fragment here.
- Season reset (prestige stars) and a parent screen to set the squad goal and term goals
