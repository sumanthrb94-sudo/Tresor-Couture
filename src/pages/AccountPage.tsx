/* Stub — populated by the auth-pages agent. */
import React from 'react';

interface Props {
  tab?: 'profile' | 'orders' | 'wishlist' | 'addresses';
}

const AccountPage: React.FC<Props> = ({ tab }) => (
  <main className="pt-[140px] pb-20 min-h-screen text-center px-5 bg-white">
    <h1 className="text-2xl font-extrabold">Account · {tab ?? 'profile'} coming soon</h1>
  </main>
);

export default AccountPage;
