import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';

/**
 * Wraps an admin view; redirects unauthorised users to /login.
 * Renders nothing while auth bootstraps so a flash of admin UI never appears.
 *
 * A signed-in user who does not read as admin gets ONE re-check against a
 * freshly minted token before being sent away: the cached token may predate
 * the admin claim, or the first claim read may have failed. Without it an
 * admin who opened the console straight after signing in could be bounced to
 * the home page.
 */
const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, loading, recheckAdmin } = useAuth();
  const { navigate } = useRouter();
  const [rechecked, setRechecked] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ name: 'login' }); return; }
    if (isAdmin) return;
    if (!rechecked) {
      let cancelled = false;
      void recheckAdmin().finally(() => { if (!cancelled) setRechecked(true); });
      return () => { cancelled = true; };
    }
    navigate({ name: 'home' });
  }, [user, isAdmin, loading, rechecked, recheckAdmin, navigate]);

  if (loading || !user || !isAdmin) {
    return (
      <main className="pt-[140px] pb-20 min-h-screen text-center px-5 bg-white">
        <p className="text-[14px] text-[color:var(--color-myntra-ink-soft)]">Verifying admin access…</p>
      </main>
    );
  }
  return <>{children}</>;
};

export default AdminGuard;
