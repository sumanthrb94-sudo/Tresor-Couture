import React from 'react';
import { LayoutDashboard, Package, Boxes, ShoppingBag, ReceiptText, Users, Tag, Star, Scale, Palette, LogOut, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';

type Section =
  | 'dashboard'
  | 'products'
  | 'inventory'
  | 'orders'
  | 'billing'
  | 'customers'
  | 'coupons'
  | 'reviews'
  | 'compliance';

const NAV: { id: Section; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'products', label: 'Products', Icon: Package },
  { id: 'inventory', label: 'Inventory', Icon: Boxes },
  { id: 'orders', label: 'Orders', Icon: ShoppingBag },
  { id: 'billing', label: 'Billing', Icon: ReceiptText },
  { id: 'customers', label: 'Customers', Icon: Users },
  { id: 'coupons', label: 'Coupons', Icon: Tag },
  { id: 'reviews', label: 'Reviews', Icon: Star },
  { id: 'compliance', label: 'Compliance', Icon: Scale }
];

const AdminLayout: React.FC<{ section: Section; children: React.ReactNode }> = ({ section, children }) => {
  const { user, logout } = useAuth();
  const { navigate } = useRouter();

  return (
    <div className="pt-[100px] min-h-screen bg-[color:var(--color-myntra-bg-soft)]">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10 py-6 md:py-8">
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 md:gap-6">
          {/* Sidebar */}
          <aside className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4 md:sticky md:top-[110px] md:self-start">
            <div className="px-2 pb-4 mb-3 border-b border-[color:var(--color-myntra-border-soft)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-myntra-ink-mute)]">
                Admin
              </p>
              <p className="text-[14px] font-extrabold text-[color:var(--color-myntra-navy)] truncate">
                {user?.fullName ?? 'Atelier'}
              </p>
              <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] truncate">{user?.email}</p>
            </div>
            <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
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
                    {label}
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

          {/* Content */}
          <section>{children}</section>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
