'use client';
import { useParams } from 'next/navigation';
import ContactLoyalty from '@/app/shared/contacts/contact-loyalty';

export default function ContactLoyaltyPage() {
  // `id` is the contact's "source:id" key.
  const { id } = useParams<{ id: string }>();
  return <ContactLoyalty contactKey={decodeURIComponent(id)} />;
}
