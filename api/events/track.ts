/**
 * POST /api/events/track
 *
 * Browser-callable bridge that fires a Brevo event so Brevo-side automations
 * (welcome on sign-up, order confirmation, etc.) have a trigger. The browser
 * cannot call Brevo directly (the API key must stay server-side), so it posts
 * the intent here and this endpoint emits the event with the secret key.
 *
 * Body: { event: 'signup' | 'order_placed', email, properties?, eventData? }
 *
 * Hardened: only a fixed whitelist of event *kinds* is accepted (so the
 * endpoint can't be used to fire arbitrary Brevo events), and it no-ops
 * cleanly (200 { tracked:false }) when BREVO_API_KEY is absent.
 */
import { brevoConfigured, trackBrevoEvent, BREVO_EVENTS } from '../_lib/brevo.js';
import { readJson, type ApiRequest, type ApiResponse } from '../_lib/http.js';

interface Body {
  event?: string;
  email?: string;
  properties?: Record<string, unknown>;
  eventData?: Record<string, unknown>;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Map the client-supplied kind to the configurable Brevo event name. Anything
// outside this set is rejected — the endpoint can't fire arbitrary events.
const EVENT_RESOLVERS: Record<string, () => string> = {
  signup: BREVO_EVENTS.signup,
  order_placed: BREVO_EVENTS.orderPlaced,
};

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  if (!brevoConfigured()) {
    res.status(200).json({ tracked: false, reason: 'brevo_not_configured' });
    return;
  }

  const { event, email, properties, eventData } = readJson<Body>(req);

  const resolver = event ? EVENT_RESOLVERS[event] : undefined;
  if (!resolver) {
    res.status(400).json({ error: 'unknown_event' });
    return;
  }
  if (!email || !EMAIL_RE.test(email.trim())) {
    res.status(400).json({ error: 'invalid_email' });
    return;
  }

  const ok = await trackBrevoEvent({ event: resolver(), email, properties, eventData });
  res.status(200).json({ tracked: ok });
}
