import React, { useEffect, useMemo, useState } from 'react';
import { Send, Mail, Loader2, AlertTriangle, Check, Users } from 'lucide-react';
import { auth } from '../../lib/firebase';

/**
 * Bulk Email — admin-only marketing suite. Composes an email and sends it as a
 * Brevo email campaign to a chosen contact list. All Brevo calls go through the
 * admin-gated /api/email/bulk endpoint (the API key never reaches the browser).
 */

interface BrevoList { id: number; name: string; totalSubscribers: number }
interface BrevoSender { id: number; name: string; email: string }

const STARTER_HTML = `<!doctype html>
<html><body style="margin:0;background:#FBF7EE;font-family:Georgia,'Times New Roman',serif;color:#2A1F12;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <h1 style="font-size:24px;letter-spacing:.04em;margin:0 0 6px;">TRESOR COUTURE</h1>
    <p style="color:#8A7656;font-size:12px;text-transform:uppercase;letter-spacing:.18em;margin:0 0 22px;">The Atelier</p>
    <p style="font-size:16px;">Hello,</p>
    <p style="font-size:15px;line-height:1.6;color:#3a3026;">Write your message here…</p>
    <p style="margin-top:24px;"><a href="https://tresorcouture.in/#/shop" style="background:#7A1F2C;color:#fff;text-decoration:none;padding:12px 22px;border-radius:4px;font-family:Arial,sans-serif;font-size:14px;">Shop the collection</a></p>
    <p style="font-size:12px;color:#8A7656;margin-top:28px;">Hand-woven heritage · 40-minute delivery across Hyderabad · free shipping over ₹1,999.</p>
  </div>
</body></html>`;

async function authedFetch(input: string, init: RequestInit = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  const token = await user.getIdToken();
  return fetch(input, {
    ...init,
    headers: { ...(init.headers || {}), authorization: `Bearer ${token}` },
  });
}

const AdminBulkEmail: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [lists, setLists] = useState<BrevoList[]>([]);
  const [senders, setSenders] = useState<BrevoSender[]>([]);

  const [senderEmail, setSenderEmail] = useState('');
  const [listId, setListId] = useState<number | ''>('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState(STARTER_HTML);

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch('/api/email/bulk');
        if (res.status === 403) throw new Error('Admin access required.');
        const data = await res.json();
        if (cancelled) return;
        if (data.configured === false) { setConfigured(false); return; }
        setLists(data.lists || []);
        setSenders(data.senders || []);
        if (data.senders?.[0]) setSenderEmail(data.senders[0].email);
        if (data.lists?.[0]) setListId(data.lists[0].id);
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : 'Could not load Brevo data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedList = useMemo(() => lists.find(l => l.id === listId), [lists, listId]);

  const send = async () => {
    setResult(null);
    if (!subject.trim() || !html.trim()) { setResult({ ok: false, text: 'Subject and body are required.' }); return; }
    if (!senderEmail) { setResult({ ok: false, text: 'Choose a sender.' }); return; }
    if (!listId) { setResult({ ok: false, text: 'Choose a recipient list.' }); return; }

    const count = selectedList?.totalSubscribers ?? 0;
    if (!window.confirm(`Send "${subject}" to ${count.toLocaleString('en-IN')} contact(s) in "${selectedList?.name}"? This goes out immediately and cannot be undone.`)) return;

    setSending(true);
    try {
      const sender = senders.find(s => s.email === senderEmail);
      const res = await authedFetch('/api/email/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subject, htmlContent: html, senderEmail, senderName: sender?.name, listId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setResult({ ok: true, text: `Campaign sent (Brevo campaign #${data.campaignId}) to ${count.toLocaleString('en-IN')} contact(s).` });
      } else {
        setResult({ ok: false, text: data.detail || data.error || `Send failed (${res.status}).` });
      }
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : 'Send failed.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <Mail className="w-5 h-5 text-[color:var(--color-myntra-pink)]" />
        <h1 className="text-xl font-extrabold text-[color:var(--color-myntra-navy)]">Bulk Email</h1>
      </div>
      <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-5">
        Compose a marketing email and send it to a Brevo contact list. Sends as a Brevo campaign — the API key stays server-side.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-[13px] text-[color:var(--color-myntra-ink-soft)] py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading lists & senders…
        </div>
      ) : !configured ? (
        <div className="bg-[color:var(--color-myntra-bg-sale)] border border-[color:var(--color-myntra-border)] rounded-md p-4 text-[13px] text-[color:var(--color-myntra-ink)] flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-[color:var(--color-myntra-pink)] shrink-0" />
          <span>Brevo isn’t connected yet. Set the Brevo API key in the deployment environment, then reload — lists and verified senders will appear here automatically.</span>
        </div>
      ) : loadErr ? (
        <div className="bg-[color:var(--color-myntra-bg-sale)] border border-[color:var(--color-myntra-border)] rounded-md p-4 text-[13px] text-[color:var(--color-myntra-pink)] font-semibold">{loadErr}</div>
      ) : (
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)]">From (verified sender)</span>
              <select value={senderEmail} onChange={e => setSenderEmail(e.target.value)} className="input-box w-full mt-1.5">
                {senders.length === 0 && <option value="">No verified senders in Brevo</option>}
                {senders.map(s => <option key={s.id} value={s.email}>{s.name} · {s.email}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)]">Recipient list</span>
              <select value={listId} onChange={e => setListId(Number(e.target.value))} className="input-box w-full mt-1.5">
                {lists.length === 0 && <option value="">No contact lists in Brevo</option>}
                {lists.map(l => <option key={l.id} value={l.id}>{l.name} ({l.totalSubscribers.toLocaleString('en-IN')})</option>)}
              </select>
            </label>
          </div>

          {selectedList && (
            <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Will send to <b>{selectedList.totalSubscribers.toLocaleString('en-IN')}</b> contact(s) in <b>{selectedList.name}</b>.
            </p>
          )}

          <label className="block">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)]">Subject</span>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. New arrivals — handwoven Banarasi" className="input-box w-full mt-1.5" maxLength={200} />
          </label>

          <label className="block">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)]">Body (HTML)</span>
            <textarea value={html} onChange={e => setHtml(e.target.value)} rows={14} className="input-box w-full mt-1.5 font-mono text-[12px] leading-relaxed" />
          </label>

          <div className="flex items-center gap-3 pt-1">
            <button onClick={send} disabled={sending} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'Sending…' : 'Send campaign'}
            </button>
            {result && (
              <span className={`text-[13px] font-semibold inline-flex items-center gap-1.5 ${result.ok ? 'text-[color:var(--color-myntra-green)]' : 'text-[color:var(--color-myntra-pink)]'}`}>
                {result.ok && <Check className="w-4 h-4" />}{result.text}
              </span>
            )}
          </div>

          <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] pt-1">
            Tip: manage contact lists and unsubscribes in Brevo. Sends are immediate; there’s no recall once dispatched.
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminBulkEmail;
