'use client';
import { Button } from 'rizzui';
export default function BannerSaveBar({
  title,
  hasUnsavedChanges,
  submitting,
  isEdit,
  onCancel,
}: {
  title?: string;
  hasUnsavedChanges: boolean;
  submitting: boolean;
  isEdit: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(16,24,40,0.06)] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <div className="hidden min-w-0 flex-1 sm:block">
          <p className="truncate text-sm text-gray-500">
            {title || 'Untitled banner'}
          </p>
          {hasUnsavedChanges ? (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              Unsaved
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Saved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:ms-auto">
          <Button variant="outline" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={submitting}
            className="border-0 bg-[#b20202] text-white hover:bg-[#9f0101]"
          >
            {isEdit ? 'Update Banner' : 'Create Banner'}
          </Button>
        </div>
      </div>
    </div>
  );
}
