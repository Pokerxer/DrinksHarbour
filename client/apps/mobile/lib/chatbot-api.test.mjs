import { beforeEach, describe, expect, test, vi } from 'vitest';

let lastUrl = null;
let lastInit = null;

vi.mock('commerce-core', () => ({ getApiBaseUrl: () => 'http://api.test' }));

const chatbot = await import('./chatbot-api.ts');

const res = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  lastUrl = null;
  lastInit = null;
  globalThis.fetch = vi.fn(async (url, init) => {
    lastUrl = String(url);
    lastInit = init;
    return res(200, { success: true, data: { response: 'ok', quickReplies: [] } });
  });
});

describe('fetchGreeting', () => {
  test('POSTs to /api/chatbot/greeting and returns the opening turn', async () => {
    globalThis.fetch = vi.fn(async (url) => {
      lastUrl = String(url);
      return res(200, {
        success: true,
        data: {
          response: 'Good evening! 🍾',
          quickReplies: [{ label: '🍷 Wines', query: 'Show me your best wines' }],
        },
      });
    });

    const result = await chatbot.fetchGreeting();

    expect(lastUrl).toBe('http://api.test/api/chatbot/greeting');
    expect(result).toEqual({
      ok: true,
      data: {
        response: 'Good evening! 🍾',
        quickReplies: [{ label: '🍷 Wines', query: 'Show me your best wines' }],
        cartProposal: [],
      },
    });
  });

  test('a failure is an error result, not a throw', async () => {
    globalThis.fetch = vi.fn(async () => res(500, { success: false, message: 'Greeting failed' }));

    expect(await chatbot.fetchGreeting()).toEqual({ ok: false, error: 'Greeting failed' });
  });

  test('a network rejection is an error result, not a throw', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Network request failed');
    });

    expect((await chatbot.fetchGreeting()).ok).toBe(false);
  });
});

describe('sendChatQuery', () => {
  test('sends multipart FormData and sets NO Content-Type header', async () => {
    // The route is `upload.fields([...])` behind multer. Setting the header
    // ourselves omits the multipart boundary, and the server then reports a
    // parse failure that reads exactly like a server bug.
    await chatbot.sendChatQuery('what pairs with beef', []);

    expect(lastUrl).toBe('http://api.test/api/chatbot/query');
    expect(lastInit.method).toBe('POST');
    expect(lastInit.body).toBeInstanceOf(FormData);
    expect(lastInit.headers).toBeUndefined();
    expect(lastInit.body.get('query')).toBe('what pairs with beef');
  });

  test('serialises the conversation history as a JSON string field', async () => {
    const history = [{ role: 'user', content: 'hi' }];

    await chatbot.sendChatQuery('and now?', history);

    expect(JSON.parse(lastInit.body.get('conversationHistory'))).toEqual(history);
  });

  test('sends only the last ten turns', async () => {
    const history = Array.from({ length: 25 }, (_, i) => ({ role: 'user', content: `m${i}` }));

    await chatbot.sendChatQuery('q', history);

    const sent = JSON.parse(lastInit.body.get('conversationHistory'));
    expect(sent).toHaveLength(10);
    expect(sent[0].content).toBe('m15');
  });

  test('surfaces the cart proposal when the model offered one', async () => {
    globalThis.fetch = vi.fn(async () =>
      res(200, {
        success: true,
        data: {
          response: 'Shall I add these?',
          quickReplies: ['Yes please'],
          cartProposal: [
            { id: 'p1', slug: 'lagavulin-16', name: 'Lagavulin 16', size: '70cl', qty: 2, price: 52000, image: null },
          ],
        },
      })
    );

    const result = await chatbot.sendChatQuery('recommend a smoky whisky', []);

    expect(result.data.cartProposal).toHaveLength(1);
    expect(result.data.cartProposal[0].slug).toBe('lagavulin-16');
    expect(result.data.quickReplies).toEqual(['Yes please']);
  });

  test('a success:false body is an error, even on HTTP 200', async () => {
    globalThis.fetch = vi.fn(async () => res(200, { success: false, message: 'No response' }));

    expect(await chatbot.sendChatQuery('q', [])).toEqual({ ok: false, error: 'No response' });
  });

  test('missing quickReplies and cartProposal default to empty arrays', async () => {
    globalThis.fetch = vi.fn(async () => res(200, { success: true, data: { response: 'hi' } }));

    const result = await chatbot.sendChatQuery('q', []);

    expect(result.data.quickReplies).toEqual([]);
    expect(result.data.cartProposal).toEqual([]);
  });
});

describe('escalateToHuman', () => {
  test('POSTs JSON to /api/chatbot/escalate', async () => {
    await chatbot.escalateToHuman({ email: 'a@b.com', message: 'help', history: [] });

    expect(lastUrl).toBe('http://api.test/api/chatbot/escalate');
    expect(lastInit.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(lastInit.body).email).toBe('a@b.com');
  });

  test('surfaces the rate-limit message verbatim', async () => {
    // 5 per 10 minutes, and it is the ONLY public endpoint that makes the
    // server send mail — the shopper must see why, not a generic failure.
    globalThis.fetch = vi.fn(async () =>
      res(429, {
        success: false,
        message: 'You have already asked for a human recently — please wait for a reply.',
      })
    );

    expect(await chatbot.escalateToHuman({ email: 'a@b.com', message: 'x', history: [] })).toEqual({
      ok: false,
      error: 'You have already asked for a human recently — please wait for a reply.',
    });
  });
});
