// @ts-nocheck
import { routes } from '@/config/routes';
import PageHeader from '@/app/shared/page-header';
import CreateEditBlogPost from '@/app/shared/blog/create-edit';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Create Blog Post'),
};

const pageHeader = {
  title: 'Create Blog Post',
  breadcrumb: [
    { href: routes.blog.list, name: 'Blog' },
    { name: 'Create' },
  ],
};

export default function CreateBlogPostPage() {
  return (
    <>
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
      <CreateEditBlogPost />
    </>
  );
}
