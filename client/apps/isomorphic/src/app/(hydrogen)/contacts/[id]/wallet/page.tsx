'use client';
import { useParams } from 'next/navigation';
import ContactWallet from '@/app/shared/contacts/contact-wallet';

export default function ContactWalletPage() {
  // `id` is the contact's "source:id" key.
  const { id } = useParams<{ id: string }>();
  return <ContactWallet contactKey={decodeURIComponent(id)} />;
}
