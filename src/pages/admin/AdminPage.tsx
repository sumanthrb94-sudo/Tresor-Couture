/* Stub — populated by the admin agents. */
import React from 'react';

interface Props {
  section?: 'dashboard' | 'products' | 'orders' | 'coupons' | 'reviews';
}

const AdminPage: React.FC<Props> = ({ section }) => (
  <main className="pt-[140px] pb-20 min-h-screen text-center px-5 bg-white">
    <h1 className="text-2xl font-extrabold">Admin · {section ?? 'dashboard'} coming soon</h1>
  </main>
);

export default AdminPage;
