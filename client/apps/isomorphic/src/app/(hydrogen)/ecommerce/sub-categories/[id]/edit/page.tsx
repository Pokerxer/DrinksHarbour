// @ts-nocheck
import { routes } from '@/config/routes';
import PageHeader from '@/app/shared/page-header';
import CreateSubCategory from '@/app/shared/ecommerce/subcategory/create-subcategory';
import { metaObject } from '@/config/site.config';
import { Metadata } from 'next';

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/subcategories/${id}`,
      { cache: 'no-store' }
    );
    const json = await res.json();
    const name = json?.data?.name;
    if (name) return metaObject(`Edit ${name}`);
  } catch {}
  return metaObject('Edit SubCategory');
}

export default async function EditSubCategoryPage({ params }: Props) {
  const { id } = await params;

  let subcategory = null;
  let currentImages: { thumbnail?: string; featured?: string; banner?: string } = {};

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/subcategories/${id}`,
      { cache: 'no-store' }
    );
    const json = await res.json();
    if (json.success && json.data) {
      const c = json.data;
      // parent may be a populated object or an ObjectId string
      const parentId = c.parent
        ? (typeof c.parent === 'object' ? c.parent._id : String(c.parent))
        : '';

      subcategory = {
        name: c.name || '',
        displayName: c.displayName || '',
        slug: c.slug || '',
        tagline: c.tagline || '',
        parent: parentId,
        type: c.type || '',
        subType: c.subType || '',
        style: c.style || '',
        description: c.description || '',
        shortDescription: c.shortDescription || '',
        displayOrder: c.displayOrder ?? 999,
        status: c.status || 'draft',
        isFeatured: c.isFeatured ?? false,
        isTrending: c.isTrending ?? false,
        isPopular: c.isPopular ?? false,
        showInMenu: c.showInMenu ?? true,
        color: c.color || '#6B7280',
        icon: c.icon || '',
        notes: c.notes || '',
        metaTitle: c.metaTitle || '',
        metaDescription: c.metaDescription || '',
        metaKeywords: Array.isArray(c.metaKeywords)
          ? c.metaKeywords.join(', ')
          : (c.metaKeywords || ''),
        canonicalUrl: c.canonicalUrl || '',
        typicalFlavors: Array.isArray(c.typicalFlavors)
          ? c.typicalFlavors.join(', ')
          : (c.typicalFlavors || ''),
        commonPairings: Array.isArray(c.commonPairings)
          ? c.commonPairings.join(', ')
          : (c.commonPairings || ''),
        seasonalSpring: c.seasonal?.spring ?? false,
        seasonalSummer: c.seasonal?.summer ?? false,
        seasonalFall: c.seasonal?.fall ?? false,
        seasonalWinter: c.seasonal?.winter ?? false,
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

  const subCategoryName = subcategory?.name || 'SubCategory';

  const breadcrumb = [
    { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
    { href: routes.eCommerce.subCategories, name: 'SubCategories' },
    { name: subCategoryName },
  ];

  return (
    <>
      <PageHeader title={`Edit: ${subCategoryName}`} breadcrumb={breadcrumb} />
      <CreateSubCategory
        id={id}
        subcategory={subcategory}
        currentImages={currentImages}
        isModalView={false}
      />
    </>
  );
}
