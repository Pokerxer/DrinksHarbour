'use client';
import { useParams } from 'next/navigation';
import ContactOrders from '@/app/shared/contacts/contact-orders';

export default function ContactOrdersPage() {
  // `id` is the contact's "source:id" key.
  const { id } = useParams<{ id: string }>();
  return <ContactOrders contactKey={decodeURIComponent(id)} />;
}
