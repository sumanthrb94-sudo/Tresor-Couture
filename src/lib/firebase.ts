/**
 * Firebase Web SDK bootstrap — the entire backend on the free Spark plan.
 * Reads + writes go straight to Firestore; security comes from the rules
 * in firestore.rules. No Cloud Functions.
 *
 * The API key is the public project identifier (Firebase API keys aren't
 * secrets — they route requests, they don't authorise them). Real auth
 * is the Firebase ID token; real authorisation is the rules engine.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  EmailAuthProvider,
  linkWithPopup,
  linkWithPhoneNumber,
  linkWithCredential,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  sendPasswordResetEmail,
  verifyPasswordResetCode as fbVerifyPasswordResetCode,
  confirmPasswordReset as fbConfirmPasswordReset,
  applyActionCode as fbApplyActionCode,
  checkActionCode as fbCheckActionCode,
  type ActionCodeInfo,
  type ConfirmationResult,
  signOut as fbSignOut,
  onAuthStateChanged,
  connectAuthEmulator,
  updateProfile,
  type User as FbUser,
  type UserCredential
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  enableIndexedDbPersistence,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as qLimit,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type QueryConstraint
} from 'firebase/firestore';
import { getBuiltinCoupon } from './coupon';
import { apiPost } from './csrf';

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

/**
 * Use the Firebase-hosted handler domain (*.firebaseapp.com) as authDomain.
 * It is the ONLY domain pre-registered with the Google OAuth client, so Google
 * sign-in works with zero extra Cloud Console config.
 *
 * Tempting alternative — point authDomain at the custom domain (tresorcouture.in)
 * via the vercel.json /__/auth proxy so the redirect session is first-party on
 * mobile — REQUIRES adding that domain to the OAuth 2.0 client's Authorized
 * redirect URIs in Google Cloud Console, or Google rejects the request as
 * "invalid" (Access blocked). Until that Cloud config is done, firebaseapp.com
 * is the reliable choice. Override with VITE_FIREBASE_AUTH_DOMAIN only after
 * registering the domain with the OAuth client.
 *
 * NOTE: the app's own origin (tresorcouture.in) must still be listed under
 * Firebase Console → Authentication → Settings → Authorized domains, or
 * sign-in throws auth/unauthorized-domain regardless of authDomain.
 */
function resolveAuthDomain(): string {
  const override = env.VITE_FIREBASE_AUTH_DOMAIN?.trim();
  // GUARD: never let a *.vercel.app authDomain through. Its OAuth handler URL
  // (https://<app>.vercel.app/__/auth/handler) is NOT a registered redirect URI
  // on the Google OAuth client, so Google sign-in breaks and the user is bounced
  // to the vercel.app origin. A stray VITE_FIREBASE_AUTH_DOMAIN=<...>.vercel.app
  // in the Vercel env must not be able to take auth down — fall back to the
  // always-registered Firebase handler domain instead.
  if (override && !/\.vercel\.app$/i.test(override)) return override;
  return 'tresor-couture.firebaseapp.com';
}

const requiredFirebaseVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

const missing = requiredFirebaseVars.filter((key) => !env[key]?.trim());
if (missing.length > 0) {
  throw new Error(
    `Missing required Firebase environment variables: ${missing.join(', ')}. ` +
    `Copy .env.example to .env.local and fill in the Vite Firebase config.`
  );
}

const firebaseConfig = {
  apiKey:            env.VITE_FIREBASE_API_KEY!,
  // authDomain is resolved safely below; do not hardcode it here.
  authDomain:        resolveAuthDomain(),
  projectId:         env.VITE_FIREBASE_PROJECT_ID!,
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             env.VITE_FIREBASE_APP_ID!,
  // GA4 (Google Analytics for Firebase). Optional; omit if not configured.
  measurementId:     env.VITE_FIREBASE_MEASUREMENT_ID?.trim() || undefined,
};

export const app: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/* Local Firebase Emulator Suite — TEST ONLY. Activated exclusively by the
   build-time flag VITE_USE_EMULATORS, which is never set in production, staging
   or preview. When on, Auth + Firestore point at the local emulators (so the
   real firestore.rules are exercised offline) and IndexedDB persistence is
   skipped to avoid a persistence/emulator conflict. Inert otherwise. */
const USE_EMULATORS = env.VITE_USE_EMULATORS === '1' || env.VITE_USE_EMULATORS === 'true';
if (USE_EMULATORS) {
  try { connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); } catch { /* already connected */ }
  try { connectFirestoreEmulator(db, '127.0.0.1', 8080); } catch { /* already connected */ }
} else {
  /* Persist Firestore data locally so repeat visits and category switches read
     from IndexedDB first instead of making a fresh network round-trip. */
  try {
    enableIndexedDbPersistence(db);
  } catch {
    // Best-effort: some browsers / private modes don't allow persistence.
  }
}

/* ------------------------------------------------------------------ */
/*  Auth                                                              */
/* ------------------------------------------------------------------ */

/** Canonical email form. Stored consistently on every profile so the same
 *  address can't spawn case/whitespace-variant duplicate records. */
const normEmail = (e: string | null | undefined): string => (e ?? '').trim().toLowerCase();

/**
 * Fire-and-forget capture of a brand-new user into Brevo, however they signed
 * up (email/password, Google, or phone OTP). Captures whatever identity we
 * have — email and/or phone:
 *   - with an email  → upserts an email contact (phone stored as the SMS
 *                      attribute) and sends the branded welcome email.
 *   - phone-only     → upserts an SMS-keyed contact (no welcome email — there's
 *                      no address to send to; a WhatsApp/SMS welcome can use it
 *                      later).
 * No-ops on localhost where the Vercel /api functions don't exist, and never
 * throws into the auth flow.
 */
function captureNewUser(user: FbUser, fullName?: string, phone?: string): void {
  void (async () => {
    try {
      const email = user.email ?? undefined;
      const phoneNumber = phone ?? user.phoneNumber ?? undefined;
      // Nothing to capture if we have neither an email nor a phone.
      if (!email && !phoneNumber) return;
      const name = fullName ?? user.displayName ?? (email ? email.split('@')[0] : undefined);

      // Marketing-list capture (email contact, or SMS-only contact for a
      // phone signup). Pass the ID token so the server can skip captcha.
      const contactToken = await user.getIdToken().catch(() => null);
      const contactHeaders = contactToken ? { authorization: `Bearer ${contactToken}` } : undefined;
      apiPost('/api/contact', { email, phone: phoneNumber, name, source: 'signup' }, contactHeaders).catch(() => {});

      // Welcome email only when we have an address to send it to.
      if (email) {
        const token = await user.getIdToken().catch(() => null);
        if (token) {
          apiPost('/api/email/welcome', { name }, { authorization: `Bearer ${token}` }).catch(() => {});
        }
      }
    } catch { /* best-effort */ }
  })();
}

export async function register(input: { email: string; password: string; fullName: string; phone?: string }) {
  const email = normEmail(input.email);
  const cred = await createUserWithEmailAndPassword(auth, email, input.password);
  await updateProfile(cred.user, { displayName: input.fullName });
  const profile = {
    uid: cred.user.uid,
    email,
    fullName: input.fullName,
    phone: input.phone ?? null,
    role: 'customer' as const,
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'users', cred.user.uid), profile);
  captureNewUser(cred.user, input.fullName, input.phone);
  return { user: cred.user, profile };
}

export async function login(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/**
 * Trigger Firebase's built-in password-reset flow. The email itself is sent
 * by Firebase Auth from noreply@<project>.firebaseapp.com (template editable
 * in Firebase Console → Authentication → Templates).
 *
 * `continueUrl` is the page the user lands on AFTER they've clicked the
 * reset link and chosen a new password. It MUST be hosted on a domain that
 * appears in Firebase Console → Authentication → Settings → Authorized
 * domains, otherwise Firebase rejects the call with
 * auth/unauthorized-continue-uri.
 *
 * We deliberately do NOT use window.location.origin here — Vercel preview
 * deployments live on ephemeral subdomains (e.g. *-3803s-projects.vercel.app)
 * that are never on the authorized list, so password reset would fail on
 * every preview build. Instead we anchor on the configured Firebase auth
 * domain (already authorized by construction). Override with
 * VITE_PUBLIC_APP_URL if you want reset links to land on a custom domain.
 *
 * Returns void on success; the caller should show a generic "if an account
 * exists, we've sent a link" message — never leak whether the address was
 * actually registered (account-enumeration hygiene).
 */
const ALLOWED_RESET_ORIGINS = new Set([
  'https://tresorcouture.in',
  'https://www.tresorcouture.in',
]);

function allowedResetBase(input: string | undefined): string | undefined {
  if (!input) return undefined;
  try {
    const url = new URL(input);
    const base = `${url.protocol}//${url.host}`;
    return ALLOWED_RESET_ORIGINS.has(base) ? base : undefined;
  } catch {
    return undefined;
  }
}

export async function sendPasswordReset(email: string) {
  // Anchor the post-reset "continue" link on an explicitly allowlisted origin.
  // Never blindly use window.location.origin: a compromised/preview origin could
  // phish the user after they reset their password.
  const explicitBase = allowedResetBase(env.VITE_PUBLIC_APP_URL?.replace(/\/$/, ''));
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
  const originBase = allowedResetBase(currentOrigin);
  const authDomain = auth.app.options.authDomain;
  const fallbackBase = authDomain ? `https://${authDomain}` : 'https://tresorcouture.in';
  const base = explicitBase ?? originBase ?? fallbackBase;
  const continueUrl = `${base}/#/login`;
  await sendPasswordResetEmail(auth, email.trim(), {
    url: continueUrl,
    handleCodeInApp: false,
  });
}

/* ---------- Custom email-action handler helpers ---------- */
// Used by AuthActionPage to consume the oobCode that Firebase puts in
// the email link, so we can run the reset/verify/recover flow inside
// our own branded UI instead of the unbranded firebaseapp.com page.

/** Validate a password-reset code and return the email it targets. */
export async function verifyResetCode(oobCode: string): Promise<string> {
  return fbVerifyPasswordResetCode(auth, oobCode);
}

/** Complete the password reset with the new password. */
export async function completePasswordReset(oobCode: string, newPassword: string): Promise<void> {
  await fbConfirmPasswordReset(auth, oobCode, newPassword);
}

/** Apply an email-verification or email-recovery code. */
export async function applyAuthActionCode(oobCode: string): Promise<void> {
  await fbApplyActionCode(auth, oobCode);
}

/** Inspect a code's intent (e.g. for emailRecovery, learn what address it would revert to). */
export async function inspectActionCode(oobCode: string): Promise<ActionCodeInfo> {
  return fbCheckActionCode(auth, oobCode);
}

/**
 * Production note: we deploy on Vercel (`*.vercel.app`) but the Firebase
 * authDomain is `*.firebaseapp.com`. The `signInWithRedirect` flow stores
 * the OAuth credential in the authDomain's IndexedDB during the OAuth
 * handler step; when the browser lands back on the Vercel origin, that
 * storage is on the wrong origin and the session never propagates.
 *
 * Workaround: always use `signInWithPopup` first (the credential comes
 * back via window.postMessage so it doesn't depend on cross-origin
 * storage). Only fall back to redirect when the popup is genuinely
 * blocked — and for that case, vercel.json rewrites /__/auth/* to the
 * Firebase auth handler so the redirect-flow session lives on the same
 * origin as the app.
 */
async function materialiseGoogleProfile(user: FbUser) {
  const existing = await getDoc(doc(db, 'users', user.uid));
  if (existing.exists()) return;
  await setDoc(doc(db, 'users', user.uid), {
    uid:       user.uid,
    email:     normEmail(user.email),
    fullName:  user.displayName ?? user.email?.split('@')[0] ?? 'Tresor Member',
    phone:     user.phoneNumber ?? null,
    role:      'customer' as const,
    photoURL:  user.photoURL ?? null,
    createdAt: new Date().toISOString()
  });
  captureNewUser(user);
}

/**
 * Google sign-in. Popup first (resilient across mobile + desktop because
 * postMessage doesn't depend on cross-origin cookies); redirect only as
 * a fallback when the popup is blocked.
 */
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  // Popup on EVERY platform. The popup returns the credential via postMessage,
  // so it does NOT depend on cross-origin storage — unlike signInWithRedirect,
  // which loops back to the login page on mobile because the browser partitions
  // the firebaseapp.com iframe's storage and Firebase can't read the result
  // back. Modern mobile browsers allow this popup because it opens directly
  // from the user's tap on the sign-in button.
  try {
    const cred: UserCredential = await signInWithPopup(auth, provider);
    await materialiseGoogleProfile(cred.user);
    return cred.user;
  } catch (err) {
    const code = (err as { code?: string }).code;
    // The user dismissing the popup isn't an error worth surfacing.
    if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
      return null;
    }
    // Same email already registered with a DIFFERENT provider (e.g. they first
    // signed up with email+password). Firebase blocks the silent second account
    // to avoid a duplicate. Tell the user exactly how to get in, rather than
    // surfacing the raw code. (If the Firebase Console "link accounts that use
    // the same email" setting is on, Firebase auto-links and this never fires.)
    if (code === 'auth/account-exists-with-different-credential') {
      const email = (err as { customData?: { email?: string } }).customData?.email;
      let methods: string[] = [];
      try { if (email) methods = await fetchSignInMethodsForEmail(auth, email); } catch { /* ignore */ }
      const how = methods.includes('password')
        ? 'your email and password'
        : methods.includes('phone')
          ? 'your phone number'
          : 'your original sign-in method';
      const friendly = new Error(
        `An account already exists for ${email ?? 'this email'}. Please sign in with ${how}.`
      );
      (friendly as { code?: string }).code = 'auth/account-exists-with-different-credential';
      throw friendly;
    }
    // Only when the environment genuinely can't open a popup do we fall back to
    // redirect (desktop in-app webviews, strict popup blockers).
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      try { window.sessionStorage.setItem('tresor.google.redirect', '1'); } catch { /* ignore */ }
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

/**
 * Call once on app load. If we're returning from a Google redirect, finalise
 * the sign-in and materialise the profile. Safe to call when no redirect is
 * pending (returns silently).
 */
export async function resumeGoogleRedirect(): Promise<FbUser | null> {
  try {
    const result = await getRedirectResult(auth);
    try { window.sessionStorage.removeItem('tresor.google.redirect'); } catch { /* ignore */ }
    if (!result) return null;
    await materialiseGoogleProfile(result.user);
    return result.user;
  } catch (err) {
    console.warn('[auth] resumeGoogleRedirect failed:', (err as Error).message);
    return null;
  }
}

/* ---------- Phone OTP ---------- */

let recaptcha: RecaptchaVerifier | null = null;
let recaptchaHostId: string | null = null;
let pendingConfirmation: ConfirmationResult | null = null;

/**
 * Phone OTP lifecycle is a minefield. Two distinct grecaptcha failures
 * recur unless every attempt is given a virgin host element:
 *
 *  1. "reCAPTCHA client element has been removed: 0"
 *     — verifier outlived its host DOM node (modal close, route change,
 *       React remount).
 *
 *  2. "reCAPTCHA has already been rendered in this element"
 *     — grecaptcha tracks rendered-state on the host element itself, not
 *       just on its child iframe. `RecaptchaVerifier.clear()` deregisters
 *       the widget but does NOT reliably scrub that state; subsequent
 *       `innerHTML = ''` removes the iframe but the element is still
 *       "tainted" in grecaptcha's view.
 *
 * The only deterministic remedy is: never reuse the same host element.
 * The caller's `#recaptcha-container` is treated as a *slot*; on every
 * verifier rebuild we create a fresh child `<div>` with a unique id inside
 * that slot, and bind grecaptcha to the fresh child. Each attempt sees an
 * element grecaptcha has provably never touched.
 */
export function clearRecaptcha() {
  if (recaptcha) {
    try { recaptcha.clear(); } catch { /* widget may already be gone */ }
    recaptcha = null;
  }
  if (recaptchaHostId) {
    const host = document.getElementById(recaptchaHostId);
    host?.parentElement?.removeChild(host);
    recaptchaHostId = null;
  }
}

function ensureRecaptcha(slotId: string): RecaptchaVerifier {
  // Reuse only if the previously-built host element is still in the DOM.
  // If React unmounted the parent slot since the last attempt, the host is
  // gone and the cached verifier would throw "client element has been
  // removed" on next verify.
  if (recaptcha && recaptchaHostId && document.getElementById(recaptchaHostId)) {
    return recaptcha;
  }
  clearRecaptcha();

  const slot = document.getElementById(slotId);
  if (!slot) {
    throw new Error(`reCAPTCHA container "#${slotId}" not found in DOM`);
  }
  // Drop whatever previous attempts left behind (iframes, tainted elements)
  // so the slot is empty before we attach the fresh host.
  slot.innerHTML = '';
  const host = document.createElement('div');
  host.id = `${slotId}-${Date.now().toString(36)}`;
  slot.appendChild(host);

  recaptcha = new RecaptchaVerifier(auth, host.id, { size: 'invisible' });
  recaptchaHostId = host.id;
  return recaptcha;
}

/**
 * Step 1 of phone login. Triggers Firebase to send an SMS to the number.
 * Returns nothing; call confirmPhoneCode() after the user enters the OTP.
 */
export async function sendPhoneCode(e164PhoneNumber: string, recaptchaSlotId: string) {
  try {
    const verifier = ensureRecaptcha(recaptchaSlotId);
    pendingConfirmation = await signInWithPhoneNumber(auth, e164PhoneNumber, verifier);
  } catch (err) {
    // Any failure past this point (invalid number, quota, network) leaves
    // the verifier in a state Firebase refuses to reuse. Drop it so the
    // next attempt rebuilds from a fresh host.
    clearRecaptcha();
    throw err;
  }
}

/**
 * Step 2: confirms the OTP code the user typed in. Materialises a profile
 * doc on first sign-in (mirrors the Google flow).
 */
export async function confirmPhoneCode(code: string) {
  if (!pendingConfirmation) throw new Error('No pending OTP. Call sendPhoneCode() first.');
  const cred = await pendingConfirmation.confirm(code);
  pendingConfirmation = null;
  // Single-use: once the OTP is verified, the verifier has done its job.
  // Drop it so a later sign-in (e.g. sign-out → sign-in again in the same
  // tab) starts with a clean grecaptcha slate.
  clearRecaptcha();
  const profileDoc = doc(db, 'users', cred.user.uid);
  const existing = await getDoc(profileDoc);
  if (!existing.exists()) {
    await setDoc(profileDoc, {
      uid:       cred.user.uid,
      email:     normEmail(cred.user.email),
      fullName:  cred.user.displayName ?? cred.user.phoneNumber ?? 'Tresor Member',
      phone:     cred.user.phoneNumber ?? null,
      role:      'customer' as const,
      createdAt: new Date().toISOString()
    });
    captureNewUser(cred.user); // captures the phone number (SMS contact); no email to welcome
  }
  return cred.user;
}

/* ---------- Account linking (one account, many sign-in methods) ---------- */
// Lets a signed-in user attach the methods they don't have yet — so a phone
// signup can add an email/Google (and get order/marketing emails), and an
// email/Google user can add their phone for OTP login. This is how we avoid
// the same person ending up with two separate accounts.

/** Provider ids linked to the signed-in user: 'password' | 'google.com' | 'phone'. */
export function getLinkedProviders(): string[] {
  return auth.currentUser?.providerData.map(p => p.providerId) ?? [];
}

/** Link a Google identity to the current account; sync email/photo/name. */
export async function linkGoogleAccount(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await linkWithPopup(user, provider);
  const patch: Record<string, unknown> = {};
  if (cred.user.email) patch.email = normEmail(cred.user.email);
  if (cred.user.photoURL) patch.photoURL = cred.user.photoURL;
  if (cred.user.displayName && !user.displayName) patch.fullName = cred.user.displayName;
  if (Object.keys(patch).length) await setDoc(doc(db, 'users', user.uid), patch, { merge: true });
  if (cred.user.email) captureNewUser(cred.user); // newly has an email → marketing + welcome
}

let pendingLinkConfirmation: ConfirmationResult | null = null;

/** Step 1 of linking a phone number to the signed-in account (sends OTP). */
export async function sendLinkPhoneCode(e164PhoneNumber: string, recaptchaSlotId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  try {
    const verifier = ensureRecaptcha(recaptchaSlotId);
    pendingLinkConfirmation = await linkWithPhoneNumber(user, e164PhoneNumber, verifier);
  } catch (err) {
    clearRecaptcha();
    throw err;
  }
}

/** Step 2: confirm the OTP, completing the phone link; saves it to the profile. */
export async function confirmLinkPhoneCode(code: string): Promise<void> {
  if (!pendingLinkConfirmation) throw new Error('No pending code. Send a code first.');
  const cred = await pendingLinkConfirmation.confirm(code);
  pendingLinkConfirmation = null;
  clearRecaptcha();
  if (cred.user.phoneNumber) {
    await setDoc(doc(db, 'users', cred.user.uid), { phone: cred.user.phoneNumber }, { merge: true });
  }
}

/** Link an email + password to a phone-only account (gives them email login). */
export async function linkEmailPassword(email: string, password: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  const e = normEmail(email);
  await linkWithCredential(user, EmailAuthProvider.credential(e, password));
  await updateProfile(user, { displayName: user.displayName ?? e.split('@')[0] });
  await setDoc(doc(db, 'users', user.uid), { email: e }, { merge: true });
  captureNewUser(user); // newly has an email → marketing capture + welcome
}

export const signOut = () => fbSignOut(auth);

export function onAuth(cb: (user: FbUser | null) => void) {
  return onAuthStateChanged(auth, cb);
}

/** True when the signed-in user has the admin custom claim. */
export async function isAdminUser(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const tok = await user.getIdTokenResult();
  return tok.claims.admin === true;
}

/* ------------------------------------------------------------------ */
/*  Generic Firestore helpers                                         */
/* ------------------------------------------------------------------ */

async function listAll<T>(name: string, constraints: QueryConstraint[] = []): Promise<(T & { id: string })[]> {
  const snap = await getDocs(query(collection(db, name), ...constraints));
  // The Firestore document id is canonical — it is what getOne()/productsApi.get()
  // resolve by. Spread the stored data FIRST so a stale `id` field inside the
  // document (e.g. a legacy numeric seed id) can never override the real doc id
  // and produce a navigation target that 404s.
  return snap.docs.map(d => ({ ...(d.data() as T), id: d.id }));
}

async function getOne<T>(name: string, id: string): Promise<(T & { id: string }) | null> {
  const snap = await getDoc(doc(db, name, id));
  return snap.exists() ? ({ ...(snap.data() as T), id: snap.id }) : null;
}

/* ------------------------------------------------------------------ */
/*  Email queue — Firebase "Trigger Email" extension wiring           */
/* ------------------------------------------------------------------ */
/**
 * The Firebase Extensions catalog ships `firestore-send-email` (a.k.a.
 * "Trigger Email from Firestore") which watches a collection and POSTs
 * each new doc through an SMTP provider (SendGrid / Mailgun / Brevo /
 * raw SMTP). Once the extension is installed and SMTP credentials are
 * configured in the Firebase Console, ANY doc added to `mail/` gets
 * delivered automatically — there's no client-side SMTP call.
 *
 *   addDoc(mail) ──► extension trigger ──► SMTP provider ──► inbox
 *
 * Setup checklist (one-time, in Firebase Console):
 *   1. Extensions → Browse Marketplace → "Trigger Email from Firestore"
 *   2. Configure: collection = "mail", SMTP connection URI, default FROM
 *   3. Wait ~2 min for deployment.
 *
 * Document shape (see extension docs for full reference):
 *   {
 *     to:      string | string[],
 *     uid?:    string,                  // owner uid; gated by firestore.rules
 *     message: { subject, html, text }
 *   }
 *
 * Security model: customers may enqueue mail addressed only to their own
 * verified email (rule lives in firestore.rules). Admin alerts go through
 * `adminNotificationsApi` instead and stay in-app until a Cloud Function
 * promotes them to email — that keeps admin contact details out of any
 * customer-writable collection.
 */
const emailApi = {
  enqueue: async (input: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }) => {
    if (!auth.currentUser) throw new Error('not_signed_in');
    return addDoc(collection(db, 'mail'), {
      uid: auth.currentUser.uid,
      to: input.to,
      message: {
        subject: input.subject,
        html: input.html,
        text: input.text,
      },
      createdAt: serverTimestamp(),
    });
  },
};

/** Plain-text + HTML body builders. Voice follows branding/BRAND.md:
 *  curated, restrained, archival; no exclamation marks. */
function rupee(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

function buildOrderConfirmationEmail(args: {
  customerName: string;
  orderId: string;
  items: { fabricSnapshot: { name: string; brand?: string; price: number }; quantity: number; color?: string }[];
  subtotal: number;
  shipping: number;
  total: number;
  shippingAddressLine: string;
}) {
  const { customerName, orderId, items, subtotal, shipping, total, shippingAddressLine } = args;
  const lineRows = items.map(it => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #EAD9BA;color:#2A1F12;font-family:Georgia,serif">
        ${it.fabricSnapshot.name}${it.color ? ` &middot; ${it.color}` : ''}<br/>
        <span style="font-size:12px;color:#8E6520">Qty ${it.quantity} &middot; ${rupee(it.fabricSnapshot.price)}</span>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #EAD9BA;color:#2A1F12;font-family:Georgia,serif;text-align:right">
        ${rupee(it.fabricSnapshot.price * it.quantity)}
      </td>
    </tr>`).join('');

  const subject = `Tresor Couture — your order ${orderId.slice(0, 8)} is placed`;
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#F5ECDC;font-family:Georgia,serif;color:#2A1F12">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5ECDC;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#FBF5EA;border:1px solid #EAD9BA">
        <tr><td style="padding:32px 36px 8px 36px;text-align:center">
          <div style="font-size:13px;letter-spacing:0.24em;color:#B8893A;font-family:Helvetica,Arial,sans-serif">TRESOR &middot; COUTURE</div>
          <div style="height:1px;background:#B8893A;width:80px;margin:14px auto"></div>
        </td></tr>
        <tr><td style="padding:8px 36px 24px 36px">
          <p style="font-size:22px;font-style:italic;margin:0 0 16px 0;color:#2A1F12">Dear ${customerName},</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 16px 0">Thank you for your order. We have begun the careful business of preparing it.</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 24px 0">Your order reference is <strong>${orderId.slice(0, 8).toUpperCase()}</strong>.</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #B8893A;margin:8px 0 20px 0">
            <tr><td style="padding:12px 0 8px 0;font-size:11px;letter-spacing:0.2em;color:#8E6520;font-family:Helvetica,Arial,sans-serif">YOUR ORDER</td></tr>
            ${lineRows}
            <tr><td colspan="2" style="padding:14px 0 4px 0;text-align:right;font-size:13px;color:#6B6358">Subtotal (incl. 5% GST) &nbsp;&nbsp; ${rupee(subtotal)}</td></tr>
            <tr><td colspan="2" style="padding:4px 0;text-align:right;font-size:13px;color:#6B6358">Shipping &nbsp;&nbsp; ${shipping === 0 ? 'Complimentary' : rupee(shipping)}</td></tr>
            <tr><td colspan="2" style="padding:8px 0 0 0;text-align:right;font-size:16px;font-weight:bold;color:#2A1F12">Total &nbsp;&nbsp; ${rupee(total)}</td></tr>
          </table>

          <p style="font-size:12px;letter-spacing:0.2em;color:#8E6520;font-family:Helvetica,Arial,sans-serif;margin:24px 0 6px 0">SHIPPING TO</p>
          <p style="font-size:14px;line-height:1.6;margin:0 0 24px 0">${shippingAddressLine}</p>

          <p style="font-size:14px;line-height:1.6;margin:0">You will receive another note the moment the parcel leaves the atelier.</p>
          <p style="font-size:14px;line-height:1.6;margin:16px 0 0 0;font-style:italic">— The Tresor Couture team</p>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:1px solid #EAD9BA;font-size:11px;color:#8E6520;font-family:Helvetica,Arial,sans-serif;text-align:center">
          A reply to this email reaches us directly. tresor-couture.vercel.app
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;

  const text = [
    `Dear ${customerName},`,
    '',
    'Thank you for your order. We have begun the careful business of preparing it.',
    `Your order reference is ${orderId.slice(0, 8).toUpperCase()}.`,
    '',
    'YOUR ORDER',
    ...items.map(it => `  ${it.fabricSnapshot.name}${it.color ? ` (${it.color})` : ''} — Qty ${it.quantity} @ ${rupee(it.fabricSnapshot.price)} = ${rupee(it.fabricSnapshot.price * it.quantity)}`),
    '',
    `Subtotal (incl. 5% GST):  ${rupee(subtotal)}`,
    `Shipping:  ${shipping === 0 ? 'Complimentary' : rupee(shipping)}`,
    `Total:     ${rupee(total)}`,
    '',
    `Shipping to: ${shippingAddressLine}`,
    '',
    'You will receive another note the moment the parcel leaves the atelier.',
    '',
    '— The Tresor Couture team',
  ].join('\n');

  return { subject, html, text };
}

function buildOrderStatusEmail(args: { customerName: string; orderId: string; status: string }) {
  const { customerName, orderId, status } = args;
  const headlines: Record<string, { headline: string; body: string }> = {
    processing: {
      headline: 'Your order is being prepared.',
      body: 'The pieces are being checked, folded, and made ready for despatch.',
    },
    shipped: {
      headline: 'Your order has left the atelier.',
      body: 'The parcel is now with the courier. We will share tracking shortly.',
    },
    delivered: {
      headline: 'Your order has been delivered.',
      body: 'We hope it arrived as carefully as it was packed. A note back would be welcome.',
    },
    cancelled: {
      headline: 'Your order has been cancelled.',
      body: 'A refund, where applicable, has been initiated and will reach you within 5 working days.',
    },
    refunded: {
      headline: 'Your refund has been processed.',
      body: 'It should reflect on the original payment method within 3 working days.',
    },
  };
  const { headline, body } = headlines[status] ?? {
    headline: `Your order status: ${status}`,
    body: 'A small change to your order has been recorded.',
  };

  const subject = `Tresor Couture — ${headline.toLowerCase().replace(/\.$/, '')}`;
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#F5ECDC;font-family:Georgia,serif;color:#2A1F12">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5ECDC;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#FBF5EA;border:1px solid #EAD9BA">
        <tr><td style="padding:32px 36px 8px 36px;text-align:center">
          <div style="font-size:13px;letter-spacing:0.24em;color:#B8893A;font-family:Helvetica,Arial,sans-serif">TRESOR &middot; COUTURE</div>
          <div style="height:1px;background:#B8893A;width:80px;margin:14px auto"></div>
        </td></tr>
        <tr><td style="padding:8px 36px 28px 36px">
          <p style="font-size:22px;font-style:italic;margin:0 0 16px 0">Dear ${customerName},</p>
          <p style="font-size:18px;font-style:italic;color:#8E6520;margin:0 0 16px 0">${headline}</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 16px 0">${body}</p>
          <p style="font-size:13px;color:#6B6358;margin:0">Order reference: <strong>${orderId.slice(0, 8).toUpperCase()}</strong></p>
          <p style="font-size:14px;line-height:1.6;margin:24px 0 0 0;font-style:italic">— The Tresor Couture team</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;

  const text = [
    `Dear ${customerName},`, '',
    headline, '',
    body, '',
    `Order reference: ${orderId.slice(0, 8).toUpperCase()}`, '',
    '— The Tresor Couture team',
  ].join('\n');
  return { subject, html, text };
}

/* ------------------------------------------------------------------ */
/*  Resource APIs                                                     */
/* ------------------------------------------------------------------ */

/**
 * One-shot bulk import. Used by the admin "Seed catalog" button to push the
 * in-repo FABRICS array into Firestore on first run, so the storefront
 * doesn't show empty rails before any product is added through the CRUD.
 * Idempotent — checks the products collection size and bails if already
 * populated, unless `force: true` is passed.
 */
export async function seedCatalog(items: DocumentData[], opts: { force?: boolean } = {}): Promise<{ seeded: number; skipped: boolean; reason?: string }> {
  const existing = await getDocs(query(collection(db, 'products'), qLimit(1)));
  if (!existing.empty && !opts.force) return { seeded: 0, skipped: true, reason: 'already_populated' };
  let seeded = 0;
  try {
    for (const it of items) {
      const ref = doc(collection(db, 'products'));
      await setDoc(ref, { ...it, id: ref.id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      seeded += 1;
    }
  } catch (err) {
    // Firestore rules deny unauthenticated writes; treat as a graceful skip
    // rather than a crash so the auto-seed call from Home for guests is safe.
    const code = (err as { code?: string }).code;
    if (code === 'permission-denied') return { seeded, skipped: true, reason: 'permission_denied' };
    throw err;
  }
  return { seeded, skipped: false };
}

export const productsApi = {
  list:   (opts: { masterCategory?: string; subCategory?: string; limit?: number } = {}) => {
    const c: QueryConstraint[] = [];
    if (opts.masterCategory) c.push(where('masterCategory', '==', opts.masterCategory));
    if (opts.subCategory)    c.push(where('subCategory',    '==', opts.subCategory));
    c.push(qLimit(opts.limit ?? 100));
    return listAll<DocumentData>('products', c);
  },
  get:    (id: string) => getOne<DocumentData>('products', id),
  create: async (data: DocumentData) => {
    const ref = await addDoc(collection(db, 'products'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await updateDoc(ref, { id: ref.id });
    return { ...data, id: ref.id };
  },
  update: (id: string, patch: DocumentData) =>
    updateDoc(doc(db, 'products', id), { ...patch, updatedAt: serverTimestamp() }),
  remove: (id: string) => deleteDoc(doc(db, 'products', id)),
  /** Delete every document in the products collection. Returns count deleted. */
  removeAll: async () => {
    let deleted = 0;
    while (true) {
      const snap = await getDocs(query(collection(db, 'products'), qLimit(400)));
      if (snap.empty) break;
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      deleted += snap.size;
    }
    return deleted;
  },
  /** Seed products preserving their explicit ids. */
  seedWithIds: async (items: DocumentData[]) => {
    let seeded = 0;
    for (const it of items) {
      const id = it.id as string | undefined;
      if (!id) continue;
      await setDoc(doc(db, 'products', id), {
        ...it,
        id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      seeded += 1;
    }
    return seeded;
  }
};

/* ------------------------------------------------------------------ */
/*  Delivery config — 40-minute serviceability (admin-editable)        */
/* ------------------------------------------------------------------ */
/**
 * The serviceable-pincode list for 40-minute delivery lives in a single
 * Firestore doc `config/delivery` (public read so the storefront can check
 * eligibility; admin-only write). The storefront falls back to the seed list
 * in src/lib/serviceability.ts if the doc is missing or unreadable, so the
 * feature works before any admin edit.
 */
export const deliveryConfigApi = {
  /** Read the serviceable pincode list. Returns null if unset/unreadable. */
  get: async (): Promise<{ pincodes: string[]; updatedAt?: unknown } | null> => {
    try {
      const snap = await getDoc(doc(db, 'config', 'delivery'));
      if (!snap.exists()) return null;
      const data = snap.data() as { pincodes?: unknown };
      const pincodes = Array.isArray(data.pincodes)
        ? data.pincodes.filter((p): p is string => typeof p === 'string')
        : [];
      return { pincodes };
    } catch {
      return null;
    }
  },
  /** Admin-only: replace the serviceable pincode list. */
  setPincodes: (pincodes: string[]) =>
    setDoc(
      doc(db, 'config', 'delivery'),
      { pincodes, updatedAt: serverTimestamp() },
      { merge: true },
    ),
};

/** Best-effort post-placement notifications (buyer email + in-app admin alert),
 *  shared by the server and client order-placement paths. Never throws — a
 *  notification failure must not lose the order (the order doc is the source of
 *  truth). */
async function postPlaceNotify(order: DocumentData & { id: string }): Promise<void> {
  try {
    const u = auth.currentUser;
    if (!u) return;
    const email = u.email;
    const name = u.displayName ?? email?.split('@')[0] ?? 'Tresor Member';
    const addr = (order.shippingAddress ?? {}) as { fullName?: string; line1?: string; line2?: string; city?: string; state?: string; pincode?: string };
    const addrLine = [addr.fullName, addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
    const items = Array.isArray(order.items) ? order.items : [];
    if (email) {
      const { subject, html, text } = buildOrderConfirmationEmail({
        customerName: name,
        orderId: order.id,
        items: items as never,
        subtotal: Number(order.subtotal) || 0,
        shipping: Number(order.shipping) || 0,
        total: Number(order.total) || 0,
        shippingAddressLine: addrLine,
      });
      await emailApi.enqueue({ to: email, subject, html, text });
    }
    // In-app admin alert. A future Cloud Function can promote these to email.
    await addDoc(collection(db, 'admin_notifications'), {
      kind: 'new_order',
      orderId: order.id,
      userId: u.uid,
      customerEmail: email ?? null,
      total: Number(order.total) || 0,
      itemCount: items.length,
      createdAt: serverTimestamp(),
      read: false,
    });
  } catch (err) {
    console.warn('[orders] post-place notifications failed', (err as Error).message);
  }
}

export const ordersApi = {
  mine: async () => {
    if (!auth.currentUser) throw new Error('not_signed_in');
    return listAll<DocumentData>('orders', [
      where('userId', '==', auth.currentUser.uid),
      orderBy('placedAt', 'desc'),
      qLimit(100)
    ]);
  },
  all:  () => listAll<DocumentData>('orders', [orderBy('placedAt', 'desc'), qLimit(200)]),
  get:  (id: string) => getOne<DocumentData>('orders', id),
  place: async (input: {
    items: { fabricId: string; quantity: number; color?: string }[];
    shippingAddress: DocumentData;
    paymentMethod: 'card' | 'upi' | 'cod';
    couponCode?: string;
  }) => {
    if (!auth.currentUser) throw new Error('not_signed_in');

    // Server-authoritative path only. The endpoint recomputes pricing, decrements
    // stock transactionally, and creates the order. There is no client-side
    // fallback: a missing service account or a server misconfiguration must
    // surface as a clear error rather than allowing a direct Firestore write.
    const token = await auth.currentUser.getIdToken();
    const res = await apiPost('/api/orders/place', {
      order: {
        items: input.items,
        couponCode: input.couponCode,
        paymentMethod: input.paymentMethod,
        shippingAddress: input.shippingAddress,
      },
    }, { authorization: `Bearer ${token}` });

    const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
    if (res.status === 503 || !isJson) {
      throw new Error('orders_not_configured');
    }

    const data = (await res.json().catch(() => ({}))) as { orderId?: string; error?: string };
    if (!res.ok || !data.orderId) throw new Error(data.error || 'place_failed');

    const saved = (await getOne<DocumentData>('orders', data.orderId)) ?? {};
    const placed = { id: data.orderId, ...saved } as DocumentData & { id: string };
    await postPlaceNotify(placed);
    return placed;
  },
  setStatus: async (id: string, status: 'placed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded') => {
    await updateDoc(doc(db, 'orders', id), { status, updatedAt: serverTimestamp() });
    // Email the customer about the status change. Admin-only writes to
    // mail/ are allowed by the rules, so this works from the admin console.
    try {
      const ord = await getOne<DocumentData>('orders', id);
      const userId = (ord as { userId?: string } | null)?.userId;
      if (!userId) return;
      const profile = await getOne<DocumentData>('users', userId);
      const email = (profile as { email?: string } | null)?.email;
      const fullName = (profile as { fullName?: string } | null)?.fullName ?? 'Tresor Member';
      if (!email) return;
      const { subject, html, text } = buildOrderStatusEmail({ customerName: fullName, orderId: id, status });
      await emailApi.enqueue({ to: email, subject, html, text });
    } catch (err) {
      console.warn('[orders] status-change email failed', (err as Error).message);
    }
  }
};

export const couponsApi = {
  list:    () => listAll<DocumentData>('coupons'),
  get:     async (code: string) =>
    (await getOne<DocumentData>('coupons', code.toUpperCase()))
      ?? (getBuiltinCoupon(code) as DocumentData | null),
  upsert:  async (c: { code: string; description: string; kind: 'percent' | 'flat'; value: number; minSubtotal?: number; maxDiscount?: number; expiresAt?: string; active: boolean }) => {
    const code = c.code.toUpperCase();
    await setDoc(doc(db, 'coupons', code), { ...c, code });
    return { ...c, code };
  },
  remove:  (code: string) => deleteDoc(doc(db, 'coupons', code.toUpperCase())),
  validate: async (code: string, subtotal: number) => {
    // Firestore doc wins (admin-managed); otherwise fall back to the built-in
    // advertised coupons so the codes promoted on the cart/checkout always work
    // even when the `coupons` collection hasn't been seeded.
    const c = (await getOne<DocumentData>('coupons', code.toUpperCase()))
      ?? (getBuiltinCoupon(code) as DocumentData | null);
    if (!c) return { valid: false, reason: 'not_found' as const };
    const cd = c as { active?: boolean; kind?: 'percent' | 'flat'; value?: number; minSubtotal?: number; maxDiscount?: number; expiresAt?: string };
    if (!cd.active) return { valid: false, reason: 'inactive' as const };
    if (cd.expiresAt && new Date(cd.expiresAt).getTime() < Date.now()) return { valid: false, reason: 'expired' as const };
    if (cd.minSubtotal && subtotal < cd.minSubtotal) return { valid: false, reason: 'min_subtotal' as const, minSubtotal: cd.minSubtotal };
    const discount = cd.kind === 'percent'
      ? Math.min(cd.maxDiscount ?? Infinity, Math.round(subtotal * ((cd.value ?? 0) / 100)))
      : (cd.value ?? 0);
    return { valid: true as const, discount, code: cd as DocumentData };
  }
};

export const reviewsApi = {
  forProduct: (fabricId: string) => listAll<DocumentData>('reviews', [
    where('fabricId', '==', fabricId),
    where('status', '==', 'approved'),
    orderBy('createdAt', 'desc'),
    qLimit(100)
  ]),
  create: async (input: { fabricId: string; rating: 1|2|3|4|5; title?: string; body: string; authorName: string }) => {
    if (!auth.currentUser) throw new Error('not_signed_in');
    const ref = await addDoc(collection(db, 'reviews'), {
      ...input,
      userId: auth.currentUser.uid,
      status: 'pending' as const,
      createdAt: new Date().toISOString()
    });
    return { id: ref.id, ...input };
  },
  moderate: (id: string, status: 'pending' | 'approved' | 'rejected') =>
    updateDoc(doc(db, 'reviews', id), { status })
};

export const usersApi = {
  me: async () => {
    if (!auth.currentUser) return null;
    return getOne<DocumentData>('users', auth.currentUser.uid);
  },
  updateMe: (patch: DocumentData) => {
    if (!auth.currentUser) throw new Error('not_signed_in');
    return updateDoc(doc(db, 'users', auth.currentUser.uid), patch);
  },
  list: () => listAll<DocumentData>('users', [qLimit(200)]),

  /**
   * DPDP "right to access" — assemble everything we hold about one user into a
   * single portable object: their profile, orders, reviews and consent record.
   * Admin-only by the rules (or the user themselves for their own uid). The
   * caller turns this into a JSON download (see lib/csv.downloadJson).
   */
  exportData: async (uid: string) => {
    const [profile, orders, reviews, consent] = await Promise.all([
      getOne<DocumentData>('users', uid),
      listAll<DocumentData>('orders', [where('userId', '==', uid), qLimit(500)]),
      listAll<DocumentData>('reviews', [where('userId', '==', uid), qLimit(500)]),
      getOne<DocumentData>('consents', uid),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      uid,
      profile,
      orders,
      reviews,
      consent,
    };
  },

  /**
   * DPDP "right to erasure", within the rules-only model. We:
   *   1. Anonymise PII on the user's orders (name/email/phone/address stripped)
   *      but KEEP the financial fields — GST/tax law requires invoices be
   *      retained, so we redact rather than delete the order rows.
   *   2. Delete their reviews and consent record.
   *   3. Delete the user profile document.
   * The Firebase Auth identity itself can only be removed with the Admin SDK
   * (server-side), so that remains a manual step — surfaced in the UI.
   */
  adminAnonymiseAndDelete: async (uid: string) => {
    const orders = await listAll<DocumentData>('orders', [where('userId', '==', uid), qLimit(500)]);
    for (const o of orders) {
      await updateDoc(doc(db, 'orders', o.id), {
        shippingAddress: {
          fullName: '[redacted]', email: '[redacted]', phone: '[redacted]',
          line1: '[redacted]', line2: '', city: '[redacted]',
          state: (o as { shippingAddress?: { state?: string } }).shippingAddress?.state ?? '',
          postalCode: '', country: 'India',
        },
        anonymisedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
    }
    const reviews = await listAll<DocumentData>('reviews', [where('userId', '==', uid), qLimit(500)]);
    for (const r of reviews) {
      await deleteDoc(doc(db, 'reviews', r.id));
    }
    await deleteDoc(doc(db, 'consents', uid)).catch(() => {});
    await deleteDoc(doc(db, 'users', uid));
    return { ordersAnonymised: orders.length, reviewsDeleted: reviews.length };
  },
};

/**
 * Cookie/marketing consent (DPDP). Owner reads/writes their own doc; admins
 * read all for the compliance register (see firestore.rules /consents).
 */
export const consentsApi = {
  mine: async () => {
    if (!auth.currentUser) return null;
    return getOne<DocumentData>('consents', auth.currentUser.uid);
  },
  setMine: async (input: { analytics: boolean; marketing: boolean; policyVersion: string }) => {
    if (!auth.currentUser) throw new Error('not_signed_in');
    const uid = auth.currentUser.uid;
    await setDoc(doc(db, 'consents', uid), {
      uid,
      analytics: input.analytics,
      marketing: input.marketing,
      policyVersion: input.policyVersion,
      updatedAt: new Date().toISOString(),
    });
  },
  list: () => listAll<DocumentData>('consents', [qLimit(500)]),
};

export { Timestamp };
