#!/usr/bin/env node
/**
 * Fail the build before Vercel does, if `api/` has grown past the plan limit.
 *
 * Vercel bills one serverless function per file under `api/`, and the Hobby
 * plan allows twelve. Going over does not fail the BUILD — it fails the
 * DEPLOY, after a green build, with a message about creating a team. That is a
 * confusing place to discover a quota, and it happened: adding the counter
 * endpoint made thirteen.
 *
 * Files and directories starting with `_` are shared modules, not endpoints,
 * and Vercel excludes them from the count — which is what `api/_lib/` and
 * `api/_handlers/` rely on. A dynamic segment (`api/email/[kind].ts`) is ONE
 * function serving many paths, which is how three email endpoints fit in one
 * slot with their URLs unchanged.
 *
 *   node scripts/check-function-count.mjs [--limit 12]
 */
import fs from 'node:fs';
import path from 'node:path';

const idx = process.argv.indexOf('--limit');
const LIMIT = idx >= 0 ? Number(process.argv[idx + 1]) : 12;
const ROOT = 'api';

/** Every .ts/.js under api/, skipping `_`-prefixed paths the platform ignores. */
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|js|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

if (!fs.existsSync(ROOT)) {
  console.log('No api/ directory — nothing to count.');
  process.exit(0);
}

const files = walk(ROOT).sort();
for (const f of files) console.log(`  ${f}`);
console.log(`\n${files.length} serverless function(s), limit ${LIMIT}.`);

if (files.length > LIMIT) {
  console.error(
    `\nOVER THE LIMIT by ${files.length - LIMIT}. The build will pass and the DEPLOY will fail.\n\n` +
    'Options, cheapest first:\n' +
    '  1. Collapse sibling routes behind a dynamic segment, e.g. api/thing/[action].ts\n' +
    '     dispatching to modules under api/_handlers/. URLs stay exactly the same.\n' +
    '  2. Delete an endpoint nothing calls.\n' +
    '  3. Upgrade the Vercel plan.\n\n' +
    'Do NOT merge endpoints with different security postures into one dispatcher —\n' +
    'a signature-verified webhook next to a token-authenticated route is how the\n' +
    'wrong guard ends up running.',
  );
  process.exit(1);
}
console.log('✓ within the limit.');
