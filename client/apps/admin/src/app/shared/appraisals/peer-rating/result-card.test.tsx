// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ResultCard from './result-card';
afterEach(cleanup);
it('shows only the released score and calculated bonus', () => {
  render(
    <ResultCard
      result={{
        averageScore: 4,
        ratingCount: 3,
        allocationMinor: 5000000,
        bonusMinor: 4000000,
        currency: 'NGN',
      }}
    />
  );
  expect(screen.getByText('4.00 / 5')).toBeTruthy();
  expect(screen.getByText(/40,000.00/)).toBeTruthy();
  expect(screen.getByText(/3 colleague ratings/)).toBeTruthy();
});
