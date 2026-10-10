'use client';
import { Button } from 'rizzui';
import { PiSparkleBold } from 'react-icons/pi';
export function BannerFormLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-100" />
        <div className="flex gap-2">
          <div className="h-9 w-28 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-9 w-28 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-9 w-32 animate-pulse rounded-lg bg-gray-100" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-gray-100"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    </div>
  );
}
export function BannerFormHeader({
  isEdit,
  hasUnsavedChanges,
  submitting,
  onGenerate,
  onCancel,
}: {
  isEdit: boolean;
  hasUnsavedChanges: boolean;
  submitting: boolean;
  onGenerate: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          {isEdit ? 'Edit Banner' : 'Create New Banner'}
        </h2>
        {hasUnsavedChanges ? (
          <span className="mt-1 flex items-center gap-1.5 text-sm text-amber-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            Unsaved changes
          </span>
        ) : isEdit ? (
          <span className="mt-1 flex items-center gap-1.5 text-sm text-gray-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            All changes saved
          </span>
        ) : (
          <p className="mt-1 text-sm text-gray-400">
            Fill in the details below to create a banner
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={onGenerate}
          type="button"
          className="border-purple-200 text-purple-600 hover:bg-purple-50"
        >
          <PiSparkleBold className="mr-2 h-4 w-4" />
          AI Generate
        </Button>
        <Button variant="outline" onClick={onCancel} type="button">
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
  );
}
