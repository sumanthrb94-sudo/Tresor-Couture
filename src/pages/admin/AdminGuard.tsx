import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';

/**
 * Wraps an admin view; redirects unauthorised users to /login.
 * Renders nothing while auth bootstraps so a flash of admin UI never appears.
 */
const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, loading } = useAuth();
  const { navigate } = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ name: 'login' });
    else if (!isAdmin) navigate({ name: 'home' });
  }, [user, isAdmin, loading, navigate]);

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
