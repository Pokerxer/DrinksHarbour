import { beforeEach, describe, expect, test } from 'vitest';
import { CHAT_SESSION_KEY, clearChatSession, readChatSession, writeChatSession } from './chat-session.ts';

/**
 * The web persists the conversation to **sessionStorage** under
 * `dh-chatbot-session-v1` (`ChatbotWidget.tsx:297/315/700`) — NOT localStorage.
 * sessionStorage dies with the tab.
 *
 * React Native has neither. The honest analogue of "lives as long as this
 * visit" is a module-level store: it survives switching tabs and navigating
 * inside the app, and is gone when the app is killed. Persisting to
 * AsyncStorage instead would make the mobile session outlive the web's.
 */

beforeEach(() => clearChatSession());

describe('the key', () => {
  test('is the web\'s, so the two apps name the same thing', () => {
    expect(CHAT_SESSION_KEY).toBe('dh-chatbot-session-v1');
  });
});

describe('readChatSession', () => {
  test('starts empty', () => {
    expect(readChatSession()).toEqual({ messages: [], quickReplies: [], pendingCart: null });
  });

  test('returns what was written', () => {
    const session = {
      messages: [{ role: 'user', content: 'hi', timestamp: 1 }],
      quickReplies: ['Yes please'],
      pendingCart: null,
    };

    writeChatSession(session);

    expect(readChatSession()).toEqual(session);
  });

  test('hands back a COPY — a caller mutating it must not corrupt the store', () => {
    writeChatSession({ messages: [{ role: 'user', content: 'hi', timestamp: 1 }], quickReplies: [], pendingCart: null });

    readChatSession().messages.push({ role: 'user', content: 'injected', timestamp: 2 });

    expect(readChatSession().messages).toHaveLength(1);
  });
});

describe('clearChatSession', () => {
  test('empties everything, including a pending cart offer', () => {
    writeChatSession({
      messages: [{ role: 'assistant', content: 'Shall I add these?', timestamp: 1 }],
      quickReplies: ['Yes'],
      pendingCart: [{ id: 'p1', slug: 's', name: 'n', size: null, qty: 1, price: 1, image: null }],
    });

    clearChatSession();

    expect(readChatSession()).toEqual({ messages: [], quickReplies: [], pendingCart: null });
  });
});
