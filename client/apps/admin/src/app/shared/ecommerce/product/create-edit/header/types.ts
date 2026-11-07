export interface ProductHeaderMetrics {
  onHand: number;
  price: number;
  variants: number;
  sold: number | null;
}
export interface ProductEditHeaderProps {
  title: string;
  isEditMode: boolean;
  status?: string;
  /** Catalogue publication scope (constants/catalogScope.js). Legacy rows are undefined. */
  publicationScope?: string | null;
  /** Populated only when the detail endpoint resolves the owning tenant's name. */
  owningTenantName?: string | null;
  saving: boolean;
  generating: boolean;
  canGenerate: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  dirty: boolean;
  lastDraftSaved?: Date | null;
  metrics: ProductHeaderMetrics;
  index: number;
  total: number;
  searchContext?: string;
  onBack: () => void;
  onNew: () => void;
  onSave: () => void;
  onGenerate: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onPreview?: () => void;
  onVariants: () => void;
  onOnHand: () => void;
  onSold: () => void;
}
