/**
 * Shared utilities for the live-Firebase E2E suite. Each test file owns
 * its own randomly-named throwaway user so suites can run independently.
 */

export function uniqueEmail(tag: string): string {
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  return `e2e-${tag}-${stamp}@tresor-test.invalid`;
}

export const TEST_PASSWORD = 'E2eTresor!Secret_2026';

export const SHIPPING_ADDRESS = {
  fullName: 'E2E Tester',
  line1: '12 Atelier Lane',
  line2: '',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001',
  phone: '+919999999999',
};
