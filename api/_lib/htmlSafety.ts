/**
 * Safety guard for admin-authored HTML that gets relayed to customer inboxes
 * (the bulk-email composer).
 *
 * Extracted into its own module so the rule can be tested directly. It is
 * defence-in-depth on top of the admin gate — Brevo sanitises too — but an
 * admin account is not a licence to inject active content into other people's
 * mail clients, and a compromised admin session should not become a mass
 * phishing vector.
 */

/** True when the HTML contains active content we refuse to relay. */
export function dangerousHtml(html: string): boolean {
  const lowered = html.toLowerCase();
  if (lowered.includes('<script')) return true;
  if (lowered.includes('javascript:')) return true;
  // Inline event handlers: onclick=, onerror=, onload= …
  if (/\s(on\w+)\s*=/i.test(html)) return true;
  if (lowered.includes('<iframe')) return true;
  if (lowered.includes('<object')) return true;
  if (lowered.includes('<embed')) return true;
  return false;
}

interface HtmlValidationOk { ok: true; error?: undefined; }
interface HtmlValidationError { ok: false; error: string; }
export type HtmlValidation = HtmlValidationOk | HtmlValidationError;

export function validateHtmlContent(html: string): HtmlValidation {
  if (!html) return { ok: false, error: 'html_content_required' };
  if (dangerousHtml(html)) return { ok: false, error: 'html_content_forbidden' };
  return { ok: true };
}
