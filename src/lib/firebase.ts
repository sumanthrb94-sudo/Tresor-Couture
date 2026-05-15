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
  GoogleAuthProvider,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  type User as FbUser
} from 'firebase/auth';
import {
  getFirestore,
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

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

const firebaseConfig = {
  apiKey:            env.VITE_FIREBASE_API_KEY            ?? 'AIzaSyAIct4PdHb0YaNCYpLdGxh1kDlukwwc_3M',
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN        ?? 'tresor-couture.firebaseapp.com',
  projectId:         env.VITE_FIREBASE_PROJECT_ID         ?? 'tresor-couture',
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET     ?? 'tresor-couture.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '102541847727',
  appId:             env.VITE_FIREBASE_APP_ID             ?? '1:102541847727:web:40ef34c4ec6d001c20f85a'
};

const app: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/* ------------------------------------------------------------------ */
/*  Auth                                                              */
/* ------------------------------------------------------------------ */

export async function register(input: { email: string; password: string; fullName: string; phone?: string }) {
  const cred = await createUserWithEmailAndPassword(auth, input.email, input.password);
  await updateProfile(cred.user, { displayName: input.fullName });
  const profile = {
    uid: cred.user.uid,
    email: input.email,
    fullName: input.fullName,
    phone: input.phone ?? null,
    role: 'customer' as const,
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'users', cred.user.uid), profile);
  return { user: cred.user, profile };
}

export async function login(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/**
 * Google sign-in via popup. On the first login we materialise a
 * /users/{uid} profile doc so the rest of the app (Account page, orders,
 * reviews) can read it without a special-case for Google users.
 */
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  const existing = await getDoc(doc(db, 'users', cred.user.uid));
  if (!existing.exists()) {
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid:       cred.user.uid,
      email:     cred.user.email ?? '',
      fullName:  cred.user.displayName ?? cred.user.email?.split('@')[0] ?? 'Trésor Member',
      phone:     cred.user.phoneNumber ?? null,
      role:      'customer' as const,
      photoURL:  cred.user.photoURL ?? null,
      createdAt: new Date().toISOString()
    });
  }
  return cred.user;
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
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as T) }));
}

async function getOne<T>(name: string, id: string): Promise<(T & { id: string }) | null> {
  const snap = await getDoc(doc(db, name, id));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as T) }) : null;
}

/* ------------------------------------------------------------------ */
/*  Resource APIs                                                     */
/* ------------------------------------------------------------------ */

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
  remove: (id: string) => deleteDoc(doc(db, 'products', id))
};

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
    items: { fabricId: string; meters: number; color?: string }[];
    shippingAddress: DocumentData;
    paymentMethod: 'card' | 'upi' | 'cod';
    couponCode?: string;
  }) => {
    if (!auth.currentUser) throw new Error('not_signed_in');
    // Pull current product data so totals reflect real prices.
    const items = await Promise.all(input.items.map(async (it) => {
      const p = await getOne<DocumentData>('products', it.fabricId);
      if (!p) throw new Error(`unknown_product:${it.fabricId}`);
      return { ...it, fabricSnapshot: p };
    }));
    const subtotal = items.reduce((s, it) => {
      const p = (it.fabricSnapshot as unknown as { pricePerMeter: number }).pricePerMeter;
      return s + p * it.meters;
    }, 0);
    // Coupon lookup (public-read rule)
    let couponDiscount = 0;
    if (input.couponCode) {
      const c = await getOne<DocumentData>('coupons', input.couponCode.toUpperCase());
      const cd = c as { active?: boolean; kind?: 'percent' | 'flat'; value?: number; minSubtotal?: number; maxDiscount?: number; expiresAt?: string } | null;
      const valid = cd && cd.active
        && (!cd.expiresAt || new Date(cd.expiresAt).getTime() > Date.now())
        && (!cd.minSubtotal || subtotal >= cd.minSubtotal);
      if (valid && cd) {
        couponDiscount = cd.kind === 'percent'
          ? Math.min(cd.maxDiscount ?? Infinity, Math.round(subtotal * ((cd.value ?? 0) / 100)))
          : (cd.value ?? 0);
      }
    }
    const taxable = Math.max(0, subtotal - couponDiscount);
    const tax = Math.round(taxable * 0.05);
    const shipping = taxable >= 1999 ? 0 : 99;
    const total = taxable + tax + shipping;
    const order = {
      userId: auth.currentUser.uid,
      items,
      subtotal, tax, shipping, total,
      shippingAddress: input.shippingAddress,
      paymentMethod: input.paymentMethod,
      placedAt: new Date().toISOString(),
      status: 'placed' as const,
      ...(input.couponCode ? { couponCode: input.couponCode.toUpperCase(), couponDiscount } : {})
    };
    const ref = await addDoc(collection(db, 'orders'), order);
    return { id: ref.id, ...order };
  },
  setStatus: (id: string, status: 'placed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded') =>
    updateDoc(doc(db, 'orders', id), { status, updatedAt: serverTimestamp() })
};

export const couponsApi = {
  list:    () => listAll<DocumentData>('coupons'),
  get:     (code: string) => getOne<DocumentData>('coupons', code.toUpperCase()),
  upsert:  async (c: { code: string; description: string; kind: 'percent' | 'flat'; value: number; minSubtotal?: number; maxDiscount?: number; expiresAt?: string; active: boolean }) => {
    const code = c.code.toUpperCase();
    await setDoc(doc(db, 'coupons', code), { ...c, code });
    return { ...c, code };
  },
  remove:  (code: string) => deleteDoc(doc(db, 'coupons', code.toUpperCase())),
  validate: async (code: string, subtotal: number) => {
    const c = await getOne<DocumentData>('coupons', code.toUpperCase());
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
  list: () => listAll<DocumentData>('users', [qLimit(200)])
};

export { Timestamp };
