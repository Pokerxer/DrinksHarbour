import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Account - DrinksHarbour',
  description: 'Manage your account, view orders, and track deliveries',
};

export default function MyAccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-50 min-h-screen">
      {children}
    </div>
  );
}
