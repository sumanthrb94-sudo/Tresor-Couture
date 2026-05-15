import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useRouter } from '../context/RouterContext';

const AdminLoginPage: React.FC<{ redirectTo?: 'admin' | 'admin-brand-kit'; section?: string }> = ({
  redirectTo = 'admin',
  section,
}) => {
  const { unlock } = useAdminAuth();
  const { navigate } = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (unlock(code)) {
      setError(null);
      navigate(redirectTo === 'admin-brand-kit' ? { name: 'admin-brand-kit', section } : { name: 'admin' });
    } else {
      setError('That passcode doesn’t match our records.');
    }
  };

  return (
    <main className="min-h-[calc(100vh-88px)] bg-[#F5ECDC] flex items-center justify-center pt-[88px] md:pt-[100px] pb-16 px-4">
      <div className="max-w-[440px] w-full bg-[#FBF5EA] border border-[#B8893A]/30 shadow-xl px-7 py-9 md:px-10 md:py-12 relative">
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FBF5EA] text-[#8E6520] text-[10px] tracking-[0.3em] px-3 py-1 font-semibold uppercase">
          The Atelier · Admin
        </span>

        <div className="text-center mb-7">
          <div className="w-14 h-14 rounded-full bg-[#2A1F12] mx-auto flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-[#D8B97A]" />
          </div>
          <h1 className="font-[Cormorant_Garamond,serif] text-[36px] md:text-[44px] text-[#2A1F12] leading-tight">
            Restricted entry
          </h1>
          <p className="text-[13px] text-[#46382A] mt-2 max-w-[320px] mx-auto">
            This door leads to the brand-kit admin. Speak the passcode and we'll lift the curtain.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[11px] tracking-[0.18em] uppercase font-semibold text-[#8E6520] mb-2">
              Passcode
            </label>
            <input
              autoFocus
              type="password"
              value={code}
              onChange={e => { setCode(e.target.value); setError(null); }}
              placeholder="Passcode"
              className="w-full bg-white border border-[#B8893A]/30 rounded px-4 py-3 text-[15px] text-[#2A1F12] focus:outline-none focus:border-[#B8893A] focus:ring-1 focus:ring-[#B8893A]"
            />
            {error && (
              <p className="mt-2 text-[12px] text-[#8E6520]">{error}</p>
            )}
          </div>
          <button
            type="submit"
            className="w-full bg-[#2A1F12] hover:bg-[#3a2a18] text-[#F5ECDC] font-semibold tracking-[0.18em] uppercase text-[12px] py-3.5 rounded transition-colors"
          >
            Enter
          </button>
        </form>

        <p className="text-[11px] text-[#8E6520]/80 mt-6 text-center">
          Default passcode is <code className="font-mono text-[#2A1F12]">tresor-atelier</code>.
          Set <code className="font-mono">VITE_ADMIN_PASSCODE</code> in the environment to change it.
        </p>
      </div>
    </main>
  );
};

export default AdminLoginPage;
