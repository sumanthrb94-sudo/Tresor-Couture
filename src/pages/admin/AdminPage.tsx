import React from 'react';
import AdminGuard from './AdminGuard';
import AdminLayout from './AdminLayout';
import AdminDashboard from './AdminDashboard';
import AdminProducts from './AdminProducts';
import AdminOrders from './AdminOrders';
import AdminCoupons from './AdminCoupons';
import AdminReviews from './AdminReviews';
import AdminDelivery from './AdminDelivery';

type Section = 'dashboard' | 'products' | 'orders' | 'coupons' | 'reviews' | 'delivery';

interface Props {
  section?: Section;
}

const AdminPage: React.FC<Props> = ({ section = 'dashboard' }) => (
  <AdminGuard>
    <AdminLayout section={section}>
      {section === 'dashboard' && <AdminDashboard />}
      {section === 'products' && <AdminProducts />}
      {section === 'orders' && <AdminOrders />}
      {section === 'coupons' && <AdminCoupons />}
      {section === 'reviews' && <AdminReviews />}
      {section === 'delivery' && <AdminDelivery />}
    </AdminLayout>
  </AdminGuard>
);

export default AdminPage;
