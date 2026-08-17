import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Package, Boxes, ShoppingBag, RotateCcw, ReceiptText, Users, Headphones, Tag, Star, Scale, Zap, Mail, Palette, LogOut, ExternalLink, ChevronDown, Search, ScanLine } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { chatApi } from '../../lib/support';
import type { AdminSection } from '../../types';


const NAV: { id: AdminSection; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'counter', label: 'Counter', Icon: ScanLine },
  { id: 'products', label: 'Products', Icon: Package },
  { id: 'inventory', label: 'Inventory', Icon: Boxes },
  { id: 'orders', label: 'Orders', Icon: ShoppingBag },
  { id: 'returns', label: 'Returns', Icon: RotateCcw },
  { id: 'billing', label: 'Billing', Icon: ReceiptText },
  { id: 'customers', label: 'Customers', Icon: Users },
  { id: 'support', label: 'Support', Icon: Headphones },
  { id: 'coupons', label: 'Coupons', Icon: Tag },
  { id: 'reviews', label: 'Reviews', Icon: Star },
  { id: 'compliance', label: 'Compliance', Icon: Scale },
  { id: 'delivery', label: 'Delivery', Icon: Zap },
  { id: 'bulk-email', label: 'Bulk Email', Icon: Mail },
  { id: 'seo', label: 'Catalogue SEO', Icon: Search }
];

const AdminLayout: React.FC<{ section: AdminSection; children: React.ReactNode }> = ({ section, children }) => {
  const { user, logout } = useAuth();
  const { navigate } = useRouter();

  // Live count of chats with unread customer messages, so any admin page shows
  // a Support badge without the admin having to open the inbox to notice.
  const [chatUnread, setChatUnread] = useState(0);
  useEffect(() => {
    const unsub = chatApi.subscribeConversations(convs => {
      setChatUnread(convs.reduce((n, c) => n + (c.unreadForAdmin ?? 0), 0));
    });
    return unsub;
  }, []);

  // On phones the 13 sections previously sat in a horizontally-scrolling strip
  // that clipped mid-word with no affordance, so Returns/Support/Customers were
  // effectively undiscoverable. Collapse them behind a disclosure instead, which
  // also names the section you're currently on. Desktop keeps the full sidebar.
  const [navOpen, setNavOpen] = useState(false);
  const current = NAV.find(n => n.id === section);
  useEffect(() => { setNavOpen(false); }, [section]);

  return (
    <div className="min-h-screen bg-[color:var(--color-myntra-bg-soft)]">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10 py-5 md:py-8">
        <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-4 md:gap-6">
          {/* Sidebar */}
          <aside className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4 md:sticky md:top-5 md:self-start">
            <div className="px-2 pb-4 mb-3 border-b border-[color:var(--color-myntra-border-soft)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-myntra-ink-mute)]">
                Admin
              </p>
              <p className="text-[14px] font-extrabold text-[color:var(--color-myntra-navy)] truncate">
                {user?.fullName ?? 'Atelier'}
              </p>
              <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] truncate">{user?.email}</p>
            </div>
            {/* Mobile-only section switcher. Shows where you are and, when
                collapsed, still surfaces the Support unread count. */}
            <button
              type="button"
              onClick={() => setNavOpen(o => !o)}
              aria-expanded={navOpen}
              aria-controls="admin-sections"
              className="md:hidden w-full flex items-center gap-2.5 px-3 py-2.5 rounded border border-[color:var(--color-myntra-border-soft)] text-[13px] font-bold text-[color:var(--color-myntra-navy)]"
            >
              {current ? <current.Icon className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
              <span className="flex-1 text-left">{current?.label ?? 'Sections'}</span>
              {!navOpen && chatUnread > 0 && section !== 'support' && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold inline-flex items-center justify-center bg-[color:var(--color-myntra-pink)] text-white">
                  {chatUnread}
                </span>
              )}
              <ChevronDown className={`w-4 h-4 transition-transform ${navOpen ? 'rotate-180' : ''}`} />
            </button>

            <nav
              id="admin-sections"
              className={`${navOpen ? 'grid grid-cols-2 mt-2' : 'hidden'} md:flex md:flex-col md:mt-0 gap-1`}
            >
              {NAV.map(({ id, label, Icon }) => {
                const active = section === id;
                return (
                  <button
                    key={id}
                    onClick={() => navigate({ name: 'admin', section: id })}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-bold transition-colors shrink-0 ${
                      active
                        ? 'bg-[color:var(--color-myntra-pink)] text-white'
                        : 'text-[color:var(--color-myntra-navy)] hover:bg-[color:var(--color-myntra-bg-soft)]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{label}</span>
                    {id === 'support' && chatUnread > 0 && (
                      <span
                        className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold inline-flex items-center justify-center ${
                          active ? 'bg-white text-[color:var(--color-myntra-pink)]' : 'bg-[color:var(--color-myntra-pink)] text-white'
                        }`}
                        aria-label={`${chatUnread} unread chat${chatUnread === 1 ? '' : 's'}`}
                      >
                        {chatUnread}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="mt-4 pt-4 border-t border-[color:var(--color-myntra-border-soft)] flex flex-col gap-1.5">
              <button
                onClick={() => navigate({ name: 'admin-brand-kit' })}
                className="flex items-center gap-2 px-3 py-2 rounded text-[12px] font-semibold text-[color:var(--color-myntra-ink-soft)] hover:bg-[color:var(--color-myntra-bg-soft)]"
              >
                <Palette className="w-4 h-4" /> Brand Identity Kit
              </button>
              <button
                onClick={() => navigate({ name: 'home' })}
                className="flex items-center gap-2 px-3 py-2 rounded text-[12px] font-semibold text-[color:var(--color-myntra-ink-soft)] hover:bg-[color:var(--color-myntra-bg-soft)]"
              >
                <ExternalLink className="w-4 h-4" /> View Storefront
              </button>
              <button
                onClick={() => { logout(); navigate({ name: 'home' }); }}
                className="flex items-center gap-2 px-3 py-2 rounded text-[12px] font-semibold text-[color:var(--color-myntra-ink-soft)] hover:bg-[color:var(--color-myntra-bg-soft)]"
              >
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </aside>

          {/* Content — min-w-0 so wide tables/rows scroll instead of
              overflowing the page (the classic CSS-grid blowout). */}
          <section className="min-w-0">{children}</section>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
