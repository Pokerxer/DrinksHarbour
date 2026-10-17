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
