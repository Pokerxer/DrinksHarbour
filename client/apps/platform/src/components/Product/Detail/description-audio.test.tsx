import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductDescriptionAudio from './ProductDescriptionAudio';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/lib/fetchWithAuth', () => ({ fetchWithAuth: request }));
vi.mock('@/lib/api', () => ({ API_URL: 'https://api.example.test' }));

class TestAudio extends EventTarget {
  static instances: TestAudio[] = [];
  pause = vi.fn();
  play = vi.fn(async () => {});
  constructor(public src: string) { super(); TestAudio.instances.push(this); }
}
beforeEach(() => {
  request.mockReset().mockResolvedValue({ ok: true, blob: async () => new Blob(['audio']) });
  TestAudio.instances = [];
  vi.stubGlobal('Audio', TestAudio);
  vi.stubGlobal('URL', Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:description'), revokeObjectURL: vi.fn(),
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const listen = () => fireEvent.click(screen.getByRole('button', { name: 'Listen to description' }));
const payloads = () => request.mock.calls.map(call => JSON.parse(call[1].body).text);

test('reads the full HTML description in order beyond the server limit, excluding hidden markup', async () => {
  const paragraph = 'A premium drink with citrus notes and a smooth finish. '.repeat(120).trim();
  render(<ProductDescriptionAudio description={`<p>${paragraph}</p><script>hidden</script><p>Final &amp; complete.</p>`} shortDescription="Only a preview" />);
  listen();
  await waitFor(() => expect(TestAudio.instances).toHaveLength(1));
  for (let index = 0; index < 20; index++) {
    if (screen.queryByRole('button', { name: 'Listen to description' })) break;
    TestAudio.instances.at(-1)!.dispatchEvent(new Event('ended'));
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  await waitFor(() => expect(screen.getByRole('button', { name: 'Listen to description' })).toBeTruthy());
  expect(payloads().join(' ')).toBe(`${paragraph} Final & complete.`);
  expect(payloads().every(text => text.length >= 5 && text.length <= 5000)).toBe(true);
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(payloads().length);
});

test('generates a normal long description as one continuous recording instead of restarting the voice', async () => {
  const description = 'The house preserves its heritage and traditional craft. '.repeat(60).trim();
  render(<ProductDescriptionAudio description={description} />);
  listen();
  await waitFor(() => expect(TestAudio.instances).toHaveLength(1));
  expect(payloads()).toEqual([description]);
  TestAudio.instances[0].dispatchEvent(new Event('ended'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Listen to description' })).toBeTruthy());
  expect(request).toHaveBeenCalledTimes(1);
});

test('falls back to the short description and hides the control without content', async () => {
  const view = render(<ProductDescriptionAudio description="  " shortDescription="Short description." />);
  listen();
  await waitFor(() => expect(payloads()).toEqual(['Short description.']));
  view.rerender(<ProductDescriptionAudio />);
  expect(screen.queryByRole('button')).toBeNull();
  expect(TestAudio.instances[0].pause).toHaveBeenCalled();
});

test('stop aborts a pending request and prevents late playback', async () => {
  let resolveRequest!: (value: unknown) => void;
  request.mockImplementation(() => new Promise(resolve => { resolveRequest = resolve; }));
  render(<ProductDescriptionAudio description="A complete product description." />);
  listen();
  fireEvent.click(screen.getByRole('button', { name: 'Stop reading description' }));
  expect(request.mock.calls[0][1].signal.aborted).toBe(true);
  resolveRequest({ ok: true, blob: async () => new Blob(['late']) });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(TestAudio.instances).toHaveLength(0);
});

test('unmount stops playback and does not request the next chunk', async () => {
  const view = render(<ProductDescriptionAudio description={'A long description. '.repeat(40)} />);
  listen();
  await waitFor(() => expect(TestAudio.instances).toHaveLength(1));
  view.unmount();
  expect(TestAudio.instances[0].pause).toHaveBeenCalled();
  TestAudio.instances[0].dispatchEvent(new Event('ended'));
  expect(request).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1));
});

test('shows an error after generation failure and allows retry', async () => {
  request.mockResolvedValueOnce({ ok: false });
  render(<ProductDescriptionAudio description="A complete product description." />);
  listen();
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Please try again'));
  listen();
  await waitFor(() => expect(TestAudio.instances).toHaveLength(1));
});

test('explains an unreachable speech service and allows retry', async () => {
  request.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  render(<ProductDescriptionAudio description="A complete product description." />);
  listen();
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not connect to the audio service'));
  listen();
  await waitFor(() => expect(TestAudio.instances).toHaveLength(1));
});

test.each([
  [429, 'Too many audio requests'],
  [503, 'Audio is temporarily unavailable'],
])('explains speech service status %s without attempting playback', async (status, message) => {
  request.mockResolvedValueOnce({ ok: false, status });
  render(<ProductDescriptionAudio description="A complete product description." />);
  listen();
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(message));
  expect(TestAudio.instances).toHaveLength(0);
});

test('playback failure restores the control with an error', async () => {
  render(<ProductDescriptionAudio description="A complete product description." />);
  listen();
  await waitFor(() => expect(TestAudio.instances).toHaveLength(1));
  TestAudio.instances[0].dispatchEvent(new Event('error'));
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
});


test('changing products cancels the previous request before a new description can play', async () => {
  let resolveOld!: (value: unknown) => void;
  request.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  const view = render(<ProductDescriptionAudio description="Previous product description." />);
  listen();
  const oldSignal = request.mock.calls[0][1].signal;
  view.rerender(<ProductDescriptionAudio description="Next product description." />);
  expect(oldSignal.aborted).toBe(true);
  listen();
  await waitFor(() => expect(TestAudio.instances).toHaveLength(1));
  resolveOld({ ok: true, blob: async () => new Blob(['old']) });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(TestAudio.instances).toHaveLength(1);
  expect(payloads().at(-1)).toBe('Next product description.');
});

test.each(['Rum', 'x'.repeat(280) + ' end'])('sends valid short and tiny-tail requests without dropping content', async description => {
  render(<ProductDescriptionAudio description={description} />);
  listen();
  await waitFor(() => expect(TestAudio.instances).toHaveLength(1));
  expect(payloads()).toHaveLength(1);
  expect(payloads()[0]).toContain(description);
  expect(payloads()[0].length).toBeGreaterThanOrEqual(5);
  expect(payloads()[0].length).toBeLessThanOrEqual(300);
});

test('a rejected browser play attempt reports failure instead of remaining active', async () => {
  vi.stubGlobal('Audio', class extends TestAudio {
    play = vi.fn(async () => { throw new Error('Playback blocked'); });
  });
  render(<ProductDescriptionAudio description="A complete product description." />);
  listen();
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Listen to description' })).toBeTruthy();
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
});
