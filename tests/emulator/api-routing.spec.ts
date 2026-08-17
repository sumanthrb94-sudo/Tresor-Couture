import { test, expect } from '@playwright/test';
import { Recorder } from './lib/recorder';
import emailRoute from '../../api/email/[kind]';
import type { ApiRequest, ApiResponse } from '../../api/_lib/http';

/**
 * The email endpoints share one serverless function.
 *
 * Vercel bills a function per file under `api/`, and the Hobby plan allows
 * twelve. The three email routes were collapsed behind a single dynamic segment
 * to get back under it — which is only safe if `/api/email/welcome`,
 * `/api/email/order` and `/api/email/bulk` still reach exactly the handlers they
 * did before, and nothing else does.
 *
 * These assertions are about the DISPATCHER, not the handlers: each known kind
 * must get past the router into its own guard chain (proved by the guard's own
 * refusal, not a 404), and anything else must be refused by the router.
 */

interface Captured { status: number; body: Record<string, unknown> }

function makeRes(): { res: ApiResponse; out: Captured } {
  const out: Captured = { status: 0, body: {} };
  const res: ApiResponse = {
    status(code) { out.status = code; return res; },
    json(data) { out.body = (data ?? {}) as Record<string, unknown>; return res; },
    send(data) { out.body = (data ?? {}) as Record<string, unknown>; return res; },
    setHeader() { /* not under test */ },
    end() { /* no-op */ },
  };
  return { res, out };
}

const call = async (kind: unknown, origin = 'https://tresorcouture.in'): Promise<Captured> => {
  const { res, out } = makeRes();
  const req = {
    method: 'POST',
    query: { kind },
    headers: { 'content-type': 'application/json', origin },
    body: {},
  } as unknown as ApiRequest;
  await (emailRoute as unknown as (q: ApiRequest, s: ApiResponse) => Promise<void>)(req, res);
  return out;
};

test('API routing · the three email endpoints still reach their own handlers', async () => {
  const rec = new Recorder({
    slug: 'api-email-routing',
    title: 'API · one function, three email endpoints',
    area: 'API · Routing',
    purpose:
      'Collapsing /api/email/{welcome,order,bulk} behind one dynamic segment brought the project back under the twelve-function limit. It must be invisible: every existing URL still resolves to the handler it always did, and no other path resolves to anything.',
    reproduce: [
      'POST /api/email/welcome, /api/email/order and /api/email/bulk.',
      'Each is refused by its own guard chain (CSRF/auth), not by a 404 — proving the dispatcher handed it on.',
      'POST /api/email/anything-else returns 404.',
    ],
  });

  try {
    // Each known kind must land in a REAL handler. A 403 here is the handler's
    // own CSRF guard refusing a request with no token — which is exactly the
    // proof we want: the router got out of the way.
    for (const kind of ['welcome', 'order', 'bulk']) {
      const res = await call(kind);
      expect(res.status).not.toBe(404);
      expect([400, 401, 403, 405, 503]).toContain(res.status);
    }
    rec.note('All three routes still land', 'Refused by their own guards, not by the dispatcher.');

    // Vercel hands a repeated query parameter through as an array.
    expect((await call(['welcome'])).status).not.toBe(404);

    // Anything else is refused here, before a handler is chosen.
    expect((await call('nope')).status).toBe(404);
    expect((await call(undefined)).status).toBe(404);
    expect((await call('')).status).toBe(404);

    // The routes are an explicit map, never a dynamic import of the URL
    // segment, so a path cannot name a module.
    for (const hostile of ['../_lib/auth', '../../package', 'constructor', '__proto__', 'toString']) {
      expect((await call(hostile)).status).toBe(404);
    }
    rec.note('The URL segment cannot name a module', 'An explicit map, so traversal and prototype keys resolve to nothing.');

    rec.finish('passed');
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});
