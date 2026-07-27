# Project Documents

The six source-of-truth documents for Tresor Couture.

| # | Document | Answers |
|---|---|---|
| 01 | [PRD](./01-PRD.md) | What we're building and for whom |
| 02 | [TRD](./02-TRD.md) | Which tech, tools and APIs — and the constraints that bite |
| 03 | [App Flow](./03-APP-FLOW.md) | Every page, every route, every journey |
| 04 | [UI/UX Brief](./04-UI-UX-BRIEF.md) | How it looks and behaves |
| 05 | [Backend Schema](./05-BACKEND-SCHEMA.md) | Collections, relationships, auth, rules |
| 06 | [Implementation Plan](./06-IMPLEMENTATION-PLAN.md) | Build sequence, test results, what's left |

## How to use these

**Starting an AI coding session on this repo?** Paste 02 (TRD) and 05 (Backend
Schema) first — they contain the constraints that cause real breakage if
violated. Add 03 and 04 when working on UI.

**These are reverse-documented from the shipped code**, not a pre-build spec. If
a document and the code disagree, the code is right and the document is stale —
update the document.

## The five things that break production if ignored

1. **`firestore.rules` is the security boundary.** The browser writes to
   Firestore directly. Changing who-can-read-what means changing the rules, and
   deploying them to Firebase separately from the Vercel deploy.
2. **No composite indexes.** Never put an `orderBy` next to a `where` — sort in
   JavaScript instead. The service account cannot create indexes.
3. **One Admin SDK app.** `api/_lib/auth.ts` must initialise through
   `getAdminApp()`. A second `initializeApp` poisons Firestore credentials for
   the whole request.
4. **`jose` is pinned to v5.** v6 is ESM-only and `jwks-rsa` `require()`s it —
   unpinning 500s every authenticated API call on Vercel.
5. **`VITE_*` vars are baked in at build time.** Changing one in Vercel does
   nothing until you redeploy.

## Related operational docs

[`../LAUNCH-MANUAL.md`](../LAUNCH-MANUAL.md) ·
[`../PRODUCTION-CHECKLIST.md`](../PRODUCTION-CHECKLIST.md) ·
[`../INCIDENT-RUNBOOK.md`](../INCIDENT-RUNBOOK.md) ·
[`../SMOKE-TEST.md`](../SMOKE-TEST.md) ·
[`../PAYMENTS-SETUP.md`](../PAYMENTS-SETUP.md) ·
[`../../MANUAL-ACTIONS.md`](../../MANUAL-ACTIONS.md)
