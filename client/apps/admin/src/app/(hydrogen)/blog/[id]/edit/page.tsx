// @ts-nocheck
import { routes } from '@/config/routes';
import PageHeader from '@/app/shared/page-header';
import CreateEditBlogPost from '@/app/shared/blog/create-edit';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Edit Blog Post'),
};

const pageHeader = {
  title: 'Edit Blog Post',
  breadcrumb: [{ href: routes.blog.list, name: 'Blog' }, { name: 'Edit' }],
};

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
      <CreateEditBlogPost postId={id} />
    </>
  );
}
