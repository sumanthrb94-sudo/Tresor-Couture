import React from 'react';
import { Image as ImageIcon, LogOut, BookOpen } from 'lucide-react';
import { useRouter } from '../context/RouterContext';
import { useAdminAuth } from '../context/AdminAuthContext';

const tools = [
  {
    id: 'brand-kit',
    title: 'Brand Identity Kit',
    blurb: 'Every logo, favicon, social post, story, banner and print template — with downloads and copy-to-clipboard tokens.',
    icon: ImageIcon,
    to: { name: 'admin-brand-kit' as const },
    cta: 'Open the kit',
  },
];

const AdminLandingPage: React.FC = () => {
  const { navigate } = useRouter();
  const { lock } = useAdminAuth();

  return (
    <main className="min-h-[calc(100vh-100px)] bg-[#F5ECDC] pt-[88px] md:pt-[100px] pb-20">
      <div className="max-w-[1100px] mx-auto px-5 md:px-10 pt-10 md:pt-14">
        <div className="flex items-start justify-between mb-10">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.25em] text-[#8E6520] uppercase mb-3">
              The Atelier · Admin
            </p>
            <h1 className="font-[Cormorant_Garamond,serif] text-[44px] md:text-[64px] text-[#2A1F12] leading-[1.05]">
              Behind the curtain.
            </h1>
            <p className="text-[15px] text-[#46382A] mt-3 max-w-[560px]">
              Manage what the world sees. Pick a tool below to start.
            </p>
          </div>
          <button
            onClick={() => { lock(); navigate({ name: 'home' }); }}
            className="hidden md:inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] font-semibold text-[#8E6520] hover:text-[#2A1F12]"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 md:gap-7">
          {tools.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => navigate(t.to)}
                className="group text-left bg-[#FBF5EA] border border-[#B8893A]/25 hover:border-[#B8893A] transition-colors p-6 md:p-8 shadow-sm hover:shadow-xl"
              >
                <div className="w-12 h-12 rounded-full bg-[#2A1F12] flex items-center justify-center mb-5 group-hover:bg-[#B8893A] transition-colors">
                  <Icon className="w-5 h-5 text-[#D8B97A] group-hover:text-[#2A1F12]" />
                </div>
                <h2 className="font-[Cormorant_Garamond,serif] text-[28px] text-[#2A1F12] mb-2">{t.title}</h2>
                <p className="text-[13.5px] text-[#46382A] leading-relaxed mb-5">{t.blurb}</p>
                <span className="inline-flex items-center text-[12px] uppercase tracking-[0.2em] font-semibold text-[#8E6520] group-hover:text-[#2A1F12]">
                  {t.cta} <span className="ml-2">→</span>
                </span>
              </button>
            );
          })}

          <div className="bg-[#FBF5EA]/60 border border-dashed border-[#B8893A]/30 p-6 md:p-8 flex flex-col gap-3 justify-center text-[#46382A]">
            <div className="w-12 h-12 rounded-full bg-[#EAD9BA] flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-[#8E6520]" />
            </div>
            <h2 className="font-[Cormorant_Garamond,serif] text-[28px] text-[#2A1F12]">More tools, soon.</h2>
            <p className="text-[13.5px] leading-relaxed max-w-[360px]">
              Inventory, order operations, content scheduling and the press desk will live here next.
            </p>
          </div>
        </div>

        <button
          onClick={() => { lock(); navigate({ name: 'home' }); }}
          className="md:hidden mt-10 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] font-semibold text-[#8E6520]"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </main>
  );
};

export default AdminLandingPage;
