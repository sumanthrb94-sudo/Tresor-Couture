# Trésor Couture — Backend Deploy Guide

Single-tenant Firebase project: **`tresor-couture`** · region: **`asia-south1`** (Mumbai).

The deployable surface area is:
- **Cloud Functions** — `functions/` directory, single HTTPS function called `api` (Express app).
- **Firestore** — rules + indexes in repo root.
- **Hosting** (optional) — serves the Vite `dist/` and rewrites `/api/**` to the function.

---

## 1. One-time setup

```bash
# from repo root
npm install -g firebase-tools         # if you don't have it
firebase login                        # uses your Google account
firebase use tresor-couture           # selects the project from .firebaserc

cd functions
npm install
cd ..
```

## 2. Configure the login secret

`/auth/login` needs the project's Web API key to proxy `signInWithPassword`. Set it once as a function secret (encrypted at rest):

```bash
firebase functions:secrets:set FIREBASE_WEB_API_KEY
# paste:  AIzaSyAIct4PdHb0YaNCYpLdGxh1kDlukwwc_3M
```

## 3. Bootstrap the first admin

Cloud Functions can't promote without an existing admin. Do this once via the SDK from your laptop:

```bash
# Replace UID with the user you want to make admin (register them first via /auth/register or Firebase console)
node -e "require('firebase-admin').initializeApp().auth().setCustomUserClaims('UID_HERE', { admin: true }).then(() => console.log('done'))"
```
(requires you to be `firebase login`-ed; the Admin SDK picks up application-default credentials.)

After that, future admins are promoted through `POST /auth/promote` by an existing admin.

## 4. Deploy

```bash
# Firestore rules + indexes
firebase deploy --only firestore

# Cloud Functions (compiles TS, lints, deploys)
firebase deploy --only functions

# Hosting (Vite build first)
npm run build
firebase deploy --only hosting

# All together
firebase deploy
```

After deploy, the API is reachable at:
- **Via Hosting** (with rewrites): `https://tresor-couture.web.app/api/health`
- **Direct function URL**: `https://asia-south1-tresor-couture.cloudfunctions.net/api/health`

## 5. Test in Postman

1. Postman → **File → Import** → drop in `postman/tresor-couture.postman_collection.json` and `postman/tresor-couture.postman_environment.json`
2. Select the **Trésor Couture · Production** environment (top-right)
3. Edit `testEmail` / `testPassword` if you want different credentials
4. Run the requests in this order — auth scripts auto-capture `{{idToken}}` and `{{productId}}` into the env:

   1. `Health · GET /health` → `{ ok: true }`
   2. `Auth · Register` → captures `idToken` + `uid`
   3. `Auth · Me` → returns your profile
   4. Promote yourself: copy `uid`, set `adminIdToken` = `idToken` for now, run `Auth · Promote to Admin`. Re-login to refresh the token with the new claim, paste new `idToken` into `adminIdToken`.
   5. `Products · Create (admin)` → captures `productId`
   6. `Products · List` / `Get one`
   7. `Coupons · Create (admin)` → seeds `WELCOME10`
   8. `Coupons · Validate` → confirms ₹450 discount on ₹4,500 subtotal
   9. `Orders · Place order` → captures `orderId`, server computes subtotal/tax/shipping
   10. `Orders · My orders` → returns the order
   11. `Reviews · Create` → pending review
   12. `Reviews · Moderate (admin)` → approve

## 6. Local development (no deploys needed)

The Firebase Emulator Suite runs everything locally:

```bash
firebase emulators:start
```

That starts auth (9099), firestore (8080), functions (5001), hosting (5000), and an emulator UI (8081). Postman environment ships an `emulatorUrl` variable — swap `{{baseUrl}}` to `{{emulatorUrl}}` in any request to hit the emulators.

## 7. Frontend integration

`src/lib/firebase.ts` is the typed REST client. Replace the existing localStorage-backed contexts (`CartContext`, `AuthContext`, etc.) when you're ready to cut over:

```ts
import { api, setIdToken } from './lib/firebase';

// after login:
setIdToken(idTokenFromLogin);

// then:
const { products } = await api.get<{ products: Product[] }>('/products');
const { order }    = await api.post<{ order: Order }>('/orders', payload, { auth: true });
```

## 8. Schema reference (Firestore collections)

| Collection       | Document ID            | Fields (summary)                                                                                          |
|------------------|-----------------------|-----------------------------------------------------------------------------------------------------------|
| `users`          | Firebase Auth UID     | `email · fullName · phone? · role · createdAt · defaultAddress?`                                          |
| `products`       | auto                  | full Fabric record + `createdAt · updatedAt`                                                              |
| `orders`         | auto                  | `userId · items[] · subtotal · tax · shipping · total · status · placedAt · shippingAddress · paymentMethod` |
| `reviews`        | auto                  | `fabricId · userId · rating · title? · body · status · createdAt`                                          |
| `coupons`        | UPPERCASE code        | `kind · value · minSubtotal? · maxDiscount? · expiresAt? · active`                                         |

Rules: see `firestore.rules`. Most write paths are blocked from clients and go through Cloud Functions which uses the Admin SDK (bypasses rules but enforces its own business logic).
