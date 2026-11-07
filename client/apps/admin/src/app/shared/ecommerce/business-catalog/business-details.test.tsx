import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import BusinessDetails from './business-details';

describe('business detail sections', () => {
  it('renders home dimensions and finishes without alcohol details', () => {
    const html = renderToStaticMarkup(
      <BusinessDetails
        product={{ type: 'home_furniture', abv: 40 }}
        sizes={[
          {
            displayName: 'Queen',
            colorName: 'Oak',
            dimensions: { length: 200, width: 150 },
          },
        ]}
      />
    );
    expect(html).toContain('Sizes &amp; finishes');
    expect(html).toContain('Oak');
    expect(html).toContain('length: 200');
    expect(html).not.toContain('ABV');
  });
  it('renders beauty shades and recorded shelf life', () => {
    const html = renderToStaticMarkup(
      <BusinessDetails
        product={{ type: 'beauty_makeup' }}
        sizes={[
          { displayName: '30 ml', colorName: 'Warm beige', shelfLifeDays: 365 },
        ]}
      />
    );
    expect(html).toContain('Shades &amp; pack sizes');
    expect(html).toContain('Warm beige');
    expect(html).toContain('365');
  });
  it.each([
    'electronics_laptop',
    'foodservice_produce',
    'hospitality_linen',
    'fashion_shirt',
  ])('renders an honest empty state for %s', (type) => {
    const html = renderToStaticMarkup(<BusinessDetails product={{ type }} />);
    expect(html).toContain('No options recorded yet.');
    expect(html).toContain('Not recorded');
    expect(html).not.toContain('ABV');
  });
});

it('shows recorded bottle volume, case quantity and venue serving units', () => {
  const html = renderToStaticMarkup(
    <BusinessDetails
      product={{ type: 'champagne' }}
      sizes={[
        { displayName: 'Case', volumeMl: 750, unitsPerPack: 6 },
        {
          displayName: 'Glass',
          volumeMl: 150,
          venueServing: { saleUnit: 'glass', mode: 'pour' },
        },
      ]}
    />
  );
  expect(html).toContain('750 ml');
  expect(html).toContain('6 units per pack');
  expect(html).toContain('150 ml');
  expect(html).toContain('glass');
});

it('shows procurement measurements and minimum order for a recorded variant', () => {
  const html = renderToStaticMarkup(
    <BusinessDetails
      product={{ type: 'foodservice_equipment' }}
      sizes={[
        {
          _id: 'pack',
          weightGrams: 2000,
          unitsPerPack: 12,
          minOrderQuantity: 3,
        },
      ]}
    />
  );
  expect(html).toContain('2000 g');
  expect(html).toContain('12 units per pack');
  expect(html).toContain('Minimum order: 3');
});

it('renders only catalog facts when the listing owns the option display', () => {
  const html = renderToStaticMarkup(
    <BusinessDetails
      product={{
        type: 'electronics_laptop',
        specifications: {
          memory: '16 GB',
          shade: 'Unrelated shade',
        },
      }}
      showVariants={false}
      sizes={[{ displayName: 'Option display' }]}
    />
  );
  expect(html).toContain('16 GB');
  expect(html).not.toContain('Unrelated shade');
  expect(html).not.toContain('Option display');
});
