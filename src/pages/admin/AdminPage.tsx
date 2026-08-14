import React from 'react';
import AdminGuard from './AdminGuard';
import AdminLayout from './AdminLayout';
import AdminDashboard from './AdminDashboard';
import AdminProducts from './AdminProducts';
import AdminInventory from './AdminInventory';
import AdminOrders from './AdminOrders';
import AdminReturns from './AdminReturns';
import AdminBilling from './AdminBilling';
import AdminCustomers from './AdminCustomers';
import AdminSupport from './AdminSupport';
import AdminCoupons from './AdminCoupons';
import AdminReviews from './AdminReviews';
import AdminCompliance from './AdminCompliance';
import AdminDelivery from './AdminDelivery';
import AdminBulkEmail from './AdminBulkEmail';
import AdminSeo from './AdminSeo';
import type { AdminSection } from '../../types';


interface Props {
  section?: AdminSection;
}

const AdminPage: React.FC<Props> = ({ section = 'dashboard' }) => (
  <AdminGuard>
    <AdminLayout section={section}>
      {section === 'dashboard' && <AdminDashboard />}
      {section === 'products' && <AdminProducts />}
      {section === 'inventory' && <AdminInventory />}
      {section === 'orders' && <AdminOrders />}
      {section === 'returns' && <AdminReturns />}
      {section === 'billing' && <AdminBilling />}
      {section === 'customers' && <AdminCustomers />}
      {section === 'support' && <AdminSupport />}
      {section === 'coupons' && <AdminCoupons />}
      {section === 'reviews' && <AdminReviews />}
      {section === 'compliance' && <AdminCompliance />}
      {section === 'delivery' && <AdminDelivery />}
      {section === 'bulk-email' && <AdminBulkEmail />}
      {section === 'seo' && <AdminSeo />}
    </AdminLayout>
  </AdminGuard>
);

export default AdminPage;
