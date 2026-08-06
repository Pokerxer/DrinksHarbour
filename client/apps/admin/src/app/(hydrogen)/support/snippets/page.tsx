import SnippetsPage from '@/app/shared/support/snippets';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Snippets'),
};

export default function SupportSnippetsPage() {
  return <SnippetsPage />;
}
