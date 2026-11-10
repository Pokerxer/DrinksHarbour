'use client';
import type { ReactNode } from 'react';
import ChatBubble from '@/components/chat-ui/ChatBubble';
import ChatDayDivider from '@/components/chat-ui/ChatDayDivider';
import ChatTicks from '@/components/chat-ui/ChatTicks';
import ChatWallpaper from '@/components/chat-ui/ChatWallpaper';
import { chatReadState } from '@/lib/chatStatus';
import type { ChatMessage, Conversation } from '@/lib/customerConversation';
import { chatDayLabel, chatTimeLabel } from '@/lib/chatFormatting';

/** Presentation of one customer conversation log: the original request as a
 * pre-bubble card (with its private download), centered WAT day rails and
 * WhatsApp-grammar bubbles with honest ticks inside the meta row. Outgoing
 * bubbles earn a double check only when the server watermark proves staff
 * read past them; everything else shows the single "sent" check. All text is
 * rendered as escaped plain text. */
export default function ChatThread({ data, olderBusy, onEarlier, onDownload }: { data: Conversation; olderBusy: boolean; onEarlier: () => void; onDownload: (name: string) => void }) {
  const brief = data.request;
  const groups = dayGroups(data.messages);
  return <ChatWallpaper className="rounded-b-xl">
    <div role="log" aria-label="Conversation with our team" aria-live="polite" className="flex max-h-[65vh] min-h-[40vh] flex-col-reverse overflow-y-auto px-3 py-4 sm:px-5">
      <div className="space-y-4">
        <article className="ml-auto max-w-[92%] rounded-2xl rounded-br-sm bg-[#f6e3e3] p-4 shadow-sm">
          <p className="text-xs font-bold text-[#7c1d1d]">You · original request</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{[`${brief.city}${brief.date ? ` · ${brief.date}` : ''}`, brief.guests ? `${brief.guests} guests` : '', brief.budget ? `Drinks budget: ₦${brief.budget.toLocaleString('en-NG')}` : '', brief.preferences.length ? `Preferences: ${brief.preferences.join(', ')}` : '', brief.notes, ...(brief.items.map(item => `${item.quantity} × ${item.name}`) || [])].filter(Boolean).join('\n')}</p>
          {brief.attachment && <button type="button" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-white/70 px-3 text-left text-sm font-semibold text-[#7c1d1d] break-all underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]" onClick={() => onDownload(brief.attachment!.name)}>⬇ Download {brief.attachment.name}</button>}
        </article>
        {data.olderCursor && <div className="text-center">
          <button type="button" disabled={olderBusy} className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-[#7c1d1d] underline shadow-sm ring-1 ring-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d] disabled:opacity-50" onClick={onEarlier}>{olderBusy ? 'Loading…' : 'Load earlier messages'}</button>
        </div>}
        {groups.map(group => <section key={`${group.label}-${group.items[0]?._id ?? ''}`}>
          <ChatDayDivider label={group.label} />
          <div className="space-y-3 pt-2">{group.items.map(message => message.sender === 'customer'
            ? <ChatBubble key={message._id} direction="outgoing" meta={<BubbleMeta message={message} ticks={<ChatTicks state={chatReadState(message.createdAt, brief.lastStaffReadAt)} />} />}>
              <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[#351014]">{message.content}</p>
            </ChatBubble>
            : <ChatBubble key={message._id} direction="incoming" meta={<BubbleMeta message={message} />}>
              <p className="text-xs font-bold text-[#7c1d1d]">DrinksHarbour team</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-7 text-gray-950">{message.content}</p>
            </ChatBubble>)}</div>
        </section>)}
        {!data.messages.length && <p className="px-1 py-6 text-center text-sm leading-7 text-gray-600">Your request is with our team. Their reply will appear here.</p>}
      </div>
    </div>
  </ChatWallpaper>;
}

function BubbleMeta({ message, ticks }: { message: { createdAt: string }; ticks?: ReactNode }) {
  return <div className="mt-1 flex items-center justify-end gap-1.5">
    <span className="text-[11px] leading-5 text-gray-500">{chatTimeLabel(message.createdAt)} WAT</span>
    {ticks}
  </div>;
}

function dayGroups(messages: ChatMessage[]) {
  const groups: { label: string; items: ChatMessage[] }[] = [];
  for (const message of messages) {
    const label = chatDayLabel(message.createdAt);
    const current = groups[groups.length - 1];
    if (current && current.label === label) current.items.push(message);
    else groups.push({ label, items: [message] });
  }
  return groups;
}
