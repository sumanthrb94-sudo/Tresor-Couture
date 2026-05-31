/**
 * Razorpay server-side helpers. Keys live ONLY in server env:
 *   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET   — order creation + signature check
 *   RAZORPAY_WEBHOOK_SECRET                — webhook payload verification
 *
 * VITE_RAZORPAY_KEY_ID (public, client) is the SAME key id; it is safe to
 * expose because the secret never leaves the server.
 */
import crypto from 'node:crypto';
import Razorpay from 'razorpay';

export function razorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET &&
      process.env.RAZORPAY_KEY_ID.trim() &&
      process.env.RAZORPAY_KEY_SECRET.trim(),
  );
}

export function getRazorpay(): Razorpay {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) throw new Error('payments_not_configured');
  return new Razorpay({ key_id, key_secret });
}

/**
 * Verify the checkout handshake signature returned by Razorpay Checkout.js:
 *   HMAC_SHA256(order_id + "|" + payment_id, key_secret) === razorpay_signature
 */
export function verifyCheckoutSignature(args: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${args.razorpay_order_id}|${args.razorpay_payment_id}`)
    .digest('hex');
  return timingSafeEqualHex(expected, args.razorpay_signature);
}

/**
 * Verify a webhook payload: HMAC_SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)
 * compared against the X-Razorpay-Signature header.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqualHex(expected, signature);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length || ba.length === 0) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
