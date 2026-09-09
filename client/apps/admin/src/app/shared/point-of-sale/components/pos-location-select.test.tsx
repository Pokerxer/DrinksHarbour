import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import POSLocationSelect from './pos-location-select';

test('new terminals require a stock location and explain the selling boundary', () => {
  const html = renderToStaticMarkup(<POSLocationSelect token="test" value="" onChange={() => {}} />);
  expect(html).toContain('required');
  expect(html).toContain('Select a location');
  expect(html).toContain('only displays and sells stock from this location');
  expect(html).not.toContain('aggregate');
});
