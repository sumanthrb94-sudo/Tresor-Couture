# Trésor Couture — Free-Tier Deploy Guide

**Architecture:** Firebase **Spark (free)** plan only. No Cloud Functions, no billing required.

- **Firestore** — single source of truth (data + business rules)
- **Firebase Auth** — email/password user accounts
- **Firebase Hosting** — serves the Vite build
- **Frontend (Web SDK)** — talks straight to Firestore via `src/lib/firebase.ts`
- **Postman** — tests via Identity Toolkit + Firestore REST APIs

> **Why no Cloud Functions?** They require the Blaze (pay-as-you-go) plan. On free, every business rule lives in `firestore.rules` and the frontend talks to Firestore directly. Tradeoff: price/total computation runs client-side, so Firestore rules validate the resulting documents instead of recomputing them.

---

## 1. Firebase console (browser, one-time)

1. https://console.firebase.google.com/project/tresor-couture
2. **Firestore Database → Create database → Production mode → `asia-south1`**
3. **Authentication → Sign-in method → Email/Password → Enable**
4. (Optional) **Storage → Get started → same region** — only if you'll upload product photos through the app.

You can stay on the **Spark (free)** plan. No billing prompt needed.

## 2. Local CLI (one-time)

```bash
npm install -g firebase-tools
firebase login                   # OAuth in your browser
firebase use tresor-couture      # picks up .firebaserc

cd Tresor-Couture
npm install                      # installs firebase web SDK + the rest
```

## 3. Deploy (3 commands, every time)

```bash
firebase deploy --only firestore       # rules + indexes
npm run build                          # Vite build → dist/
firebase deploy --only hosting         # static site
```

After this:
- Storefront: `https://tresor-couture.web.app/`
- Firestore + Auth: handled by Google's REST endpoints (no per-deploy URL)

## 4. Bootstrap the first admin (one-time)

Admin access is gated by the custom claim `admin: true` on the user. Set it once via the Admin SDK from your laptop:

```bash
# Register yourself first via the storefront OR via Postman's Auth → Register
# Note the uid that comes back

# Then promote (uses your `firebase login` credentials)
node -e "require('firebase-admin').initializeApp().auth().setCustomUserClaims('YOUR_UID', { admin: true }).then(() => console.log('done'))"

# Log out and back in in the storefront / Postman so the new token carries the admin claim.
```

Future admins can be promoted the same way (Admin SDK is the only path on the free plan, since we have no Cloud Function to do it).

## 5. Test with Postman

1. Postman → **File → Import** → both files from `postman/`
2. Top-right environment dropdown → **Trésor Couture · Firebase Free Tier**
3. Edit `testEmail` / `testPassword`
4. Run in order — each request's test script populates the env for the next:

   | # | Request | Outcome |
   |---|---|---|
   | 1 | Auth · Register | captures `{{idToken}}`, `{{uid}}`, `{{refreshToken}}` |
   | 2 | Users · Create my profile | writes `/users/{{uid}}` |
   | 3 | *(manual step 4 above)* | promote yourself to admin |
   | 4 | Auth · Login | fresh token with admin claim — copy into `{{adminIdToken}}` |
   | 5 | Products · Create (admin) | captures `{{productId}}` |
   | 6 | Products · Filter by master category | runQuery example |
   | 7 | Coupons · Create WELCOME10 (admin) | seeds the discount |
   | 8 | Orders · Place order | captures `{{orderId}}` |
   | 9 | Orders · My orders (runQuery) | confirms it persisted |
   | 10 | Orders · Mark shipped (admin) | fulfilment update |
   | 11 | Reviews · Create review | captures `{{reviewId}}` |
   | 12 | Reviews · Approve (admin) | moderation |
   | 13 | Auth · Refresh token | when `{{idToken}}` expires (~1h) |

## 6. Local development (Firestore emulator)

```bash
firebase emulators:start         # firestore (8080) + auth (9099) + hosting (5000)
```

Then in `.env.local`:
```
VITE_FIREBASE_AUTH_DOMAIN=localhost
VITE_USE_EMULATORS=1
```
The frontend doesn't currently auto-wire emulator connections — if you want that, search `src/lib/firebase.ts` for `connectAuthEmulator` (one-line addition).

## 7. Schema (Firestore collections)

| Collection | Doc ID | Required fields | Rule highlights |
|---|---|---|---|
| `users` | Firebase Auth UID | `uid · email · fullName · role` | Owner-only read/write; role + uid + createdAt immutable from client; admin can update anything |
| `products` | auto | `brand · name · pricePerMeter · category · masterCategory` | Public read · admin write; price must be a non-negative number |
| `coupons` | UPPERCASE code | `code · kind · value · active` | Public read (checkout needs it) · admin write |
| `orders` | auto | `userId · status='placed' · items[] · total ≥ 0` | Owner reads; only admin updates/deletes; client must include their own uid + initial `placed` status |
| `reviews` | auto | `fabricId · userId · rating ∈ 1..5 · status='pending'` | Public read; signed-in user can create their own; admin moderates |

Anything outside this list is denied by default (catch-all rule at the bottom of `firestore.rules`).

## 8. Indexes

`firestore.indexes.json` declares the composite indexes needed by the frontend queries:
- `orders` · `userId` + `placedAt DESC`
- `orders` · `status` + `placedAt DESC`
- `reviews` · `fabricId` + `status` + `createdAt DESC`
- `products` · `masterCategory` + `subCategory`

Deployed automatically by `firebase deploy --only firestore`.

## 9. Frontend integration

`src/lib/firebase.ts` exports typed APIs that match the previous `localStorage` layer 1:1, so cutover is mechanical:

```ts
import { productsApi, ordersApi, couponsApi, register, login } from './lib/firebase';

await register({ email, password, fullName });
const list = await productsApi.list({ masterCategory: 'Sarees', limit: 24 });
const result = await couponsApi.validate('WELCOME10', 4500);
const order = await ordersApi.place({ items, shippingAddress, paymentMethod: 'upi' });
```

When you're ready, replace `usersStore` / `ordersStore` / etc. in `src/data/storage.ts` and the `localStorage` reads in `AuthContext` with these calls.

## 10. Quotas (Spark plan — what you actually have for free)

| Resource | Daily quota | Notes |
|---|---|---|
| Firestore reads | 50,000 | A page view of `/shop` ≈ 1 read per product card |
| Firestore writes | 20,000 | One order = ~1 write |
| Firestore deletes | 20,000 | |
| Firestore storage | 1 GiB | ~10,000 products is well within this |
| Auth | unlimited | Email/password is free |
| Hosting transfer | 10 GB / month | Static assets are gzipped + cached |
| Hosting storage | 10 GB | |

If you blow through reads, the **first** thing to add is the Blaze plan — Firestore reads cost ~$0.06 per 100k extra. Cloud Functions can wait until you genuinely need server-side logic.

## 11. Upgrading to Blaze later

If you decide later to add Cloud Functions (price validation server-side, Stripe webhooks, etc.):
1. Upgrade billing on the Firebase console
2. `git revert` this commit to restore the `functions/` directory
3. Re-run `firebase deploy`

Everything's preserved in git history.
