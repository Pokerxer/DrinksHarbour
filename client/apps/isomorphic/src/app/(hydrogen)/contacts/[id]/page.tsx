'use client';
import { useParams } from 'next/navigation';
import ContactDetail from '@/app/shared/contacts/contact-detail';

export default function ContactDetailPage() {
  // `id` is the contact's "source:id" key.
  const { id } = useParams<{ id: string }>();
  return <ContactDetail contactKey={decodeURIComponent(id)} />;
}
