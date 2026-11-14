// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import PairingForm from './pairing-form';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { token: 'test-token' },
    status: 'authenticated',
  }),
}));

vi.mock('@/services/merchandisingPairing.service', () => ({
  merchandisingPairingService: {
    list: vi.fn().mockResolvedValue({ success: true, data: [] }),
    upsert: vi.fn().mockResolvedValue({ success: true }),
    remove: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@/services/product.service', () => ({
  productService: {
    getProducts: vi.fn().mockResolvedValue({
      success: true,
      data: {
        products: [
          {
            _id: '507f1f77bcf86cd799439012',
            name: 'Jameson 700ml',
            slug: 'jameson-700ml',
            type: 'spirit',
          },
          {
            _id: '507f1f77bcf86cd799439013',
            name: 'Tonic Water',
            slug: 'tonic-water',
            type: 'soft-drink',
          },
          {
            _id: '507f1f77bcf86cd799439014',
            name: 'Cola Bottle',
            slug: 'cola-bottle',
            type: 'soft-drink',
          },
          {
            _id: '507f1f77bcf86cd799439015',
            name: 'Ginger Beer',
            slug: 'ginger-beer',
            type: 'beer',
          },
        ],
      },
    }),
  },
}));

afterEach(cleanup);

// Open the picker, run a server search, pick a product by name.
async function searchAndPick(
  label: RegExp,
  placeholder: string,
  term: string,
  name: string
) {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.change(screen.getByPlaceholderText(placeholder), {
    target: { value: term },
  });
  fireEvent.click(await screen.findByText(name));
}

describe('PairingForm', () => {
  beforeEach(() => {
    push.mockClear();
  });

  it('requires a source product and 1–4 suggestions before saving', async () => {
    render(<PairingForm />);
    const save = screen.getByRole('button', { name: /save/i });
    expect((save as HTMLButtonElement).disabled).toBe(true);

    await searchAndPick(
      /when shoppers view/i,
      'When shoppers view…',
      'Jameson',
      'Jameson 700ml'
    );
    // Source alone is not enough.
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: /save/i }) as HTMLButtonElement)
          .disabled
      ).toBe(true)
    );

    await searchAndPick(
      /suggest/i,
      'Suggest products…',
      'Tonic',
      'Tonic Water'
    );

    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: /save/i }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    );
  });

  it('saves the upsert with product ids and returns to the list', async () => {
    const { merchandisingPairingService } = await import(
      '@/services/merchandisingPairing.service'
    );
    render(<PairingForm />);

    await searchAndPick(
      /when shoppers view/i,
      'When shoppers view…',
      'Jameson',
      'Jameson 700ml'
    );
    await searchAndPick(
      /suggest/i,
      'Suggest products…',
      'Tonic',
      'Tonic Water'
    );

    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: /save/i }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    );
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(merchandisingPairingService.upsert).toHaveBeenCalledWith(
        'test-token',
        {
          sourceProduct: '507f1f77bcf86cd799439012',
          suggestedProducts: ['507f1f77bcf86cd799439013'],
          active: true,
        }
      );
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/merchandising'));
  });

  it('allows up to 4 suggestions and shows the cap message beyond it', async () => {
    render(<PairingForm />);

    const picks = [
      'Jameson 700ml',
      'Tonic Water',
      'Cola Bottle',
      'Ginger Beer',
    ];
    for (const name of picks) {
      fireEvent.click(screen.getByLabelText(/suggest/i));
      fireEvent.change(screen.getByPlaceholderText('Suggest products…'), {
        target: { value: 'search' },
      });
      fireEvent.click(await screen.findByText(name));
    }

    expect(
      await screen.findByText(/maximum of 4 suggestions/i)
    ).toBeTruthy();
  });
});
