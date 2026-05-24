/**
 * AUTH — signup, login, wrong password, signOut.
 * Each assertion = one behaviour. No setup-as-test bleed.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { register, login, signOut, auth, usersApi } from '../../src/lib/firebase';
import { uniqueEmail, TEST_PASSWORD } from './_helpers';

const EMAIL = uniqueEmail('auth');
const NAME = 'E2E Auth User';

describe('auth flow', () => {
  afterAll(async () => { await signOut(); });

  it('register() creates a Firebase Auth user and a /users/{uid} profile doc', async () => {
    const { user, profile } = await register({ email: EMAIL, password: TEST_PASSWORD, fullName: NAME });
    expect(user.uid).toMatch(/^[A-Za-z0-9]{20,}$/);
    expect(profile.email).toBe(EMAIL);
    expect(profile.role).toBe('customer');

    const me = await usersApi.me();
    expect(me).not.toBeNull();
    expect(me!.uid).toBe(user.uid);
    expect(me!.fullName).toBe(NAME);
  });

  it('signOut() clears auth.currentUser', async () => {
    await signOut();
    expect(auth.currentUser).toBeNull();
  });

  it('login() with the correct password returns the same uid', async () => {
    const user = await login(EMAIL, TEST_PASSWORD);
    expect(user.email).toBe(EMAIL);
    expect(auth.currentUser?.uid).toBe(user.uid);
  });

  it('login() with the wrong password rejects with an auth error', async () => {
    await signOut();
    await expect(login(EMAIL, 'wrong-password-totally')).rejects.toMatchObject({
      code: expect.stringMatching(/^auth\/(invalid-credential|wrong-password|invalid-login-credentials)$/),
    });
    expect(auth.currentUser).toBeNull();
  });
});
