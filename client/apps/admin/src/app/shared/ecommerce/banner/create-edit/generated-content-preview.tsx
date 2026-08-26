// @ts-nocheck
'use client';

/**
 * Preview card(s) for AI-generated banner content — single result or a list of
 * suggestion options with mini banner renders and an Apply action each.
 */

import { Button } from 'rizzui';
import { PiSparkleBold, PiX } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import {
  POSITION_GRID_CLS,
  CTA_STYLE_STATIC_CLS,
} from '@/app/shared/ecommerce/banner/banner-shared';

export function GeneratedContentPreview({
  content,
  onApply,
  onClose,
}: {
  content: any | any[];
  onApply?: (content: any) => void;
  onClose?: () => void;
}) {
  const isArray = Array.isArray(content);
  const items = isArray ? content : [content];

  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-purple-700">
          <PiSparkleBold className="h-4 w-4" />
          {isArray ? `${items.length} Generated Options` : 'Generated Content'}
        </h4>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <PiX className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className={cn('space-y-3', isArray && 'max-h-80 overflow-y-auto')}>
        {items.map((item, index) => (
          <div
            key={index}
            className="relative rounded-lg border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            {/* Mini banner preview with content position + CTA style */}
            <div
              className="relative mb-3 flex h-24 overflow-hidden rounded-lg p-3"
              style={{ backgroundColor: item.backgroundColor || '#1a1a2e' }}
            >
              <div
                className={cn(
                  'flex flex-col gap-0.5',
                  POSITION_GRID_CLS[item.contentPosition] ||
                    POSITION_GRID_CLS.center
                )}
              >
                <p
                  className="text-sm font-bold leading-tight drop-shadow"
                  style={{ color: item.textColor || '#fff' }}
                >
                  {item.title || 'Title'}
                </p>
                <p
                  className="text-xs leading-tight opacity-80 drop-shadow"
                  style={{ color: item.textColor || '#fff' }}
                >
                  {item.subtitle || 'Subtitle'}
                </p>
                {item.ctaText && (
                  <span
                    className={cn(
                      'mt-1 inline-flex w-fit items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold',
                      CTA_STYLE_STATIC_CLS[item.ctaStyle] ||
                        CTA_STYLE_STATIC_CLS.primary
                    )}
                  >
                    {item.ctaText}
                  </span>
                )}
              </div>
            </div>

            {/* Content details */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                  {item.styleNote
                    ?.replace('Demo content generated with ', '')
                    .replace(' style', '') || 'Generated'}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-900">{item.title}</p>
              <p className="line-clamp-2 text-xs text-gray-500">{item.subtitle}</p>
              <div className="flex items-center gap-2 border-t border-gray-100 pt-2">
                <span className="text-xs text-gray-500">CTA:</span>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {item.ctaText || 'Shop Now'}
                </span>
              </div>

              {/* AI-picked options — shown so the admin sees what the model chose */}
              {(item.type ||
                item.placement ||
                item.ctaStyle ||
                item.contentPosition ||
                item.textAlignment) && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  {[
                    item.type && ['Type', item.type],
                    item.placement && [
                      'Placement',
                      item.placement.replace(/_/g, ' '),
                    ],
                    item.ctaStyle && ['CTA style', item.ctaStyle],
                    item.contentPosition && [
                      'Position',
                      item.contentPosition.replace(/-/g, ' '),
                    ],
                    item.textAlignment && ['Align', item.textAlignment],
                  ]
                    .filter(Boolean)
                    .map(([label, value]: any) => (
                      <span
                        key={label}
                        className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium capitalize text-indigo-600"
                      >
                        {label}: {value}
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Apply */}
            {onApply && (
              <Button
                size="sm"
                onClick={() => onApply(item)}
                className="absolute bottom-3 right-3 bg-purple-600 hover:bg-purple-700"
              >
                Apply
              </Button>
            )}
          </div>
        ))}
      </div>

      {isArray && onApply && (
        <div className="mt-4 flex items-center justify-between border-t border-purple-200 pt-4">
          <p className="text-xs text-gray-500">
            Select one option to apply to your banner
          </p>
        </div>
      )}
    </div>
  );
}
