// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import ConversationPanel from './conversation-panel';

const state = vi.hoisted(() => ({ history: vi.fn() }));
vi.mock('@/services/occasionRequest.service', () => ({
  occasionRequestService: { history: state.history },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

type Row = { _id: string; sender: 'customer' | 'staff'; content: string; createdAt: string };
const at = (minute: number) => new Date(Date.parse('2026-11-09T10:00:00Z') + minute * 60000).toISOString();

function start(stored: Row[]) {
  let tick: () => void = () => {};
  const originalSetInterval = globalThis.setInterval, originalClearInterval = globalThis.clearInterval;
  vi.stubGlobal('setInterval', (callback: () => void, ms: number) => { if (ms === 10000) tick = callback; return 0 as unknown as ReturnType<typeof setInterval>; });
  vi.stubGlobal('clearInterval', (() => {}) as unknown as typeof clearInterval);
  Object.defineProperty(document, 'hidden', { value: false });
  render(<ConversationPanel id="req1" token="staff-token" revision={0} />);
  const restore = async () => {
    await cleanup();
    vi.stubGlobal('setInterval', originalSetInterval);
    vi.stubGlobal('clearInterval', originalClearInterval);
  };
  return { tick, restore };
}

test('the staff panel polls incrementally past the last server id and falls back cleanly', async () => {
  const stored: Row[] = [
    { _id: '0001', sender: 'customer', content: 'Please include non-alcoholic choices.', createdAt: at(0) },
  ];
  state.history.mockImplementation((_token: string, _id: string, cursor = '') => {
    const after = cursor.startsWith('after=') ? cursor.slice('after='.length) : null;
    return Promise.resolve({
      messages: after ? stored.filter(row => row._id.localeCompare(after) > 0) : stored.slice(-30),
      olderCursor: null,
    });
  });
  const boot = start(stored);
  try {
    await screen.findByText('Please include non-alcoholic choices.');
    const cursorsOf = () => state.history.mock.calls.map((call: unknown[]) => (call[2] ?? '') as string);
    expect(state.history).toHaveBeenCalledTimes(1);
    expect(cursorsOf()[0]).toBe('');
    state.history.mockClear();
    stored.push({ _id: '0002', sender: 'staff', content: 'Our reviewed plan includes juice and wine.', createdAt: at(2) });
    await act(async () => boot.tick());
    expect(cursorsOf()).toEqual(['after=0001']);
    const log = await screen.findByRole('log');
    expect(log.textContent).toContain('Our reviewed plan includes juice and wine.');
    // Tick with nothing new leaves the cursor on the newest merged id.
    state.history.mockClear();
    await act(async () => boot.tick());
    expect(cursorsOf()).toEqual(['after=0002']);
    // An unclear response (ids at-or-before the cursor echoed back) degrades to a full read.
    state.history.mockClear();
    state.history.mockImplementationOnce(() => Promise.resolve({ messages: [...stored], olderCursor: null }));
    await act(async () => boot.tick());
    expect(cursorsOf()).toEqual(['after=0002', '']);
  } finally {
    await boot.restore();
  }
});

test('earlier messages page with the before cursor and merge above the newer thread', async () => {
  const oldest: Row = { _id: '0000', sender: 'customer', content: 'Oldest note.', createdAt: at(-5) };
  const stored: Row[] = [{ _id: '0001', sender: 'customer', content: 'Newest note.', createdAt: at(0) }];
  state.history.mockImplementation((_token: string, _id: string, cursor = '') => {
    if (cursor.startsWith('before=')) return Promise.resolve({ messages: [oldest], olderCursor: null });
    return Promise.resolve({ messages: stored, olderCursor: '0001' });
  });
  const boot = start(stored);
  try {
    await screen.findByText('Newest note.');
    expect((await screen.findByText('Load earlier messages')).textContent).toBe('Load earlier messages');
    await act(async () => { fireEvent.click(screen.getByText('Load earlier messages')); });
    const log = await screen.findByRole('log');
    expect(log.textContent).toContain('Oldest note.');
    expect(log.textContent).toContain('Newest note.');
    expect(state.history).toHaveBeenCalledWith('staff-token', 'req1', 'before=0001');
  } finally {
    await boot.restore();
  }
});
