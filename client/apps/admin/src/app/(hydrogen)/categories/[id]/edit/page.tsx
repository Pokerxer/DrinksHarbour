// @ts-nocheck
import { routes } from '@/config/routes';
import PageHeader from '@/app/shared/page-header';
import CreateCategory from '@/app/shared/ecommerce/category/create-category';
import { metaObject } from '@/config/site.config';
import { Metadata } from 'next';

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/categories/${id}`,
      { cache: 'no-store' }
    );
    const json = await res.json();
    const name = json?.data?.category?.name;
    if (name) return metaObject(`Edit ${name}`);
  } catch {}
  return metaObject('Edit Category');
}

export default async function EditCategoryPage({ params }: Props) {
  const { id } = await params;

  let category = null;
  let currentImages: { thumbnail?: string; featured?: string; banner?: string } = {};

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/categories/${id}`,
      { cache: 'no-store' }
    );
    const json = await res.json();
    if (json.success && json.data?.category) {
      const c = json.data.category;
      category = {
        name: c.name || '',
        displayName: c.displayName || '',
        slug: c.slug || '',
        tagline: c.tagline || '',
        type: c.type || '',
        subType: c.subType || '',
        alcoholCategory: c.alcoholCategory || 'alcoholic',
        description: c.description || '',
        shortDescription: c.shortDescription || '',
        parentCategory: c.parent ? String(c.parent) : '',
        displayOrder: c.displayOrder ?? 999,
        status: c.status || 'draft',
        isFeatured: c.isFeatured ?? false,
        isTrending: c.isTrending ?? false,
        isPopular: c.isPopular ?? false,
        isNewArrival: c.isNewArrival ?? false,
        showInMenu: c.showInMenu ?? true,
        showOnHomepage: c.showOnHomepage ?? false,
        color: c.color || '#6B7280',
        icon: c.icon || '',
        defaultSort: c.defaultSort || 'relevance',
        notes: c.notes || '',
        metaTitle: c.metaTitle || '',
        metaDescription: c.metaDescription || '',
        metaKeywords: Array.isArray(c.metaKeywords)
          ? c.metaKeywords.join(', ')
          : (c.metaKeywords || ''),
        canonicalUrl: c.canonicalUrl || '',
      };
      currentImages = {
        thumbnail: c.thumbnailImage?.url,
        featured: c.featuredImage?.url,
        banner: c.bannerImage?.url,
      };
    }
  } catch {
    // fall through with null
  }

  const categoryName = category?.name || 'Category';

  const breadcrumb = [
    { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
    { href: routes.eCommerce.categories, name: 'Categories' },
    { name: categoryName },
  ];

  return (
    <>
      <PageHeader title={`Edit: ${categoryName}`} breadcrumb={breadcrumb} />
      <CreateCategory
        id={id}
        category={category}
        currentImages={currentImages}
        isModalView={false}
      />
    </>
  );
}
