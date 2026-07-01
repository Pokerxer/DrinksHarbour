export type FilterFieldType = 'text' | 'select' | 'multi-select' | 'date' | 'date-range' | 'number' | 'number-range' | 'boolean';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  id: string;
  label: string;
  field: string;
  type: FilterFieldType;
  category: string;
  options?: FilterOption[];
  placeholder?: string;
}

export interface FilterValue {
  fieldId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in' | 'is_set';
  value: string | number | boolean | [string, string] | string[];
  label: string;
}

export interface DatePreset {
  id: string;
  label: string;
  getRange: () => [Date, Date] | null;
}

export interface GroupByOption {
  id: string;
  label: string;
  subOptions?: GroupByOption[];
  field: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  filters: FilterValue[];
  groupBy: string;
  groupBySubOption?: string;
  search: string;
}

export interface CustomGroup {
  id: string;
  label: string;
  field: string;
  values: string[];
}

export type FilterCategory =
  | 'general'
  | 'dates'
  | 'customer'
  | 'pricing'
  | 'delivery'
  | 'status'
  | 'sales'
  | 'other';
