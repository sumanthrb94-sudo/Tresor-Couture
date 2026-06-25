// /api/email/bulk — admin-only bulk marketing via Brevo email campaigns.
//
//   GET   → { lists, senders, configured }  (to populate the composer)
//   POST  → create a Brevo email campaign to a contact list and send it now.
//           Body: { subject, htmlContent, senderEmail, senderName, listId, campaignName? }
//           Returns { ok, campaignId }.
//
// Auth: Firebase ID token AND the `admin` custom claim (same claim the
// Firestore rules use). Non-admins get 403.
//
// SELF-CONTAINED: no relative imports — the project is ESM ("type":"module")
// and Node ESM can't resolve extensionless relative imports, which crashes the
// function at cold start. Helpers are inlined (mirrors api/email/welcome.ts).

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tresor-couture';
const BREVO = 'https://api.brevo.com/v3';

function setCors(res: any): void {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Keyless admin-token verification (firebase-admin against Google public keys).
let _adminAuth: any = null;
async function verifyAdmin(authHeader: string | undefined): Promise<any | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (!token) return null;
  try {
    if (!_adminAuth) {
      const { getApps, initializeApp } = await import('firebase-admin/app');
      const { getAuth } = await import('firebase-admin/auth');
      const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
      _adminAuth = getAuth(app);
    }
    const decoded = await _adminAuth.verifyIdToken(token);
    return decoded?.admin === true ? decoded : null;
  } catch {
    return null;
  }
}

function brevoHeaders(key: string) {
  return { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' };
}

async function brevoGet(path: string, key: string): Promise<any> {
  const r = await fetch(`${BREVO}${path}`, { headers: brevoHeaders(key) });
  if (!r.ok) throw new Error(`brevo GET ${path} ${r.status}: ${await r.text()}`);
  return r.json();
}

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const admin = await verifyAdmin(req.headers['authorization']);
  if (!admin) return res.status(403).json({ error: 'forbidden' });

  const key = process.env.BREVO_API_KEY;
  if (!key) return res.status(200).json({ configured: false, error: 'BREVO_API_KEY not set' });

  try {
    // ---- GET: composer metadata (lists + verified senders) ----
    if (req.method === 'GET') {
      const [listsRes, sendersRes] = await Promise.all([
        brevoGet('/contacts/lists?limit=50&sort=desc', key).catch(() => ({ lists: [] })),
        brevoGet('/senders', key).catch(() => ({ senders: [] })),
      ]);
      const lists = (listsRes.lists || []).map((l: any) => ({
        id: l.id, name: l.name, totalSubscribers: l.totalSubscribers ?? l.uniqueSubscribers ?? 0,
      }));
      const senders = (sendersRes.senders || [])
        .filter((s: any) => s.active !== false)
        .map((s: any) => ({ id: s.id, name: s.name, email: s.email }));
      return res.status(200).json({ configured: true, lists, senders });
    }

    // ---- POST: create + send a campaign now ----
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const subject = String(body.subject || '').trim();
      const htmlContent = String(body.htmlContent || '').trim();
      const senderEmail = String(body.senderEmail || process.env.BREVO_SENDER_EMAIL || '').trim();
      const senderName = String(body.senderName || process.env.BREVO_SENDER_NAME || 'Tresor Couture').trim();
      const listId = Number(body.listId);
      const campaignName = String(body.campaignName || `Campaign — ${subject}`).slice(0, 120);

      if (!subject || !htmlContent) return res.status(400).json({ error: 'subject_and_body_required' });
      if (!senderEmail) return res.status(400).json({ error: 'sender_required' });
      if (!Number.isFinite(listId) || listId <= 0) return res.status(400).json({ error: 'list_required' });

      // 1) Create the campaign.
      const createRes = await fetch(`${BREVO}/emailCampaigns`, {
        method: 'POST',
        headers: brevoHeaders(key),
        body: JSON.stringify({
          name: campaignName,
          subject,
          type: 'classic',
          sender: { name: senderName, email: senderEmail },
          htmlContent,
          recipients: { listIds: [listId] },
        }),
      });
      if (!createRes.ok) {
        return res.status(502).json({ error: 'brevo_create_failed', detail: await createRes.text() });
      }
      const created = await createRes.json();
      const campaignId = created.id;

      // 2) Send it now.
      const sendRes = await fetch(`${BREVO}/emailCampaigns/${campaignId}/sendNow`, {
        method: 'POST', headers: brevoHeaders(key),
      });
      if (!sendRes.ok && sendRes.status !== 204) {
        // Campaign exists as a draft in Brevo even if sendNow failed.
        return res.status(502).json({ error: 'brevo_send_failed', campaignId, detail: await sendRes.text() });
      }
      return res.status(200).json({ ok: true, campaignId });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error('[api/email/bulk]', (err as Error).message);
    return res.status(500).json({ error: 'internal_error' });
  }
}
