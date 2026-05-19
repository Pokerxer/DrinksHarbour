import { redirect } from 'next/navigation';

export default function POSHistoryRedirect() {
  redirect('/point-of-sale/orders');
}
