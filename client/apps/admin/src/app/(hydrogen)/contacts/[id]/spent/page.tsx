'use client';
import { useParams } from 'next/navigation';
import ContactSpending from '@/app/shared/contacts/contact-spending';

export default function ContactSpendingPage() {
  // `id` is the contact's "source:id" key.
  const { id } = useParams<{ id: string }>();
  return <ContactSpending contactKey={decodeURIComponent(id)} />;
}
