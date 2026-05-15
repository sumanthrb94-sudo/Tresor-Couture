/**
 * SHA-256 over a UTF-8 string. Used for password storage in the
 * localStorage-backed user store. NOT a real auth scheme — when the
 * backend lands it should issue bcrypt/argon2 hashes server-side.
 */
export async function sha256(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
