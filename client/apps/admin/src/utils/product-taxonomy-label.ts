import {
  productTypes,
  styles,
} from '@/app/shared/ecommerce/product/create-edit/form-utils';

/** Match catalog labels, preserving custom subtype names and acronyms. */
export function productTaxonomyLabel(value?: string | null): string {
  if (!value) return '';
  const option = [...productTypes, ...styles].find((item) => item.value === value);
  return (
    option?.label ??
    value.trim().split(/[_\s-]+/).filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  );
}
