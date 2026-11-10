'use client';
import { PublishedTick, BubbleMeta, DayDivider, StaffBubble, ChatWallpaper } from './chat-parts';
import { useStaffHistory } from './staff-history';
import { chatDayLabel } from '@/lib/chat-formatting';
import type { HistoryMessage } from '@/services/occasionRequest.service';

function dayGroups(messages: HistoryMessage[]) {
  const groups: { label: string; items: HistoryMessage[] }[] = [];
  for (const message of messages) {
    const label = chatDayLabel(message.createdAt);
    const current = groups[groups.length - 1];
    if (current && current.label === label) current.items.push(message);
    else groups.push({ label, items: [message] });
  }
  return groups;
}

/** Saved customer conversation as the staff reads it: a WhatsApp-style
 * message log that polls incrementally (DRI-26 `?after` contract) and whose
 * full reads advance the staff read watermark (DRI-41). Drafts stay private
 * until approved in the request-detail compose flow — this panel only shows
 * what the customer sees. The reply editor lives below in request-detail. */
export default function ConversationPanel({ id, token, revision }: { id: string; token: string; revision: number }) {
  const { messages, olderCursor, error, load, loadEarlier, earlierBusy } = useStaffHistory(token, id, revision);
  return <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
      <h2 className="text-xl font-bold">Saved customer conversation</h2>
      <button type="button" className="min-h-11 rounded-lg px-2 text-sm underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => load()}>Refresh messages</button>
    </div>
    <p className="px-6 pt-4 text-xs leading-6 text-gray-500 dark:text-gray-400">The customer sees these messages under Chat in their profile. Drafts are private until approved. Opening this pane is the read mark: outgoing tick means the reply is saved in the customer’s chat. Messages refresh every 10 seconds; use the reply editor below to respond.</p>
    {error && <p role="alert" className="mx-6 mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30">Conversation could not be refreshed. Try again before replying. {error}</p>}
    <ChatWallpaper>
      <div role="log" aria-label="Saved customer conversation" aria-live="polite" className="max-h-[520px] min-h-[240px] space-y-4 overflow-y-auto px-4 py-4">
        {olderCursor && <div className="text-center">
          <button type="button" disabled={earlierBusy} className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-[#7c1d1d] underline shadow-sm ring-1 ring-black/5 disabled:opacity-50" onClick={() => loadEarlier()}>{earlierBusy ? 'Loading…' : 'Load earlier messages'}</button>
        </div>}
        {dayGroups(messages).map(group => <section key={`${group.label}-${group.items[0] ? group.items[0]._id : ''}`}>
          <DayDivider label={group.label} />
          <div className="space-y-3 pt-2">{group.items.map(message => message.sender === 'staff'
            ? <StaffBubble key={message._id} direction="outgoing" message={message} meta={<BubbleMeta createdAt={message.createdAt} ticks={<PublishedTick />} />} />
            : <StaffBubble key={message._id} direction="incoming" message={message} meta={<BubbleMeta createdAt={message.createdAt} />} />)}</div>
        </section>)}
        {!messages.length && !error && <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No follow-up messages yet. The original customer brief is shown below.</p>}
      </div>
    </ChatWallpaper>
  </section>;
}
