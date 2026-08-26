// @ts-nocheck
'use client';

/**
 * Placement metadata + mini page schematics.
 * `PLACEMENT_PREVIEW` maps each placement to its storefront aspect ratio,
 * layout family and a human label; `PlacementThumb` sketches the page with
 * the banner slot highlighted (used in the form and the AI generator).
 */

import cn from '@core/utils/class-names';

export const PLACEMENT_PREVIEW: Record<
  string,
  {
    aspect: string;
    label: string;
    layout: 'hero' | 'compact' | 'footer' | 'sidebar' | 'bar' | 'modal';
  }
> = {
  home_hero: {
    aspect: 'aspect-[21/9]',
    label: 'Home Hero — full-width carousel',
    layout: 'hero',
  },
  home_secondary: {
    aspect: 'aspect-[3/1]',
    label: 'Home Secondary — promotional strip',
    layout: 'hero',
  },
  category_top: {
    aspect: 'aspect-[21/9]',
    label: 'Category Top — wide banner',
    layout: 'hero',
  },
  product_page: {
    aspect: 'aspect-[21/9]',
    label: 'Product Page — hero banner',
    layout: 'hero',
  },
  checkout: {
    aspect: 'auto',
    label: 'Checkout — compact inline strip',
    layout: 'compact',
  },
  sidebar: {
    aspect: 'aspect-[3/4]',
    label: 'Sidebar — vertical card',
    layout: 'sidebar',
  },
  footer: { aspect: 'auto', label: 'Footer — promo strip', layout: 'footer' },
  popup: {
    aspect: 'aspect-[4/3]',
    label: 'Popup — modal overlay',
    layout: 'modal',
  },
  header: {
    aspect: 'auto',
    label: 'Header — thin announcement bar',
    layout: 'bar',
  },
};

/** Recommended type for each placement (for hint badges + AI defaults). */
export const PLACEMENT_TYPE_HINT: Record<string, string> = {
  home_hero: 'hero',
  home_secondary: 'promotional',
  category_top: 'category',
  product_page: 'product',
  checkout: 'promotional',
  sidebar: 'promotional',
  footer: 'promotional',
  popup: 'announcement',
  header: 'announcement',
};

export function PlacementThumb({
  placement,
  selected,
}: {
  placement: string;
  selected: boolean;
}) {
  const b = cn(
    'rounded-[2px]',
    selected ? 'bg-purple-500' : 'bg-purple-400/70'
  );
  const g = 'rounded-[2px] bg-gray-200';

  const body = (() => {
    switch (placement) {
      case 'home_hero':
        return (
          <>
            <div className={cn(g, 'h-1.5 flex-none')} />
            <div className={cn(b, 'flex-1')} />
            <div className="grid flex-none grid-cols-3 gap-0.5">
              <div className={cn(g, 'h-3')} />
              <div className={cn(g, 'h-3')} />
              <div className={cn(g, 'h-3')} />
            </div>
          </>
        );
      case 'home_secondary':
        return (
          <>
            <div className={cn(g, 'h-1.5 flex-none')} />
            <div className={cn(g, 'h-4 flex-none')} />
            <div className={cn(b, 'h-2.5 flex-none')} />
            <div className="grid flex-1 grid-cols-3 gap-0.5">
              <div className={g} />
              <div className={g} />
              <div className={g} />
            </div>
          </>
        );
      case 'category_top':
        return (
          <>
            <div className={cn(g, 'h-1.5 flex-none')} />
            <div className={cn(b, 'h-4 flex-none')} />
            <div className="grid flex-1 grid-cols-4 gap-0.5">
              <div className={g} />
              <div className={g} />
              <div className={g} />
              <div className={g} />
            </div>
          </>
        );
      case 'product_page':
        return (
          <>
            <div className={cn(g, 'h-1.5 flex-none')} />
            <div className={cn(b, 'h-3.5 flex-none')} />
            <div className="flex flex-1 gap-0.5">
              <div className={cn(g, 'w-1/3')} />
              <div className="flex flex-1 flex-col gap-0.5">
                <div className={cn(g, 'h-1.5 w-3/4')} />
                <div className={cn(g, 'h-1.5')} />
                <div className={cn(g, 'h-1.5 w-1/2')} />
              </div>
            </div>
          </>
        );
      case 'checkout':
        return (
          <>
            <div className={cn(g, 'h-1.5 flex-none')} />
            <div className={cn(g, 'h-1.5 w-2/3 flex-none')} />
            <div className={cn(g, 'h-1.5 w-3/4 flex-none')} />
            <div className={cn(b, 'h-2.5 flex-none')} />
            <div className="flex flex-1 items-end justify-end">
              <div className="h-2 w-1/3 rounded-[2px] bg-gray-300" />
            </div>
          </>
        );
      case 'sidebar':
        return (
          <>
            <div className={cn(g, 'h-1.5 flex-none')} />
            <div className="flex flex-1 gap-0.5">
              <div className="flex flex-1 flex-col gap-0.5">
                <div className={cn(g, 'flex-1')} />
                <div className={cn(g, 'h-1.5 w-2/3 flex-none')} />
              </div>
              <div className={cn(b, 'w-1/4')} />
            </div>
          </>
        );
      case 'footer':
        return (
          <>
            <div className={cn(g, 'h-1.5 flex-none')} />
            <div className="grid flex-1 grid-cols-3 gap-0.5">
              <div className={g} />
              <div className={g} />
              <div className={g} />
            </div>
            <div className={cn(b, 'h-2.5 flex-none')} />
          </>
        );
      case 'popup':
        return (
          <>
            <div className="flex h-full flex-col gap-0.5 opacity-40">
              <div className={cn(g, 'h-1.5 flex-none')} />
              <div className="grid flex-1 grid-cols-3 gap-0.5">
                <div className={g} />
                <div className={g} />
                <div className={g} />
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={cn(b, 'h-3/5 w-3/5 rounded shadow-sm')} />
            </div>
          </>
        );
      case 'header':
        return (
          <>
            <div className={cn(b, 'h-1.5 flex-none')} />
            <div className={cn(g, 'h-2 flex-none')} />
            <div className="grid flex-1 grid-cols-3 gap-0.5">
              <div className={g} />
              <div className={g} />
              <div className={g} />
            </div>
          </>
        );
      default:
        return <div className={cn(g, 'flex-1')} />;
    }
  })();

  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative mb-2 flex h-16 w-full flex-col gap-0.5 overflow-hidden rounded-md border p-1',
        selected ? 'border-purple-200 bg-white' : 'border-gray-100 bg-gray-50'
      )}
    >
      {body}
    </div>
  );
}
