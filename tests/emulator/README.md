# Live-chat end-to-end test (Firebase Emulator Suite)

Drives a real two-party live-chat exchange — a signed-in **customer** and a
signed-in **admin** in separate browser contexts — against the local Auth +
Firestore emulators, which load the real `firestore.rules`. Asserts real-time
delivery in both directions with no page reload.

This suite is intentionally **not** part of the default Playwright run
(`playwright.config.ts`), because it needs the emulators and an emulator build.

## Prerequisites

- Java (for the Firestore emulator). `firebase-tools` is **not** a committed
  dependency (it's a large CLI); `npm run emulators` fetches it on demand via
  `npx -y firebase-tools`, or install it yourself with `npm i -D firebase-tools`.
- Playwright browsers installed (`npx playwright install chromium`), or set
  `PW_EXECUTABLE_PATH` to a prebuilt Chromium.

## Run

```bash
# 1. Start the emulators (Auth :9099, Firestore :8080)
npm run emulators            # leave running in its own terminal

# 2. Seed the two test users (customer + admin with the admin claim)
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
GCLOUD_PROJECT=demo-tresor \
  npm run seed:emulator

# 3. Build + preview the app pointed at the emulators
cat > .env.local <<'ENV'
VITE_FIREBASE_API_KEY=demo-key
VITE_FIREBASE_PROJECT_ID=demo-tresor
VITE_FIREBASE_STORAGE_BUCKET=demo-tresor.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef1234567890
VITE_FIREBASE_AUTH_DOMAIN=demo-tresor.firebaseapp.com
VITE_USE_EMULATORS=1
ENV
npm run build
npm run preview -- --port 4173 --host 127.0.0.1   # leave running

# 4. Run the test
npm run test:chat
```

`.env.local` is gitignored; the emulator flag `VITE_USE_EMULATORS` is inert in
any build that doesn't set it (production/staging/preview never do).

## What it proves

- Customer message surfaces in the admin inbox in real time.
- Real-time delivery customer → admin and admin → customer, no reload.
- Admin access gated by the real `admin` custom claim.
- Per-user isolation is enforced by `firestore.rules` (a second customer gets
  `permission-denied` reading another customer's chat).
