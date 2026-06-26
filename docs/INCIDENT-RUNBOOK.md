# Incident Response Runbook — Tresor Couture

Fast reference for when production (https://tresorcouture.in) is broken. Keep it short; act first, document after.

## 0. Severity
- **SEV1** — store down, checkout/payments broken, data loss, security breach. Act immediately.
- **SEV2** — a key flow degraded (search, admin, email) but store is up. Same day.
- **SEV3** — cosmetic / minor. Next working day.

## 1. Roles & escalation
| Role | Who | Reach |
|---|---|---|
| Incident lead (decides rollback) | [NAME] | [PHONE] |
| Engineering | [NAME] | [EMAIL/PHONE] |
| Payments/Finance (Razorpay) | [NAME] | [PHONE] |
| Comms (customers/social) | [NAME] | [PHONE] |

Escalate to the incident lead for any SEV1 within 5 minutes.

## 2. Communication channels
- Internal: [WhatsApp/Slack group link]
- Customer-facing: Instagram @_tresor.couture + a banner/notice; support `hello@tresorcouture.in`, `+91 63042 11922`.
- Status updates every 30 min during a SEV1 until resolved.

## 3. First checks (triage, ~2 min)
- Vercel → Deployments: is the latest deploy **Ready** or **Error**? Check build logs.
- Firebase Console → Firestore: rules published? quota/usage exceeded? (Spark plan caps.)
- Razorpay Dashboard: payments succeeding? webhook delivering 200s?
- Browser console on the live site: JS errors / CSP blocks / failed network calls.

## 4. Rollback strategies (fastest first)

### A. Frontend / app regression (most common)
Vercel keeps every deployment. Instant rollback — **no rebuild**:
- Vercel → Project → **Deployments** → pick the last known-good deployment → **⋯ → Promote to Production** (a.k.a. Instant Rollback).
- Or CLI: `vercel rollback <deployment-url>`.

### B. Bad Firestore rules (permission denials / data exposure)
Rules are independent of the app deploy.
- Revert in git, then `firebase deploy --only firestore:rules`, **or**
- Firebase Console → Firestore → Rules → paste the last-good ruleset → Publish.
- Last-good rules live in `firestore.rules` on `main`.

### C. Bad data / migration
- Firestore has no one-click restore on Spark. Mitigate by toggling the affected feature off and fixing forward. (Consider scheduled exports before risky migrations.)

### D. Env/secret/config issue
- Vercel → Settings → Environment Variables. Fix the value, then **redeploy** (env changes need a new deployment).
- Payments down? Verify `RAZORPAY_KEY_ID/SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `FIREBASE_SERVICE_ACCOUNT`.
- Email down? Verify `BREVO_API_KEY` (degrades gracefully; not SEV1).

## 5. Payment-specific (SEV1)
- If orders are charged but not recorded: check `/api/payments/webhook` logs + Razorpay webhook delivery. Orders are reconciled server-side on verify; cross-check Razorpay payments vs Firestore `orders`.
- If checkout fails entirely: confirm Razorpay keys are LIVE + activated; fall back to COD by disabling online payment in the UI if needed.

## 6. Security incident
- Suspected key leak: rotate the affected secret (Razorpay, Brevo, Firebase service account) immediately; update Vercel env; redeploy.
- Suspected abuse/DDoS (no WAF on Hobby): enable Vercel **Attack Challenge Mode** if available; otherwise upgrade to Pro for WAF. Tighten Firestore rules to deny the abused path.

## 7. After action (within 48h)
- Write a short post-mortem: timeline, root cause, fix, prevention. Add a test or guardrail so it can't recur.

---
_Replace every [BRACKETED] field before launch. Review quarterly._
