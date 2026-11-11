// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PhoneScanner } from './phone-scanner';

const decode = vi.hoisted(() => vi.fn<(file: File, showImage: boolean) => Promise<string>>());
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    scanFile = decode;
    clear() {}
  },
  Html5QrcodeSupportedFormats: { EAN_13: 1, EAN_8: 2, UPC_A: 3, UPC_E: 4, CODE_128: 5, CODE_39: 6 },
}));

const stop = vi.fn();
const applyConstraints = vi.fn(async () => {});
const getUserMedia = vi.fn(async () => ({
  getTracks: () => [{ stop }],
  getVideoTracks: () => [{
    stop, applyConstraints, getCapabilities: () => ({ torch: true, zoom: { min: 1, max: 3 } }),
  }],
}));
const drawImage = vi.fn();

beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(640);
  vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(480);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['frame'])));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  decode.mockReset();
});

it('decodes a frame only on tap and keeps the same preview open across bottles', async () => {
  decode.mockResolvedValueOnce('490187700713').mockResolvedValueOnce('490187700714');
  const onScan = vi.fn();
  render(<PhoneScanner onScan={onScan} />);
  expect(getUserMedia).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
  const capture = await screen.findByRole('button', { name: 'Capture' });
  expect(decode).not.toHaveBeenCalled();

  fireEvent.click(capture);
  expect(drawImage).toHaveBeenCalledOnce();
  await waitFor(() => expect(onScan).toHaveBeenCalledExactlyOnceWith('490187700713'));
  fireEvent.click(capture);
  await waitFor(() => expect(onScan).toHaveBeenNthCalledWith(2, '490187700714'));
  expect(drawImage).toHaveBeenCalledTimes(2);
  expect(getUserMedia).toHaveBeenCalledOnce();
  expect(stop).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Stop camera' }));
  expect(stop).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', { name: 'Capture' })).toBeNull();
});

it('shows a failed read and allows another capture without reopening the camera', async () => {
  decode.mockRejectedValueOnce(new Error('Barcode missing')).mockResolvedValueOnce('490187700714');
  const onScan = vi.fn();
  render(<PhoneScanner onScan={onScan} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
  const capture = await screen.findByRole('button', { name: 'Capture' });
  fireEvent.click(capture);
  expect((await screen.findByRole('alert')).textContent).toMatch(/try again/i);
  expect(onScan).not.toHaveBeenCalled();
  fireEvent.click(capture);
  await waitFor(() => expect(onScan).toHaveBeenCalledExactlyOnceWith('490187700714'));
  expect(stop).not.toHaveBeenCalled();
});

it('does not submit an in-flight decode after the shopper stops the camera', async () => {
  let resolveRead: (code: string) => void = () => {};
  decode.mockReturnValueOnce(new Promise((resolve) => { resolveRead = resolve; }));
  const onScan = vi.fn();
  render(<PhoneScanner onScan={onScan} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Capture' }));
  await waitFor(() => expect(decode).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button', { name: 'Stop camera' }));
  await act(async () => resolveRead('490187700713'));
  expect(onScan).not.toHaveBeenCalled();
});

it('uses available torch and zoom capabilities', async () => {
  render(<PhoneScanner onScan={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Toggle torch' }));
  fireEvent.change(screen.getByRole('slider', { name: 'Zoom' }), { target: { value: '2.5' } });
  await waitFor(() => {
    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 2.5 }] });
  });
});

it('accepts a manually typed barcode without camera permission', () => {
  const onScan = vi.fn();
  render(<PhoneScanner onScan={onScan} />);
  fireEvent.click(screen.getByRole('button', { name: 'Type barcode' }));
  const input = screen.getByLabelText('Barcode');
  fireEvent.change(input, { target: { value: '490187700713' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check price' }));
  expect(onScan).toHaveBeenCalledExactlyOnceWith('490187700713');
  expect(getUserMedia).not.toHaveBeenCalled();
});
