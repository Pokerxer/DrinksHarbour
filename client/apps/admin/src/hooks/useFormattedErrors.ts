import { useMemo } from 'react';
import { UseFormReturn, useFormState } from 'react-hook-form';
import {
  formatZodErrors,
  FormattedError,
  getFieldError,
  getNestedFieldError,
  formatErrorForToast,
} from '../utils/format-zod-errors';

export interface UseFormattedErrorsOptions {
  enabled?: boolean;
}

export interface UseFormattedErrorsReturn {
  formattedErrors: FormattedError;
  hasErrors: boolean;
  errorCount: number;
  errorSummary: string;
  getFieldError: (fieldPath: string) => string | undefined;
  getError: (...segments: (string | number)[]) => string | undefined;
  getArrayFieldError: (
    arrayPath: string,
    index: number,
    fieldName: string
  ) => string | undefined;
  formatForToast: () => string;
  errorsBySection: Record<string, { field: string; message: string }[]>;
}

export function useFormattedErrors<T extends Record<string, any>>(
  methods: UseFormReturn<T>,
  options: UseFormattedErrorsOptions = {}
): UseFormattedErrorsReturn {
  const { enabled = true } = options;

  const { errors } = useFormState({
    control: methods.control,
    disabled: !enabled,
  });

  const formattedErrors = useMemo(() => {
    if (!enabled) {
      return {
        errors: [],
        errorMap: new Map(),
        summary: '',
        hasErrors: false,
        errorCount: 0,
      };
    }

    if (!errors || Object.keys(errors).length === 0) {
      return {
        errors: [],
        errorMap: new Map(),
        summary: '',
        hasErrors: false,
        errorCount: 0,
      };
    }

    return formatZodErrors({ issues: flattenRhfErrors(errors) } as any);
  }, [errors, enabled]);

  const errorsBySection = useMemo(() => {
    const sections: Record<string, { field: string; message: string }[]> = {};

    formattedErrors.errors.forEach((err) => {
      const path = err.path;
      let section = 'General';

      if (path[0] === 'subProductData') {
        section = 'Sub-Product';
        if (path.length > 1) {
          const subField = path[1] as string;
          if (subField === 'newProductData') section = 'New Product';
          else if (subField === 'sizes') section = 'Sizes';
          else if (subField === 'shipping') section = 'Shipping';
          else if (subField === 'warehouse') section = 'Warehouse';
          else if (subField === 'flashSale') section = 'Flash Sale';
          else if (subField === 'bundleDeals') section = 'Bundle Deals';
        }
      } else if (path[0] === 'tastingNotes') {
        section = 'Tasting Notes';
      } else if (path[0] === 'servingSuggestions') {
        section = 'Serving Suggestions';
      } else if (['images', 'videos', 'uploadedImages'].includes(path[0] as string)) {
        section = 'Media';
      } else if (['metaTitle', 'metaDescription', 'metaKeywords'].includes(path[0] as string)) {
        section = 'SEO';
      }

      if (!sections[section]) {
        sections[section] = [];
      }
      sections[section].push({
        field: pathToFieldName(path),
        message: err.message,
      });
    });

    return sections;
  }, [formattedErrors]);

  return {
    formattedErrors,
    hasErrors: formattedErrors.hasErrors,
    errorCount: formattedErrors.errorCount,
    errorSummary: formattedErrors.summary,
    getFieldError: (fieldPath: string) => getFieldError(formattedErrors, fieldPath),
    getError: (...segments) => getNestedFieldError(formattedErrors, ...segments),
    getArrayFieldError: (
      arrayPath: string,
      index: number,
      fieldName: string
    ) => {
      const fullPath = `${arrayPath}.${index}.${fieldName}`;
      return getFieldError(formattedErrors, fullPath);
    },
    formatForToast: () => formatErrorForToast({ issues: flattenRhfErrors(errors) } as any),
    errorsBySection,
  };
}

function flattenRhfErrors(
  errors: Record<string, any>,
  prefix = ''
): Array<{ path: (string | number)[]; message: string; code: string }> {
  const issues: Array<{ path: (string | number)[]; message: string; code: string }> = [];

  for (const key in errors) {
    const error = errors[key];
    if (!error) continue;

    const currentPath = prefix ? `${prefix}.${key}` : key;
    const pathParts = currentPath.split('.');

    if (error.message) {
      issues.push({
        path: pathParts.map((p) => (isNaN(parseInt(p)) ? p : parseInt(p))),
        message: error.message,
        code: error.type || 'custom',
      });
    }

    if (error.type === 'array') {
      if (error.types) {
        for (const typeKey in error.types) {
          const typeError = error.types[typeKey];
          if (typeof typeError === 'string') {
            issues.push({
              path: [...pathParts, typeKey],
              message: typeError,
              code: 'custom',
            });
          }
        }
      }
    }

    if (typeof error === 'object' && error !== null && !error.message) {
      const nested = flattenRhfErrors(error, currentPath);
      issues.push(...nested);
    }
  }

  return issues;
}

function pathToFieldName(path: (string | number)[]): string {
  const displayNames: Record<string, string> = {
    name: 'Product Name',
    type: 'Product Type',
    subType: 'Sub-Type',
    isAlcoholic: 'Alcoholic',
    abv: 'ABV',
    volumeMl: 'Volume',
    originCountry: 'Origin Country',
    region: 'Region',
    brand: 'Brand',
    category: 'Category',
    subCategory: 'Sub-Category',
    tags: 'Tags',
    flavors: 'Flavors',
    flavorProfile: 'Flavor Profile',
    style: 'Style',
    shortDescription: 'Short Description',
    description: 'Description',
    price: 'Price',
    costPrice: 'Cost Price',
    sellingPrice: 'Selling Price',
    stock: 'Stock',
    size: 'Size',
    images: 'Images',
    metaTitle: 'Meta Title',
    metaDescription: 'Meta Description',
    product: 'Product',
    tenant: 'Tenant',
    newProductData: 'New Product',
    sizes: 'Sizes',
    shipping: 'Shipping',
    warehouse: 'Warehouse',
    discount: 'Discount',
    salePrice: 'Sale Price',
  };

  const lastSegment = path[path.length - 1];
  if (typeof lastSegment === 'number') {
    return `Item ${lastSegment + 1}`;
  }

  return displayNames[lastSegment] || lastSegment
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

export default useFormattedErrors;
