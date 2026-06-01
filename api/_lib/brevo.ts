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
 * It also emits Brevo **events** (the `/v3/events` API) so Brevo-side
 * automations (welcome on sign-up, order-placed confirmation, etc.) have a
 * trigger to listen for. Marketing/automation content stays authored in Brevo;
 * the app's job is only to fire the named event with the right contact + data.
 *
 * Env:
 *   BREVO_API_KEY            — server secret (Brevo → SMTP & API → API Keys)
 *   BREVO_LIST_ID            — optional numeric list id to add contacts to
 *   BREVO_EVENT_SIGNUP       — event name for new sign-ups   (default 'signup')
 *   BREVO_EVENT_ORDER_PLACED — event name for placed orders  (default 'order_placed')
 */

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/contacts';
const BREVO_EVENTS_ENDPOINT = 'https://api.brevo.com/v3/events';

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

/** Configurable event names so the CEO can point Brevo automations at them
 *  without a code change. Defaults match the docs. */
export const BREVO_EVENTS = {
  signup: () => process.env.BREVO_EVENT_SIGNUP || 'signup',
  orderPlaced: () => process.env.BREVO_EVENT_ORDER_PLACED || 'order_placed',
};

/**
 * Fire a Brevo event (the trigger source for Brevo automations). The contact
 * is identified by email; `properties` are contact attributes Brevo can use in
 * the automation, and `eventData` carries event-scoped payload (order id,
 * total, items…). Best-effort + credential-gated — never throws, returns false
 * when BREVO_API_KEY is absent so callers can ignore the result.
 *
 * Docs: https://developers.brevo.com/reference/createevent
 */
export async function trackBrevoEvent(input: {
  event: string;
  email: string;
  properties?: Record<string, unknown>;
  eventData?: Record<string, unknown>;
}): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return false;

  const email = input.email.trim().toLowerCase();
  if (!email || !input.event) return false;

  const body: Record<string, unknown> = {
    event_name: input.event,
    identifiers: { email_id: email },
    ...(input.properties && Object.keys(input.properties).length
      ? { contact_properties: input.properties }
      : {}),
    ...(input.eventData && Object.keys(input.eventData).length
      ? { event_properties: input.eventData }
      : {}),
  };

  try {
    const resp = await fetch(BREVO_EVENTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    return resp.ok || resp.status === 204;
  } catch {
    return false;
  }
}
