/**
 * The real `api/` routes, served locally on one origin with the built app.
 *
 * WHY THIS EXISTS. Every test we had stopped at the checkout. `vite preview`
 * serves static files, so `/api/*` 404s, and the one endpoint that places an
 * order — where pricing is recomputed from Firestore, stock is decremented in a
 * transaction, and `productIds` is denormalised for the review gate — was the
 * one piece of the system nothing could drive. The order fixtures the emulator
 * suite uses were seeded straight into Firestore, which means they proved the
 * screens after an order exists, not the act of ordering.
 *
 * This runs the SAME handler modules Vercel runs, unmodified. It is a test
 * harness, not a second implementation: if the shape of a request here differs
 * from Vercel's, the test is lying, so the adapter below mirrors Vercel's
 * contract deliberately — parsed `body` and `query`, `res.status().json()`,
 * and `bodyParser: false` honoured for the routes that must see raw bytes.
 *
 * NOT FOR PRODUCTION. It serves `dist/` with an SPA fallback and no caching,
 * compression, or security headers — `vercel.json` supplies all of those in
 * the real deployment.
 *
 *   PORT          port to listen on (default 4173)
 *   DIST          directory of the built app (default ./dist)
 *
 * Point ALLOWED_ORIGIN at this server's own origin before starting, or the
 * CORS check in every state-changing route will refuse the request.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const PORT = Number(process.env.PORT || 4173);
const ROOT = path.resolve(process.cwd());
const DIST = path.resolve(ROOT, process.env.DIST || 'dist');
const API = path.resolve(ROOT, 'api');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Find the handler file for a request path, preferring a literal segment over
 * a dynamic one at every level — the same precedence Vercel applies, so that
 * `/api/admin/orders` cannot be captured by `[section]` if a literal
 * `orders.ts` is ever added beside it.
 */
async function resolveRoute(
  urlPath: string,
): Promise<{ file: string; params: Record<string, string> } | null> {
  const segments = urlPath.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  if (segments.length === 0) return null;

  let dir = API;
  const params: Record<string, string> = {};

  for (let i = 0; i < segments.length; i++) {
    const seg = decodeURIComponent(segments[i]!);
    // Refuse anything that could climb out of api/ — this server is pointed at
    // a source tree, so a traversal here would read the repository.
    if (seg === '..' || seg === '.' || seg.includes('\0') || seg.includes('/')) return null;
    const last = i === segments.length - 1;

    if (last) {
      const literal = path.join(dir, `${seg}.ts`);
      if (await exists(literal)) return { file: literal, params };
      const dynamic = await findDynamic(dir, '.ts');
      if (dynamic) {
        params[dynamic.name] = seg;
        return { file: dynamic.file, params };
      }
      return null;
    }

    const literalDir = path.join(dir, seg);
    if (await exists(literalDir)) {
      dir = literalDir;
      continue;
    }
    const dynamicDir = await findDynamic(dir, '');
    if (!dynamicDir) return null;
    params[dynamicDir.name] = seg;
    dir = dynamicDir.file;
  }
  return null;
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** The `[param]` file or directory in `dir`, if there is one. */
async function findDynamic(
  dir: string,
  ext: string,
): Promise<{ file: string; name: string } | null> {
  const { readdir } = await import('node:fs/promises');
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return null;
  }
  for (const entry of entries) {
    const m = /^\[(.+)\]$/.exec(ext ? entry.replace(/\.ts$/, '') : entry);
    if (m && (ext ? entry.endsWith(ext) : true)) {
      return { file: path.join(dir, entry), name: m[1]! };
    }
  }
  return null;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (c: string) => {
      data += c;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/**
 * Vercel's response object over Node's. `status()` returns `this` so handlers
 * can chain, and every terminator is idempotent — a handler that responds and
 * then falls through to a second `res.json()` would otherwise crash the
 * process here while Vercel merely ignores it, turning a harmless bug into a
 * dead test server.
 */
function makeRes(raw: ServerResponse): Record<string, unknown> {
  let code = 200;
  let sent = false;
  const api = {
    status(c: number) {
      code = c;
      return api;
    },
    setHeader(name: string, value: string) {
      if (!sent) raw.setHeader(name, value);
    },
    json(data: unknown) {
      if (sent) return api;
      sent = true;
      raw.statusCode = code;
      raw.setHeader('content-type', 'application/json; charset=utf-8');
      raw.end(JSON.stringify(data));
      return api;
    },
    send(data: unknown) {
      if (sent) return api;
      sent = true;
      raw.statusCode = code;
      raw.end(typeof data === 'string' ? data : JSON.stringify(data));
      return api;
    },
    end(data?: unknown) {
      if (sent) return;
      sent = true;
      raw.statusCode = code;
      raw.end(data == null ? undefined : String(data));
    },
  };
  return api as unknown as Record<string, unknown>;
}

interface RouteModule {
  default: (req: unknown, res: unknown) => Promise<void> | void;
  config?: { api?: { bodyParser?: boolean } };
}

async function serveApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const route = await resolveRoute(url.pathname);
  if (!route) {
    res.statusCode = 404;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'not_found' }));
    return;
  }

  const mod = (await import(pathToFileURL(route.file).href)) as RouteModule;
  const parseBody = mod.config?.api?.bodyParser !== false;

  const query: Record<string, string> = { ...route.params };
  url.searchParams.forEach((v, k) => {
    query[k] = v;
  });

  // With bodyParser off the handler reads the stream itself, so the request
  // must reach it UNCONSUMED — which is why the body is only read here.
  let body: unknown;
  if (parseBody && req.method !== 'GET' && req.method !== 'HEAD') {
    const raw = await readBody(req);
    const type = String(req.headers['content-type'] ?? '');
    body = type.includes('application/json') && raw.trim() ? safeJson(raw) : raw;
  }

  // The handler gets the real IncomingMessage as its prototype so the routes
  // that stream (the webhook) still have .on/.setEncoding, with Vercel's
  // parsed fields layered on top.
  const apiReq = Object.create(req) as Record<string, unknown>;
  apiReq.query = query;
  if (parseBody) apiReq.body = body;

  try {
    await mod.default(apiReq, makeRes(res));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[api] ${url.pathname} threw:`, err);
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: 'handler_threw' }));
    }
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function serveStatic(res: ServerResponse, urlPath: string): Promise<void> {
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
  const file = path.resolve(DIST, rel);
  // An SPA route (/product/1, /admin/orders) is not a file; anything that is
  // not found falls back to the shell, which is what Vercel's rewrite does.
  const target = file.startsWith(DIST) && (await exists(file)) && !(await isDir(file))
    ? file
    : path.join(DIST, 'index.html');
  try {
    const buf = await readFile(target);
    res.statusCode = 200;
    res.setHeader('content-type', MIME[path.extname(target)] ?? 'application/octet-stream');
    res.setHeader('cache-control', 'no-store');
    res.end(buf);
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
}

async function isDir(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const done = url.pathname.startsWith('/api/')
    ? serveApi(req, res, url)
    : serveStatic(res, url.pathname);
  void done.catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[server]', err);
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.end('server error');
    }
  });
}).listen(PORT, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`local api + app on http://127.0.0.1:${PORT}  (dist: ${DIST})`);
});
