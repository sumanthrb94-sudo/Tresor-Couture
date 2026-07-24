/**
 * Support & CRM data layer — returns/refunds (RMA), live chat, callback
 * requests, and the admin-only CRM overlay.
 *
 * Follows the same free-tier, rules-only model as src/lib/firebase.ts: the Web
 * SDK reads/writes Firestore directly and firestore.rules is the entire security
 * boundary. No Cloud Functions. Real-time surfaces (chat, admin queues) use
 * onSnapshot so the atelier and the customer see updates instantly.
 *
 * Timestamps are stored as ISO strings for deterministic lexical ordering in
 * onSnapshot streams (mirrors how reviews store createdAt), avoiding the
 * null-during-write window serverTimestamp opens in live listeners.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit as qLimit,
  limitToLast,
  increment,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import type {
  CallRequest,
  CallStatus,
  ChatConversation,
  ChatMessage,
  ChatSenderRole,
  CustomerCrm,
  CustomerLifecycle,
  ReturnLineItem,
  ReturnRequest,
  ReturnResolution,
  ReturnStatus,
} from '../types';

const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------------ */
/*  Mail queue (best-effort) — Firebase Trigger Email extension        */
/* ------------------------------------------------------------------ */
/**
 * Enqueue a branded transactional email. Customers may only enqueue mail to
 * their own verified address (firestore.rules); admins may enqueue to anyone.
 * Always best-effort — a bounce here must never fail the surrounding action
 * (the return/order doc is the source of truth).
 */
async function enqueueMail(to: string, subject: string, html: string, text: string): Promise<void> {
  try {
    if (!auth.currentUser || !to) return;
    await addDoc(collection(db, 'mail'), {
      uid: auth.currentUser.uid,
      to,
      message: { subject, html, text },
      createdAt: nowIso(),
    });
  } catch (err) {
    console.warn('[support] mail enqueue failed', (err as Error).message);
  }
}

const rupee = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** Shared branded email shell (mirrors the order emails in firebase.ts). */
function shell(headline: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;background:#F5ECDC;font-family:Georgia,serif;color:#2A1F12">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5ECDC;padding:40px 0"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#FBF5EA;border:1px solid #EAD9BA">
      <tr><td style="padding:32px 36px 8px 36px;text-align:center">
        <div style="font-size:13px;letter-spacing:0.24em;color:#B8893A;font-family:Helvetica,Arial,sans-serif">TRESOR &middot; COUTURE</div>
        <div style="height:1px;background:#B8893A;width:80px;margin:14px auto"></div>
      </td></tr>
      <tr><td style="padding:8px 36px 28px 36px">
        <p style="font-size:18px;font-style:italic;color:#8E6520;margin:0 0 16px 0">${headline}</p>
        ${bodyHtml}
        <p style="font-size:14px;line-height:1.6;margin:24px 0 0 0;font-style:italic">— The Tresor Couture team</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

const RETURN_COPY: Record<ReturnStatus, { headline: string; body: string }> = {
  requested: { headline: 'We have received your return request.', body: 'Our team will review it and get back to you shortly. You can track the status any time from your account.' },
  approved: { headline: 'Your return has been approved.', body: 'We are arranging the reverse pickup now. Please keep the item in its original condition with tags intact.' },
  rejected: { headline: 'About your return request.', body: 'After review, we are unable to accept this return. If you believe this is a mistake, simply reply to this email and we will take another look.' },
  pickup_scheduled: { headline: 'A pickup has been scheduled.', body: 'Our courier partner will collect the item from your address. Please have it packed and ready.' },
  in_transit: { headline: 'Your return is on its way back to us.', body: 'We will inspect it as soon as it reaches the atelier and update you.' },
  received: { headline: 'We have received your returned item.', body: 'It is being inspected. Your refund or replacement will follow shortly.' },
  refunded: { headline: 'Your refund has been processed.', body: 'The amount should reflect on your original payment method within 5–7 working days.' },
  replaced: { headline: 'Your replacement is on its way.', body: 'A fresh piece has been dispatched. You will receive tracking shortly.' },
  cancelled: { headline: 'Your return request has been cancelled.', body: 'No further action is needed. Reach out any time if you change your mind.' },
  closed: { headline: 'Your return has been closed.', body: 'Thank you for your patience. We hope to see you again soon.' },
};

function buildReturnStatusEmail(args: { customerName: string; returnId: string; orderId: string; status: ReturnStatus; note?: string; refundAmount?: number }) {
  const { customerName, returnId, orderId, status, note, refundAmount } = args;
  const copy = RETURN_COPY[status];
  const refundLine = status === 'refunded' && refundAmount ? `<p style="font-size:14px;line-height:1.6;margin:0 0 12px 0">Refund amount: <strong>${rupee(refundAmount)}</strong></p>` : '';
  const noteLine = note ? `<p style="font-size:13px;line-height:1.6;margin:0 0 12px 0;color:#6B6358">${note}</p>` : '';
  const subject = `Tresor Couture — ${copy.headline.replace(/\.$/, '')}`;
  const body = `
    <p style="font-size:16px;font-style:italic;margin:0 0 16px 0">Dear ${customerName},</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 12px 0">${copy.body}</p>
    ${refundLine}
    ${noteLine}
    <p style="font-size:13px;color:#6B6358;margin:12px 0 0 0">Return reference: <strong>${returnId.slice(0, 8).toUpperCase()}</strong> &middot; Order ${orderId.slice(0, 8).toUpperCase()}</p>`;
  const html = shell(copy.headline, body);
  const text = [
    `Dear ${customerName},`, '',
    copy.headline, '',
    copy.body, '',
    ...(refundLine ? [`Refund amount: ${rupee(refundAmount || 0)}`, ''] : []),
    ...(note ? [note, ''] : []),
    `Return reference: ${returnId.slice(0, 8).toUpperCase()} · Order ${orderId.slice(0, 8).toUpperCase()}`, '',
    '— The Tresor Couture team',
  ].join('\n');
  return { subject, html, text };
}

/* ------------------------------------------------------------------ */
/*  Returns / refunds (RMA)                                            */
/* ------------------------------------------------------------------ */

const asReturn = (raw: DocumentData & { id: string }): ReturnRequest => raw as unknown as ReturnRequest;

export const returnsApi = {
  /** Customer raises a return/replacement against one of their delivered orders. */
  create: async (input: {
    orderId: string;
    items: ReturnLineItem[];
    resolution: ReturnResolution;
    reason: string;
  }): Promise<ReturnRequest> => {
    const u = auth.currentUser;
    if (!u) throw new Error('not_signed_in');
    const customerEmail = u.email ?? undefined;
    const customerName = u.displayName ?? customerEmail?.split('@')[0] ?? 'Tresor Member';
    const payload = {
      orderId: input.orderId,
      userId: u.uid,
      customerEmail: customerEmail ?? null,
      customerName,
      items: input.items,
      resolution: input.resolution,
      reason: input.reason,
      status: 'requested' as ReturnStatus,
      history: [{ status: 'requested' as ReturnStatus, at: nowIso(), by: 'customer' }],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const ref = await addDoc(collection(db, 'returns'), payload);
    // Best-effort acknowledgement to the customer's own address.
    if (customerEmail) {
      const { subject, html, text } = buildReturnStatusEmail({ customerName, returnId: ref.id, orderId: input.orderId, status: 'requested' });
      await enqueueMail(customerEmail, subject, html, text);
    }
    return { id: ref.id, ...payload } as unknown as ReturnRequest;
  },

  /** The signed-in customer's own returns (newest first). */
  mine: async (): Promise<ReturnRequest[]> => {
    const u = auth.currentUser;
    if (!u) return [];
    const snap = await getDocs(query(
      collection(db, 'returns'),
      where('userId', '==', u.uid),
      orderBy('createdAt', 'desc'),
      qLimit(100),
    ));
    return snap.docs.map(d => asReturn({ ...(d.data() as DocumentData), id: d.id }));
  },

  /** Returns raised against a specific order (customer-scoped by rules). */
  forOrder: async (orderId: string): Promise<ReturnRequest[]> => {
    const u = auth.currentUser;
    if (!u) return [];
    const snap = await getDocs(query(
      collection(db, 'returns'),
      where('userId', '==', u.uid),
      where('orderId', '==', orderId),
      qLimit(20),
    ));
    return snap.docs.map(d => asReturn({ ...(d.data() as DocumentData), id: d.id }));
  },

  /** Admin: every return (newest first). */
  all: async (): Promise<ReturnRequest[]> => {
    const snap = await getDocs(query(collection(db, 'returns'), orderBy('createdAt', 'desc'), qLimit(300)));
    return snap.docs.map(d => asReturn({ ...(d.data() as DocumentData), id: d.id }));
  },

  /** Admin: all returns for one customer (for the CRM timeline). */
  forUser: async (uid: string): Promise<ReturnRequest[]> => {
    const snap = await getDocs(query(collection(db, 'returns'), where('userId', '==', uid), qLimit(100)));
    return snap.docs.map(d => asReturn({ ...(d.data() as DocumentData), id: d.id }));
  },

  get: async (id: string): Promise<ReturnRequest | null> => {
    const snap = await getDoc(doc(db, 'returns', id));
    return snap.exists() ? asReturn({ ...(snap.data() as DocumentData), id: snap.id }) : null;
  },

  /** Customer withdraws a still-pending request. */
  cancel: async (id: string): Promise<void> => {
    const current = await returnsApi.get(id);
    const history = [...(current?.history ?? []), { status: 'cancelled' as ReturnStatus, at: nowIso(), by: 'customer' }];
    await updateDoc(doc(db, 'returns', id), { status: 'cancelled', history, updatedAt: nowIso() });
  },

  /**
   * Admin transitions a return and emails the customer. Optionally records a
   * refund amount/method (money movement itself stays a manual/gateway step —
   * see /api/payments/refund scaffold). Never throws on the email leg.
   */
  setStatus: async (
    id: string,
    status: ReturnStatus,
    opts: { note?: string; refundAmount?: number; refundMethod?: string; trackingRef?: string } = {},
  ): Promise<void> => {
    const current = await returnsApi.get(id);
    if (!current) throw new Error('return_not_found');
    const event = { status, at: nowIso(), by: 'admin', ...(opts.note ? { note: opts.note } : {}) };
    const patch: DocumentData = {
      status,
      history: [...(current.history ?? []), event],
      updatedAt: nowIso(),
    };
    if (opts.refundAmount !== undefined) patch.refundAmount = opts.refundAmount;
    if (opts.refundMethod !== undefined) patch.refundMethod = opts.refundMethod;
    if (opts.trackingRef !== undefined) patch.trackingRef = opts.trackingRef;
    await updateDoc(doc(db, 'returns', id), patch);

    // Notify the customer (admin may enqueue to any address per the rules).
    const email = current.customerEmail;
    if (email) {
      const { subject, html, text } = buildReturnStatusEmail({
        customerName: current.customerName ?? 'Tresor Member',
        returnId: id,
        orderId: current.orderId,
        status,
        note: opts.note,
        refundAmount: opts.refundAmount ?? current.refundAmount,
      });
      await enqueueMail(email, subject, html, text);
    }
  },

  /** Admin edits internal-only fields without a customer email. */
  patchAdmin: async (id: string, patch: Partial<Pick<ReturnRequest, 'adminNote' | 'refundAmount' | 'refundMethod' | 'trackingRef'>>): Promise<void> => {
    await updateDoc(doc(db, 'returns', id), { ...patch, updatedAt: nowIso() });
  },
};

/* ------------------------------------------------------------------ */
/*  Live chat                                                          */
/* ------------------------------------------------------------------ */

/** Minimum gap between chat sends from this client (flood guard). */
const MIN_CHAT_SEND_INTERVAL_MS = 900;
let lastChatSendAt = 0;

export const chatApi = {
  /** Ensure the signed-in customer's conversation doc exists; returns its id (== uid). */
  ensureMine: async (): Promise<string> => {
    const u = auth.currentUser;
    if (!u) throw new Error('not_signed_in');
    const ref = doc(db, 'chats', u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: u.uid,
        customerName: u.displayName ?? u.email?.split('@')[0] ?? 'Customer',
        customerEmail: u.email ?? null,
        status: 'open' as const,
        unreadForAdmin: 0,
        unreadForCustomer: 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }
    return u.uid;
  },

  /**
   * Live-subscribe to a conversation's messages (ascending). Uses limitToLast so
   * the window tracks the MOST RECENT messages — a plain `limit` with ascending
   * order would pin to the oldest 500 and silently hide every new message once a
   * conversation passed that many. History beyond the window isn't loaded (a
   * boutique support thread realistically stays well under it).
   */
  subscribeMessages: (uid: string, cb: (messages: ChatMessage[]) => void): Unsubscribe => {
    const q = query(collection(db, 'chats', uid, 'messages'), orderBy('createdAt', 'asc'), limitToLast(500));
    return onSnapshot(q, snap => {
      cb(snap.docs.map(d => ({ ...(d.data() as DocumentData), id: d.id } as ChatMessage)));
    }, err => console.warn('[chat] messages listener', err.message));
  },

  /** Live-subscribe to one conversation doc (for unread badges / status). */
  subscribeConversation: (uid: string, cb: (conv: ChatConversation | null) => void): Unsubscribe => {
    return onSnapshot(doc(db, 'chats', uid), snap => {
      cb(snap.exists() ? ({ ...(snap.data() as DocumentData), id: snap.id } as ChatConversation) : null);
    }, err => console.warn('[chat] conversation listener', err.message));
  },

  /** Admin: live-subscribe to all conversations, most-recent first. */
  subscribeConversations: (cb: (conversations: ChatConversation[]) => void): Unsubscribe => {
    const q = query(collection(db, 'chats'), orderBy('updatedAt', 'desc'), qLimit(200));
    return onSnapshot(q, snap => {
      cb(snap.docs.map(d => ({ ...(d.data() as DocumentData), id: d.id } as ChatConversation)));
    }, err => console.warn('[chat] inbox listener', err.message));
  },

  /** Post a message and bump the conversation summary + unread counter. */
  send: async (uid: string, text: string, role: ChatSenderRole): Promise<void> => {
    const u = auth.currentUser;
    if (!u) throw new Error('not_signed_in');
    const clean = text.trim().slice(0, 4000);
    if (!clean) return;
    // Best-effort flood guard: throttle rapid-fire sends from this client. The
    // rules-only model can't count writes server-side, so this bounds the common
    // (UI/script) abuse case; callers restore the input on the thrown error.
    const now = Date.now();
    if (now - lastChatSendAt < MIN_CHAT_SEND_INTERVAL_MS) throw new Error('rate_limited');
    lastChatSendAt = now;
    await addDoc(collection(db, 'chats', uid, 'messages'), {
      senderId: u.uid,
      senderRole: role,
      text: clean,
      createdAt: nowIso(),
    });
    const summary: DocumentData = {
      lastMessage: clean.slice(0, 140),
      lastSenderRole: role,
      status: 'open',
      updatedAt: nowIso(),
    };
    if (role === 'customer') summary.unreadForAdmin = increment(1);
    else summary.unreadForCustomer = increment(1);
    // setDoc(merge) so an admin's first reply also materialises missing summary fields.
    await setDoc(doc(db, 'chats', uid), summary, { merge: true });
  },

  /** Clear the unread counter for whichever side just opened the thread. */
  markRead: async (uid: string, side: 'admin' | 'customer'): Promise<void> => {
    const field = side === 'admin' ? 'unreadForAdmin' : 'unreadForCustomer';
    await setDoc(doc(db, 'chats', uid), { [field]: 0 }, { merge: true }).catch(() => {});
  },

  /** Admin closes / reopens a conversation. */
  setStatus: async (uid: string, status: 'open' | 'closed'): Promise<void> => {
    await setDoc(doc(db, 'chats', uid), { status, updatedAt: nowIso() }, { merge: true });
  },
};

/* ------------------------------------------------------------------ */
/*  Call / callback requests                                           */
/* ------------------------------------------------------------------ */

const asCall = (raw: DocumentData & { id: string }): CallRequest => raw as unknown as CallRequest;

export const callRequestsApi = {
  create: async (input: { name: string; phone: string; email?: string; topic?: string; preferredTime?: string; orderId?: string }): Promise<CallRequest> => {
    const u = auth.currentUser;
    if (!u) throw new Error('not_signed_in');
    const payload = {
      userId: u.uid,
      name: input.name.trim().slice(0, 128),
      phone: input.phone.trim().slice(0, 32),
      email: (input.email ?? u.email ?? '').trim().slice(0, 254) || null,
      topic: input.topic?.trim().slice(0, 500) ?? null,
      preferredTime: input.preferredTime?.trim().slice(0, 120) ?? null,
      orderId: input.orderId ?? null,
      status: 'new' as CallStatus,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const ref = await addDoc(collection(db, 'call_requests'), payload);
    return { id: ref.id, ...payload } as unknown as CallRequest;
  },

  mine: async (): Promise<CallRequest[]> => {
    const u = auth.currentUser;
    if (!u) return [];
    const snap = await getDocs(query(collection(db, 'call_requests'), where('userId', '==', u.uid), orderBy('createdAt', 'desc'), qLimit(50)));
    return snap.docs.map(d => asCall({ ...(d.data() as DocumentData), id: d.id }));
  },

  all: async (): Promise<CallRequest[]> => {
    const snap = await getDocs(query(collection(db, 'call_requests'), orderBy('createdAt', 'desc'), qLimit(300)));
    return snap.docs.map(d => asCall({ ...(d.data() as DocumentData), id: d.id }));
  },

  forUser: async (uid: string): Promise<CallRequest[]> => {
    const snap = await getDocs(query(collection(db, 'call_requests'), where('userId', '==', uid), qLimit(100)));
    return snap.docs.map(d => asCall({ ...(d.data() as DocumentData), id: d.id }));
  },

  setStatus: async (id: string, status: CallStatus, adminNote?: string): Promise<void> => {
    const patch: DocumentData = { status, updatedAt: nowIso() };
    if (adminNote !== undefined) patch.adminNote = adminNote;
    await updateDoc(doc(db, 'call_requests', id), patch);
  },

  remove: (id: string) => deleteDoc(doc(db, 'call_requests', id)),
};

/* ------------------------------------------------------------------ */
/*  CRM overlay (admin-only)                                           */
/* ------------------------------------------------------------------ */

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const crmApi = {
  get: async (customerUid: string): Promise<CustomerCrm | null> => {
    const snap = await getDoc(doc(db, 'crm', customerUid));
    return snap.exists() ? ({ ...(snap.data() as DocumentData), uid: customerUid } as CustomerCrm) : null;
  },

  /** Read the CRM overlay for every customer in one pass (admin dashboard). */
  all: async (): Promise<Record<string, CustomerCrm>> => {
    const snap = await getDocs(query(collection(db, 'crm'), qLimit(1000)));
    const out: Record<string, CustomerCrm> = {};
    snap.docs.forEach(d => { out[d.id] = { ...(d.data() as DocumentData), uid: d.id } as CustomerCrm; });
    return out;
  },

  setLifecycle: async (customerUid: string, lifecycle: CustomerLifecycle): Promise<void> => {
    await setDoc(doc(db, 'crm', customerUid), { uid: customerUid, lifecycle, updatedAt: nowIso() }, { merge: true });
  },

  setTags: async (customerUid: string, tags: string[]): Promise<void> => {
    await setDoc(doc(db, 'crm', customerUid), { uid: customerUid, tags, updatedAt: nowIso() }, { merge: true });
  },

  addNote: async (customerUid: string, text: string, author: string): Promise<CustomerCrm> => {
    const existing = await crmApi.get(customerUid);
    const notes = [{ id: uid(), text: text.trim(), author, at: nowIso() }, ...(existing?.notes ?? [])];
    const next: CustomerCrm = {
      uid: customerUid,
      tags: existing?.tags ?? [],
      lifecycle: existing?.lifecycle ?? 'active',
      notes,
    };
    await setDoc(doc(db, 'crm', customerUid), { ...next, updatedAt: nowIso() }, { merge: true });
    return next;
  },

  removeNote: async (customerUid: string, noteId: string): Promise<void> => {
    const existing = await crmApi.get(customerUid);
    if (!existing) return;
    const notes = (existing.notes ?? []).filter(n => n.id !== noteId);
    await setDoc(doc(db, 'crm', customerUid), { notes, updatedAt: nowIso() }, { merge: true });
  },
};
