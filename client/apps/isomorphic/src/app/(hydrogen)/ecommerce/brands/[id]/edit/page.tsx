// @ts-nocheck
import { routes } from '@/config/routes';
import PageHeader from '@/app/shared/page-header';
import CreateBrand from '@/app/shared/ecommerce/brand/create-brand';
import { metaObject } from '@/config/site.config';
import { Metadata } from 'next';

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/brands/${id}`,
      { cache: 'no-store' }
    );
    const json = await res.json();
    const name = json?.data?.brand?.name;
    if (name) return metaObject(`Edit ${name}`);
  } catch {}
  return metaObject('Edit Brand');
}

export default async function EditBrandPage({ params }: Props) {
  const { id } = await params;

  let brand = null;
  let currentImages: { logo?: string; featured?: string; banner?: string } = {};

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/brands/${id}`,
      { cache: 'no-store' }
    );
    const json = await res.json();
    if (json.success && json.data?.brand) {
      const c = json.data.brand;
      brand = {
        name: c.name || '',
        slug: c.slug || '',
        legalName: c.legalName || '',
        tradingAs: Array.isArray(c.tradingAs) ? c.tradingAs.join(', ') : (c.tradingAs || ''),
        description: c.description || '',
        shortDescription: c.shortDescription || '',
        tagline: c.tagline || '',
        story: c.story || '',
        founded: c.founded ?? undefined,
        founderName: c.founderName || '',
        brandType: c.brandType || '',
        primaryCategory: c.primaryCategory || '',
        specializations: Array.isArray(c.specializations) ? c.specializations.join(', ') : (c.specializations || ''),
        countryOfOrigin: c.countryOfOrigin || '',
        region: c.region || '',
        hqCity: c.headquarters?.city || '',
        hqCountry: c.headquarters?.country || '',
        website: c.website || '',
        email: c.email || '',
        phone: c.phone || '',
        socialFacebook: c.socialMedia?.facebook || '',
        socialInstagram: c.socialMedia?.instagram || '',
        socialTwitter: c.socialMedia?.twitter || '',
        socialYoutube: c.socialMedia?.youtube || '',
        socialLinkedin: c.socialMedia?.linkedin || '',
        socialTiktok: c.socialMedia?.tiktok || '',
        brandColorPrimary: c.brandColors?.primary || '',
        brandColorSecondary: c.brandColors?.secondary || '',
        brandColorAccent: c.brandColors?.accent || '',
        status: c.status || 'active',
        isFeatured: c.isFeatured ?? false,
        isPopular: c.isPopular ?? false,
        isTrending: c.isTrending ?? false,
        isPremium: c.isPremium ?? false,
        isCraft: c.isCraft ?? false,
        isLocal: c.isLocal ?? false,
        verified: c.verified ?? false,
        displayOrder: c.displayOrder ?? 999,
        metaTitle: c.metaTitle || '',
        metaDescription: c.metaDescription || '',
        metaKeywords: Array.isArray(c.metaKeywords) ? c.metaKeywords.join(', ') : (c.metaKeywords || ''),
        canonicalUrl: c.canonicalUrl || '',
        notes: c.notes || '',
      };
      currentImages = {
        logo: c.logo?.url,
        featured: c.featuredImage?.url,
        banner: c.bannerImage?.url,
      };
    }
  } catch {
    // fall through with null
  }

  const brandName = brand?.name || 'Brand';

  const breadcrumb = [
    { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
    { href: routes.eCommerce.brands, name: 'Brands' },
    { name: brandName },
  ];

  return (
    <>
      <PageHeader title={`Edit: ${brandName}`} breadcrumb={breadcrumb} />
      <CreateBrand
        id={id}
        brand={brand}
        currentImages={currentImages}
        isModalView={false}
      />
    </>
  );
}
