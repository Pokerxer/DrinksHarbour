'use client';

import {
  PiArrowLeft,
  PiFloppyDisk,
  PiPlus,
  PiSparkle,
  PiSpinner,
} from 'react-icons/pi';
import ToolbarMenu, { type ToolbarMenuProps } from './toolbar-menu';
import ToolbarStats, { type ToolbarStatsProps } from './toolbar-stats';
import ToolbarNavigation, {
  type ToolbarNavigationProps,
} from './toolbar-navigation';

export interface SubProductToolbarProps {
  title: string;
  status: string;
  editing: boolean;
  dirty: boolean;
  busy: boolean;
  saving: boolean;
  loading?: boolean;
  generating: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
  onBack: () => void;
  onNew: () => void;
  onSave: () => void;
  onGenerate: () => void;
  menu: Omit<ToolbarMenuProps, 'disabled' | 'archived'>;
  stats: Omit<ToolbarStatsProps, 'disabled' | 'editing'>;
  navigation: Omit<ToolbarNavigationProps, 'disabled'>;
}

export default function SubProductToolbar(props: SubProductToolbarProps) {
  const statusClass =
    props.status === 'active'
      ? 'bg-green-50 text-green-700 ring-green-200'
      : props.status === 'archived'
        ? 'bg-amber-50 text-amber-800 ring-amber-200'
        : 'bg-gray-50 text-gray-600 ring-gray-200';
  const saveMessage = props.loading
    ? 'Loading product…'
    : props.saving
      ? 'Saving changes…'
      : props.saveStatus === 'error'
        ? 'Save failed — try again'
        : props.dirty
          ? 'Unsaved changes'
          : props.lastSaved
            ? `Saved at ${props.lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : props.editing
              ? 'All changes saved'
              : 'New product · not saved';
  const secondaryClass =
    'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <section aria-label="Sub-product toolbar" aria-busy={props.busy}>
      <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <button
            type="button"
            onClick={props.onBack}
            disabled={props.busy}
            aria-label="Back to sub-products"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:opacity-40"
          >
            <PiArrowLeft aria-hidden="true" className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 py-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="min-w-0 break-words text-base font-semibold leading-snug text-gray-900">
                {props.title}
              </h1>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${statusClass}`}
              >
                {props.editing ? props.status.replace(/_/g, ' ') : 'New'}
              </span>
            </div>
            <p
              role="status"
              className={`mt-1 text-xs ${props.saveStatus === 'error' ? 'text-red-600' : props.dirty ? 'text-amber-700' : 'text-gray-500'}`}
            >
              {saveMessage}
            </p>
          </div>
        </div>
        <div
          role="group"
          aria-label="Product actions"
          className="flex shrink-0 flex-wrap items-center gap-2"
        >
          <button
            type="button"
            onClick={props.onNew}
            disabled={props.busy}
            className={`${secondaryClass} flex-1 lg:flex-none`}
          >
            <PiPlus aria-hidden="true" className="h-4 w-4" />
            New
          </button>
          <button
            type="button"
            onClick={props.onSave}
            disabled={props.busy}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 text-sm font-semibold text-white hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 lg:flex-none"
          >
            {props.saving ? (
              <PiSpinner aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <PiFloppyDisk aria-hidden="true" className="h-4 w-4" />
            )}
            {props.saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={props.onGenerate}
            disabled={props.busy}
            aria-label="Generate product content with AI"
            className={secondaryClass}
          >
            {props.generating ? (
              <PiSpinner aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <PiSparkle aria-hidden="true" className="h-4 w-4" />
            )}
            <span>AI</span>
          </button>
          {props.editing && (
            <ToolbarMenu
              {...props.menu}
              archived={props.status === 'archived'}
              disabled={props.busy}
            />
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-col border-t border-gray-100 lg:flex-row lg:items-center lg:justify-between">
        <ToolbarStats
          {...props.stats}
          editing={props.editing}
          disabled={props.busy}
        />
        {props.editing &&
          props.navigation.count > 1 &&
          props.navigation.index >= 0 && (
            <div className="flex justify-end border-t border-gray-100 px-4 sm:px-6 lg:border-0">
              <ToolbarNavigation {...props.navigation} disabled={props.busy} />
            </div>
          )}
      </div>
    </section>
  );
}
