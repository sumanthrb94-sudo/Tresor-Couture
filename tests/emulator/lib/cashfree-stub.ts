import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * A Cashfree stand-in, so the handlers that decide whether money moved can be
 * driven without a merchant account.
 *
 * The point is NOT to simulate Cashfree faithfully. It is to be able to make
 * Cashfree say things a real sandbox will not say on demand — an order that is
 * PAID for the wrong amount, an order still ACTIVE, an order that goes from
 * unpaid to paid between two calls. Those are the answers `/api/payments/verify`
 * has to get right, and with the real sandbox they are reachable only by
 * chance.
 *
 * It only ever stands in for the SANDBOX base (see cashfreeBase), so nothing
 * here can affect a live deployment.
 */
export interface StubOrder {
  order_status: 'ACTIVE' | 'PAID' | 'EXPIRED' | 'TERMINATED';
  order_amount: number;
  order_currency?: string;
}

export class CashfreeStub {
  private server: Server | null = null;
  private orders = new Map<string, StubOrder>();

  /** Every request the handlers made, for asserting what was actually asked. */
  readonly calls: { method: string; path: string }[] = [];

  async start(): Promise<string> {
    this.server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      this.calls.push({ method: req.method ?? 'GET', path: url.pathname });

      // POST /pg/orders — mint a session id for an order we then hold.
      if (req.method === 'POST' && url.pathname === '/pg/orders') {
        let raw = '';
        req.on('data', (c) => {
          raw += String(c);
        });
        req.on('end', () => {
          const body = JSON.parse(raw || '{}') as { order_id?: string; order_amount?: number };
          const id = body.order_id ?? 'unknown';
          // A freshly created order is ACTIVE: created, not yet paid. This is
          // what a shopper who abandons the modal leaves behind.
          this.orders.set(id, { order_status: 'ACTIVE', order_amount: Number(body.order_amount ?? 0) });
          res.setHeader('content-type', 'application/json');
          res.end(
            JSON.stringify({
              order_id: id,
              cf_order_id: `cf_${id}`,
              payment_session_id: `session_${id}`,
              order_amount: body.order_amount,
            }),
          );
        });
        return;
      }

      // GET /pg/orders/:id — the call that settles whether money moved.
      const m = /^\/pg\/orders\/(.+)$/.exec(url.pathname);
      if (req.method === 'GET' && m) {
        const found = this.orders.get(decodeURIComponent(m[1]!));
        res.setHeader('content-type', 'application/json');
        if (!found) {
          res.statusCode = 404;
          res.end(JSON.stringify({ message: 'order_not_found' }));
          return;
        }
        res.end(JSON.stringify({ order_id: m[1], order_currency: 'INR', ...found }));
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ message: 'not_stubbed' }));
    });

    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    const { port } = this.server!.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  /** Make Cashfree report whatever this test needs it to report. */
  set(orderId: string, state: StubOrder): void {
    this.orders.set(orderId, state);
  }

  get(orderId: string): StubOrder | undefined {
    return this.orders.get(orderId);
  }

  async stop(): Promise<void> {
    if (this.server) await new Promise<void>((r) => this.server!.close(() => r()));
    this.server = null;
  }
}
