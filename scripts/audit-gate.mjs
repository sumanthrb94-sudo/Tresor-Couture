#!/usr/bin/env node
/**
 * Dependency audit gate for CI.
 *
 * `npm audit --audit-level=high` is all-or-nothing: one unfixable transitive
 * advisory turns CI permanently red, and a permanently red CI is worse than no
 * CI — everyone learns to ignore it, including for the finding that actually
 * matters.
 *
 * This gate fails on every high/critical advisory EXCEPT ones explicitly
 * allowlisted below with a written reason. It also reports allowlist entries
 * that no longer match anything, so the list gets cleaned up instead of growing
 * silently.
 *
 * Run: node scripts/audit-gate.mjs
 */
import { execSync } from 'node:child_process';

/**
 * Advisories we have assessed and consciously accepted. Each entry must say why
 * it is not actionable — "it's annoying" is not a reason. Revisit on every
 * dependency bump.
 */
const ALLOWLIST = {
  // Empty — npm audit is clean. GHSA-mh99-v99m-4gvg (brace-expansion) was
  // accepted here while the only published fix broke minimatch@9 at runtime
  // (PR #23); patched releases now exist on BOTH major lines, applied as
  // scoped overrides in package.json ("brace-expansion@2": 2.1.4,
  // "brace-expansion@5": 5.0.9), so the acceptance is no longer needed.
  // Add entries only after assessing real exploitability, with a written reason.
};

const BLOCKING = new Set(['high', 'critical']);

function runAudit() {
  try {
    return execSync('npm audit --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (err) {
    // npm audit exits non-zero when it finds anything; the JSON is still on stdout.
    if (err.stdout) return err.stdout;
    throw err;
  }
}

/** Pull the GHSA id out of an advisory URL. */
function advisoryId(url) {
  const m = /\/advisories\/(GHSA-[\w-]+)/.exec(url ?? '');
  return m ? m[1] : null;
}

const report = JSON.parse(runAudit());
const vulns = report.vulnerabilities ?? {};

/** @type {Map<string, {id:string, pkg:string, title:string, severity:string, url:string}>} */
const found = new Map();
for (const [pkg, v] of Object.entries(vulns)) {
  if (!BLOCKING.has(v.severity)) continue;
  for (const via of v.via ?? []) {
    if (typeof via !== 'object') continue;
    const id = advisoryId(via.url);
    if (!id || found.has(id)) continue;
    found.set(id, { id, pkg: via.name ?? pkg, title: via.title ?? '', severity: via.severity ?? v.severity, url: via.url });
  }
}

const blocking = [...found.values()].filter(a => !ALLOWLIST[a.id]);
const accepted = [...found.values()].filter(a => ALLOWLIST[a.id]);
const stale = Object.keys(ALLOWLIST).filter(id => !found.has(id));

if (accepted.length) {
  console.log(`Accepted (allowlisted) high/critical advisories: ${accepted.length}`);
  for (const a of accepted) {
    console.log(`  · ${a.id}  ${a.pkg}  ${a.title.slice(0, 80)}`);
    console.log(`      ${ALLOWLIST[a.id].reason}`);
  }
  console.log('');
}

if (stale.length) {
  // Not a failure: a stale entry means the advisory got fixed. Surface it so the
  // allowlist can shrink.
  console.log('::warning::Allowlist entries no longer matching any advisory (safe to remove): ' + stale.join(', '));
  console.log('');
}

if (blocking.length) {
  console.log(`::error::${blocking.length} un-allowlisted high/critical advisor${blocking.length === 1 ? 'y' : 'ies'} found.`);
  for (const a of blocking) {
    console.log(`  ✗ ${a.severity.toUpperCase()}  ${a.id}  ${a.pkg}`);
    console.log(`      ${a.title}`);
    console.log(`      ${a.url}`);
  }
  console.log('');
  console.log('Fix them, or — only after assessing real exploitability — add the');
  console.log('advisory id to ALLOWLIST in scripts/audit-gate.mjs with a written reason.');
  process.exit(1);
}

console.log(`✓ No un-allowlisted high/critical advisories (${accepted.length} accepted).`);
