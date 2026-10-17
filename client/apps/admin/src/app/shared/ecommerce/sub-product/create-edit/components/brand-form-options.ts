export const fieldVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.3 },
  }),
};

export interface BrandFormData {
  name: string;
  description: string;
  countryOfOrigin: string;
  founded: string;
  primaryCategory: string;
}

export const BRAND_CATEGORIES = [
  { value: 'spirits', label: 'Spirits' },
  { value: 'beer', label: 'Beer' },
  { value: 'wine', label: 'Wine' },
  { value: 'non_alcoholic', label: 'Non-Alcoholic' },
  { value: 'other', label: 'Other' },
];

export const COUNTRIES = [
  { value: 'Ireland', label: 'Ireland' },
  { value: 'Scotland', label: 'Scotland' },
  { value: 'United States', label: 'United States' },
  { value: 'France', label: 'France' },
  { value: 'Italy', label: 'Italy' },
  { value: 'Spain', label: 'Spain' },
  { value: 'Sweden', label: 'Sweden' },
  { value: 'Russia', label: 'Russia' },
  { value: 'Mexico', label: 'Mexico' },
  { value: 'Japan', label: 'Japan' },
  { value: 'Canada', label: 'Canada' },
  { value: 'South Africa', label: 'South Africa' },
  { value: 'Australia', label: 'Australia' },
  { value: 'Netherlands', label: 'Netherlands' },
  { value: 'Germany', label: 'Germany' },
  { value: 'Puerto Rico', label: 'Puerto Rico' },
  { value: 'Other', label: 'Other' },
];
