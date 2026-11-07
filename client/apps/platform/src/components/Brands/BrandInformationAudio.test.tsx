import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import DescriptionAudio from '@/components/UI/DescriptionAudio';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/lib/fetchWithAuth', () => ({ fetchWithAuth: request }));
vi.mock('@/lib/api', () => ({ API_URL: 'https://api.example.test' }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); request.mockReset(); });

it('reads brand prose only on click and cancels playback when leaving the page', async () => {
  const pause = vi.fn();
  class AudioStub extends EventTarget {
    pause = pause;
    play = vi.fn(async () => {});
  }
  vi.stubGlobal('Audio', AudioStub);
  vi.stubGlobal('URL', Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:brand'), revokeObjectURL: vi.fn(),
  }));
  request.mockResolvedValue({ ok: true, blob: async () => new Blob(['audio']) });
  const view = render(<DescriptionAudio subject="brand information"
    description="<p>About the house &amp; its craft.</p><p>Our story. Founded in Scotland.</p>" />);
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Listen to brand information' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Reading brand information'));
  expect(JSON.parse(request.mock.calls[0][1].body).text).toBe('About the house & its craft. Our story. Founded in Scotland.');
  const signal = request.mock.calls[0][1].signal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  expect(pause).toHaveBeenCalled();
});

it('offers retry when brand audio generation fails', async () => {
  request.mockResolvedValue({ ok: false });
  render(<DescriptionAudio subject="brand information" description="The house and its history." />);
  fireEvent.click(screen.getByRole('button', { name: 'Listen to brand information' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not read the brand information'));
  expect(screen.getByRole('button', { name: 'Listen to brand information' })).toBeTruthy();
});
