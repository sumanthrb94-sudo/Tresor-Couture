/**
 * Brevo (formerly Sendinblue) contact-sync helper for serverless functions.
 *
 * Marketing is authored in Brevo; this module's only job is to push the
 * audience captured on the site (the Firestore `subscribers` collection and
 * the newsletter form) into Brevo contacts so campaigns/automations have a
 * live list. Transactional + paid-order email is intentionally out of scope.
 *
 * All functions are credential-gated: with no BREVO_API_KEY the helper is a
 * silent no-op, so builds/previews work with zero configuration.
 *
 * Env:
 *   BREVO_API_KEY   — server secret (Brevo → SMTP & API → API Keys)
 *   BREVO_LIST_ID   — optional numeric list id to add contacts to
 */

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/contacts';

export function brevoConfigured(): boolean {
  return typeof process.env.BREVO_API_KEY === 'string' && process.env.BREVO_API_KEY.length > 0;
}

export interface BrevoContact {
  email: string;
  phone?: string;
  source?: string;
  attributes?: Record<string, unknown>;
}

/**
 * Upsert a contact into Brevo (create, or update if it already exists).
 * Returns true on success, false on a no-op (unconfigured) or failure —
 * callers treat this as best-effort and never block the visitor on it.
 */
export async function upsertBrevoContact(contact: BrevoContact): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return false;

  const email = contact.email.trim().toLowerCase();
  if (!email) return false;

  const listId = process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined;

  const attributes: Record<string, unknown> = {
    ...(contact.phone ? { SMS: contact.phone, WHATSAPP: contact.phone } : {}),
    ...(contact.source ? { SOURCE: contact.source } : {}),
    ...contact.attributes,
  };

  const body: Record<string, unknown> = {
    email,
    updateEnabled: true, // upsert: don't 400 on an existing contact
    ...(Object.keys(attributes).length ? { attributes } : {}),
    ...(listId && !Number.isNaN(listId) ? { listIds: [listId] } : {}),
  };

  try {
    const resp = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    // 201 created, 204 updated — both fine. Anything else is a soft failure.
    return resp.status === 201 || resp.status === 204 || resp.ok;
  } catch {
    return false;
  }
}
