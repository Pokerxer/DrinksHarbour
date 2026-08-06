import { Metadata } from 'next';
import BackButton from '@/app/shared/support/inbox/back-button';
import MessageDetailView from '@/app/shared/support/inbox/message-detail-page';
import { metaObject } from '@/config/site.config';

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * The id is an opaque base64url handle, not a human-readable subject, so it is
 * deliberately NOT interpolated into the page title — decoding it here would
 * also put a folder path and uid into the browser history and any shared link
 * preview.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params;
  return metaObject('Message');
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return (
    <div className="mt-5 lg:mt-9">
      <BackButton />
      <MessageDetailView id={id} />
    </div>
  );
}
