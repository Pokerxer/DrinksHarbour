import { redirect } from 'next/navigation';

export default function POSSessionsRedirect() {
  redirect('/pos/sessions');
}
