import React from 'react';
import AdminGuard from './AdminGuard';
import AdminLayout from './AdminLayout';
import AdminDashboard from './AdminDashboard';
import AdminProducts from './AdminProducts';
import AdminInventory from './AdminInventory';
import AdminOrders from './AdminOrders';
import AdminBilling from './AdminBilling';
import AdminCustomers from './AdminCustomers';
import AdminCoupons from './AdminCoupons';
import AdminReviews from './AdminReviews';
import AdminCompliance from './AdminCompliance';

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

interface Props {
  section?: Section;
}

const AdminPage: React.FC<Props> = ({ section = 'dashboard' }) => (
  <AdminGuard>
    <AdminLayout section={section}>
      {section === 'dashboard' && <AdminDashboard />}
      {section === 'products' && <AdminProducts />}
      {section === 'inventory' && <AdminInventory />}
      {section === 'orders' && <AdminOrders />}
      {section === 'billing' && <AdminBilling />}
      {section === 'customers' && <AdminCustomers />}
      {section === 'coupons' && <AdminCoupons />}
      {section === 'reviews' && <AdminReviews />}
      {section === 'compliance' && <AdminCompliance />}
    </AdminLayout>
  </AdminGuard>
);

export default AdminPage;
