'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PiBell, PiX, PiArrowSquareOut } from 'react-icons/pi';
import type { TenantNotice } from '@/services/notification.service';
import { fullNoticeTimestamp, safeAction } from './inbox-filters';
import { noticeAppearance, noticeFacts } from './notice-presentation';
import { noticeIcons, PriorityBadge } from './notification-row';
export default function NotificationDetailPanel({
  notice,
  close,
}: {
  notice: TenantNotice | null;
  close: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const resize = () => setIsMobile(window.innerWidth < 1024);
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const closeButton = useRef<HTMLButtonElement>(null);
  const noticeId = notice?._id;
  useEffect(() => {
    if (!noticeId) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeButton.current?.focus();
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key !== 'Tab' || window.innerWidth >= 1024) return;
      const controls = panel.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href]'
      );
      if (!controls?.length) return;
      const first = controls[0],
        last = controls[controls.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !panel.current?.contains(document.activeElement))
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !panel.current?.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('keydown', escape);
      if (previous?.isConnected) previous.focus();
    };
  }, [noticeId, close]);
  if (!notice)
    return (
      <aside className="hidden w-72 shrink-0 flex-col items-center justify-center gap-3 border-l border-gray-200 bg-gray-50 p-8 text-center xl:flex">
        <PiBell className="h-10 w-10 text-gray-300" />
        <p className="font-bold text-gray-700">Select a notification</p>
        <p className="text-sm text-gray-500">
          See the details and choose your next step.
        </p>
      </aside>
    );
  const appearance = noticeAppearance(notice.type);
  const evidence = noticeFacts(notice.metadata);
  const Icon = noticeIcons[notice.type as keyof typeof noticeIcons] || PiBell;
  return (
    <>
      <button
        aria-label="Close notification overlay"
        onClick={close}
        className="absolute inset-0 z-10 bg-gray-900/20 lg:hidden"
      />
      <aside
        ref={panel}
        role={isMobile ? 'dialog' : undefined}
        aria-modal={isMobile || undefined}
        aria-label="Notification details"
        className="absolute inset-y-0 right-0 z-20 flex w-full flex-col overflow-y-auto border-l border-gray-200 bg-white p-6 shadow-2xl sm:w-[440px] lg:relative lg:w-auto lg:min-w-0 lg:flex-1 lg:shadow-none"
      >
        <div className="flex items-start justify-between gap-4">
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${appearance.tile}`}
          >
            <Icon className="h-6 w-6" />
          </span>
          <button
            ref={closeButton}
            aria-label="Close notification details"
            onClick={close}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b20202]"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <PriorityBadge priority={notice.priority} />
          {notice.priority !== 'urgent' && notice.priority !== 'high' && (
            <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase text-gray-500">
              {notice.priority}
            </span>
          )}
          <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase text-gray-500">
            {appearance.label}
          </span>
        </div>
        <h2 className="mt-4 break-words text-xl font-black text-gray-900">
          {notice.title}
        </h2>
        <p className="mt-2 text-xs text-gray-400">
          {fullNoticeTimestamp(notice.createdAt)} · Lagos
        </p>
        <p className="mt-5 whitespace-pre-line break-words text-sm leading-relaxed text-gray-600">
          {notice.message}
        </p>
        <p className="mt-3 text-xs font-semibold text-gray-500">
          {notice.isRead ? 'Read' : 'Unread'}
        </p>
        {evidence.length > 0 && (
          <>
            <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-gray-500">
              Facts
            </h3>
            <dl className="mt-2 grid grid-cols-1 gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
              {evidence.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    {label}
                  </dt>
                  <dd className="mt-1 break-words text-sm font-medium text-gray-700">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
        {safeAction(notice.actionUrl) && (
          <Link
            href={notice.actionUrl!}
            className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-[#b20202] px-4 py-3 text-sm font-bold text-white"
          >
            {notice.actionLabel || 'Open'}
            <PiArrowSquareOut className="h-4 w-4" />
          </Link>
        )}
      </aside>
    </>
  );
}
