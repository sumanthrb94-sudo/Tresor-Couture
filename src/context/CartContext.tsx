import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, productsApi } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { CartItem, Fabric } from '../types';
import { FABRICS, FREE_SHIPPING_THRESHOLD, SHIPPING_FLAT_RATE, TAX_RATE } from '../constants';

const STORAGE_KEY = 'tresor-cart-v1';
// Tracks the uid we've already performed the one-time guest-merge for, so a
// page refresh while signed in doesn't keep re-merging stale localStorage.
const MERGE_FLAG_KEY = 'tresor-cart-merged-uid';
// Throttle Firestore writes so a flurry of +/- clicks collapses to one doc
// write. 600 ms is generous for human input cadence and keeps the free-tier
// write budget healthy (20k writes/day): even an aggressive editor making
// 100 mutations in a session costs ~100 writes (one per debounced burst).
const FIRESTORE_WRITE_DEBOUNCE_MS = 600;

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateQuantity: (fabricId: string, color: string | undefined, quantity: number) => void;
  removeItem: (fabricId: string, color: string | undefined) => void;
  clear: () => void;
  /** Alias of clear() — semantic name used by checkout/payment flow. */
  clearCart: () => void;
  itemCount: number;
  unitCount: number;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  resolved: { item: CartItem; fabric: Fabric }[];
  /** True while we're still fetching product details for cart items from
   *  Firestore. Use to gate the "empty cart" UI so it doesn't flash. */
  resolving: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

const loadCart = (): CartItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
};

const sameLine = (a: CartItem, b: CartItem) =>
  a.fabricId === b.fabricId && (a.color ?? '') === (b.color ?? '');

const mergeLines = (a: CartItem[], b: CartItem[]): CartItem[] => {
  const out: CartItem[] = [...a];
  for (const inc of b) {
    const idx = out.findIndex(x => sameLine(x, inc));
    if (idx === -1) out.push(inc);
    else out[idx] = { ...out[idx], quantity: out[idx].quantity + inc.quantity };
  }
  return out.filter(x => x.quantity > 0);
};

const sanitiseItems = (raw: unknown): CartItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is CartItem =>
      !!x && typeof x === 'object'
      && typeof (x as CartItem).fabricId === 'string'
      && typeof (x as CartItem).quantity === 'number'
    )
    .map(x => ({ fabricId: x.fabricId, quantity: x.quantity, color: x.color }));
};

/** Firestore rejects `undefined` values. Strip optional `color` when absent. */
const firestoreCartItems = (items: CartItem[]): Record<string, unknown>[] =>
  items.map(item => {
    const clean: Record<string, unknown> = { fabricId: item.fabricId, quantity: item.quantity };
    if (item.color !== undefined) clean.color = item.color;
    return clean;
  });

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>(() => loadCart());

  // Source-of-truth gate: while a signed-in user's Firestore doc is still
  // loading, local edits must NOT push ahead and clobber the remote bag
  // with a stale snapshot.
  const remoteReadyRef = useRef(false);
  // After we adopt an incoming Firestore snapshot, the resulting setItems
  // would otherwise echo back as a Firestore write. Suppress that one tick.
  const skipNextSyncRef = useRef(false);
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWriteRef = useRef<CartItem[] | null>(null);
  const currentUidRef = useRef<string | null>(null);
  // Tracks whether we have ever observed a signed-in user in this session, so
  // the sign-out cleanup only runs on an explicit transition to signed-out
  // rather than on the initial mount when `user` is still null. Without this,
  // the effect would wipe the guest cart loaded from localStorage on every
  // page reload.
  const hadUserRef = useRef(false);

  // Product details cache — cart items only store the fabricId, so we resolve
  // the rest from Firestore on demand. FABRICS (static seed) is the fallback
  // for legacy cart entries that predate the Firestore migration.
  const [productCache, setProductCache] = useState<Map<string, Fabric>>(() => {
    const m = new Map<string, Fabric>();
    for (const f of FABRICS) m.set(f.id, f);
    return m;
  });
  const [resolving, setResolving] = useState(false);
  // Ids that failed to resolve (deleted product, rules/network error). Held in
  // a ref — NOT state — so they're excluded from refetch without re-triggering
  // the resolve effect, which previously looped forever: the effect always
  // built a brand-new Map (new reference) even when nothing resolved, which
  // re-ran the effect, which refetched the still-missing id, ad infinitum.
  const failedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const missingIds = Array.from(new Set(items.map(i => i.fabricId)))
      .filter(id => !productCache.has(id) && !failedIdsRef.current.has(id));
    if (missingIds.length === 0) {
      setResolving(false);
      return;
    }
    let cancelled = false;
    setResolving(true);
    (async () => {
      const fetched = await Promise.all(missingIds.map(id => productsApi.get(id).catch(() => null)));
      if (cancelled) return;
      // Tombstone ids that came back empty so we never refetch them this session.
      missingIds.forEach((id, i) => { if (!fetched[i]) failedIdsRef.current.add(id); });
      // Only commit a new Map (which re-runs this effect) when something actually
      // resolved — otherwise the all-failed case would loop.
      if (fetched.some(Boolean)) {
        setProductCache(prev => {
          const next = new Map(prev);
          fetched.forEach((p, i) => { if (p) next.set(missingIds[i], p as unknown as Fabric); });
          return next;
        });
      }
      setResolving(false);
    })();
    return () => { cancelled = true; };
  }, [items, productCache]);

  // localStorage mirror — always on, so guests and offline signed-in users
  // both keep working without the network.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore quota errors */
    }
  }, [items]);

  // Firestore subscription + write pipeline. Lives entirely inside the
  // signed-in branch; signing out tears it down and reverts to localStorage.
  useEffect(() => {
    if (!user) {
      // Only clear state on an explicit sign-out transition. On initial mount
      // `user` is null but the guest cart has already been loaded from
      // localStorage — clearing here would wipe it on every page reload.
      if (hadUserRef.current) {
        setItems([]);
        try { localStorage.removeItem(MERGE_FLAG_KEY); } catch { /* ignore */ }
      }
      hadUserRef.current = false;
      currentUidRef.current = null;
      remoteReadyRef.current = false;
      skipNextSyncRef.current = false;
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current);
        writeTimerRef.current = null;
      }
      pendingWriteRef.current = null;
      return;
    }

    hadUserRef.current = true;
    const uid = user.id;
    currentUidRef.current = uid;
    remoteReadyRef.current = false;
    const cartRef = doc(db, 'carts', uid);

    const unsub = onSnapshot(
      cartRef,
      snap => {
        if (currentUidRef.current !== uid) return; // user changed mid-flight
        const remoteItems = snap.exists()
          ? sanitiseItems((snap.data() as { items?: unknown }).items)
          : [];

        let mergedFlagRaw: string | null = null;
        try { mergedFlagRaw = localStorage.getItem(MERGE_FLAG_KEY); } catch { /* ignore */ }
        const alreadyMerged = mergedFlagRaw === uid;

        if (!alreadyMerged) {
          // ONE-TIME merge of any items the user added as a guest (now in
          // local state) into whatever Firestore already has. This is the
          // only place we union the two bags — every subsequent update
          // treats Firestore as authoritative, so a delete on device A
          // actually removes the line on device B.
          const guestItems = loadCart();
          const merged = mergeLines(remoteItems, guestItems);
          remoteReadyRef.current = true;
          // We're about to write `merged` ourselves; suppress the echo.
          skipNextSyncRef.current = true;
          setItems(merged);
          try { localStorage.setItem(MERGE_FLAG_KEY, uid); } catch { /* ignore */ }
          if (JSON.stringify(merged) !== JSON.stringify(remoteItems)) {
            void setDoc(
              cartRef,
              { uid, items: firestoreCartItems(merged), updatedAt: new Date().toISOString() },
              { merge: true }
            ).catch(() => { /* offline / rules — localStorage still works */ });
          }
        } else {
          // Remote is authoritative; adopt it verbatim and don't loop.
          skipNextSyncRef.current = true;
          remoteReadyRef.current = true;
          setItems(remoteItems);
        }
      },
      () => {
        // Permission/network error — fall back silently to local state.
        remoteReadyRef.current = true;
      }
    );

    return () => {
      unsub();
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current);
        writeTimerRef.current = null;
      }
    };
  }, [user]);

  // Debounced Firestore write whenever local items change while signed in.
  useEffect(() => {
    if (!user || !remoteReadyRef.current) return;
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    const uid = user.id;
    pendingWriteRef.current = items;
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(() => {
      const snapshot = pendingWriteRef.current ?? items;
      void setDoc(
        doc(db, 'carts', uid),
        { uid, items: firestoreCartItems(snapshot), updatedAt: new Date().toISOString() },
        { merge: true }
      ).catch(() => { /* offline — localStorage keeps the bag */ });
      writeTimerRef.current = null;
    }, FIRESTORE_WRITE_DEBOUNCE_MS);
  }, [items, user]);

  const addItem = (incoming: CartItem) => {
    setItems(prev => {
      const idx = prev.findIndex(i => sameLine(i, incoming));
      if (idx === -1) return [...prev, incoming];
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: next[idx].quantity + incoming.quantity };
      return next;
    });
  };

  const updateQuantity = (fabricId: string, color: string | undefined, quantity: number) => {
    setItems(prev =>
      prev
        .map(i => (sameLine(i, { fabricId, color, quantity }) ? { ...i, quantity } : i))
        .filter(i => i.quantity > 0)
    );
  };

  const removeItem = (fabricId: string, color: string | undefined) => {
    setItems(prev => prev.filter(i => !sameLine(i, { fabricId, color, quantity: 0 })));
  };

  const clear = () => {
    setItems([]);
    // Authoritatively clear the REMOTE bag immediately. We can't rely on the
    // debounced writer here: placing an order also saves the default address,
    // which re-hydrates the user → the Firestore-subscription effect re-runs
    // and its cleanup cancels the pending clear-write. The next snapshot then
    // reads the still-populated cart and the order's items reappear. Writing []
    // now (optimistically updating Firestore's local cache) means the
    // re-subscribe reads an empty bag. No-op for guests (no uid).
    const uid = currentUidRef.current;
    if (uid) {
      if (writeTimerRef.current) { clearTimeout(writeTimerRef.current); writeTimerRef.current = null; }
      pendingWriteRef.current = [];
      // Suppress the echo write the items-effect would otherwise queue.
      skipNextSyncRef.current = true;
      void setDoc(
        doc(db, 'carts', uid),
        { uid, items: [], updatedAt: new Date().toISOString() },
        { merge: true }
      ).catch(() => { /* offline — localStorage mirror already cleared */ });
    }
  };
  const clearCart = clear;

  const value = useMemo<CartContextValue>(() => {
    const resolved = items
      .map(item => {
        const fabric = productCache.get(item.fabricId);
        return fabric ? { item, fabric } : null;
      })
      .filter((x): x is { item: CartItem; fabric: Fabric } => x !== null);

    const subtotal = resolved.reduce((sum, { item, fabric }) => sum + item.quantity * fabric.price, 0);
    const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_RATE;
    // Product prices are advertised and stored as tax-inclusive ("inclusive of all taxes").
    // Report the GST component for disclosure/invoices, but do NOT add it on top again.
    const tax = Math.round((subtotal * TAX_RATE) / (1 + TAX_RATE));
    const total = subtotal + shipping;
    const itemCount = resolved.length;
    const unitCount = resolved.reduce((sum, { item }) => sum + item.quantity, 0);

    return {
      items,
      addItem,
      updateQuantity,
      removeItem,
      clear,
      clearCart,
      itemCount,
      unitCount,
      subtotal,
      shipping,
      tax,
      total,
      resolved,
      resolving
    };
  }, [items, productCache, resolving]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
};
