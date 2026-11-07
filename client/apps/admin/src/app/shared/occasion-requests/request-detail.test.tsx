// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RequestDetail from './request-detail';
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: 'authenticated', data: { user: { role: 'admin', token: 'staff-token' } } }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const fixture = { _id: '507f1f77bcf86cd799439011', reference: 'DH-EVT-ONE', occasion: 'weddings', name: 'Ada', channel: 'email', email: 'ada@example.test', city: 'Abuja', notes: 'Wine and juice for300 guests', preferences: ['wine'], items: [], status: 'pending', createdAt: '2026-10-21T12:00:00Z', dueAt: '2026-10-21T12:30:00Z', draft: '', revision: 0 };
test('staff AI draft stays private until an approved publish and email failure remains visible', async () => {
  let row = { ...fixture }; const messages: object[] = [], mutations: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    const action = String(url).split('/').pop();
    if (options?.method === 'POST') {
      mutations.push(action || '');
      const input = JSON.parse(String(options.body)) as { approved?: boolean };
      if (action === 'generate') row = { ...row, draft: 'Reviewed wine and juice plan', status: 'draft', revision: 1 };
      if (action === 'publish') { expect(input.approved).toBe(true); messages.push({ _id: 'message-one', sender: 'staff', content: row.draft, createdAt: row.createdAt }); row = { ...row, status: 'draft', revision: 2, ...{ deliveryMethod: 'chat' } }; }
      if (action === 'send') row = { ...row, status: 'delivery_failed', revision: 3, ...{ deliveryError: 'Mail transport unavailable; reply remains saved.' } };
    }
    return new Response(JSON.stringify({ success: true, data: action?.startsWith('messages') ? { messages, olderCursor: null } : row }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  render(<RequestDetail id={fixture._id} />);
  await screen.findByText('Customer brief');
  fireEvent.click(screen.getByRole('button', { name: 'Check catalogue with AI' }));
  await waitFor(() => expect((screen.getByLabelText('Final reply') as HTMLTextAreaElement).value).toBe('Reviewed wine and juice plan'));
  expect(mutations).toEqual(['generate']);
  const publish = screen.getByRole('button', { name: 'Publish reply in customer chat' }) as HTMLButtonElement;
  expect(publish.disabled).toBe(true);
  fireEvent.click(screen.getByLabelText(/I reviewed this saved reply/)); fireEvent.click(publish);
  await waitFor(() => expect(screen.getByRole('log').textContent).toContain('Reviewed wine and juice plan'));
  expect(mutations).toEqual(['generate', 'publish']);
  expect((screen.getByRole('button', { name: 'Email reply and save in chat' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText(/I reviewed this saved reply/)); fireEvent.click(screen.getByRole('button', { name: 'Email reply and save in chat' }));
  await screen.findByText('Mail transport unavailable; reply remains saved.');
  expect(screen.queryByText('The mail service accepted this reply.')).toBeNull();
});
test('recording a WhatsApp reply needs both review and staff confirmation that it was sent', async () => {
  const row = { ...fixture, channel: 'whatsapp', whatsapp: '2348012345678', status: 'draft', draft: 'Reviewed wedding drinks plan' };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify({ success: true, data: String(url).endsWith('/messages') ? { messages: [], olderCursor: null } : row }), { status: 200 })));
  render(<RequestDetail id={fixture._id} />); await screen.findByText('Customer brief');
  const record = screen.getByRole('button', { name: 'Record WhatsApp reply as sent' }) as HTMLButtonElement;
  fireEvent.click(screen.getByLabelText('I reviewed this saved plan and approve sharing it with the customer.'));
  expect(record.disabled).toBe(true);
  fireEvent.click(screen.getByLabelText('I have sent this saved reply to the customer through WhatsApp.'));
  expect(record.disabled).toBe(false);
});
