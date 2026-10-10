'use client';
import { PiCaretDown } from 'react-icons/pi';
import type { NoticeGroup } from './inbox-filters';
import NotificationRow from './notification-row';
export default function NotificationGroup({
  group,
  collapsed,
  toggleCollapse,
  checked,
  selected,
  toggle,
  select,
}: {
  group: NoticeGroup;
  collapsed: boolean;
  toggleCollapse: () => void;
  checked: Set<string>;
  selected: string | null;
  toggle: (id: string) => void;
  select: (id: string) => void;
}) {
  return (
    <div>
      <button
        onClick={toggleCollapse}
        aria-expanded={!collapsed}
        aria-controls={`notice-group-${group.key}`}
        className="relative flex w-full items-center gap-2 overflow-hidden border-b border-gray-200 bg-gray-50 px-5 py-3 text-left"
      >
        <PiCaretDown
          className={`h-4 w-4 transition-transform ${collapsed ? '-rotate-90' : ''}`}
        />
        <span className="text-xs font-bold uppercase tracking-wide text-gray-600">
          {group.label}
        </span>
        <span className="rounded-full bg-gray-200 px-2 text-[10px] font-bold text-gray-600">
          {group.items.length}
        </span>
        <span className="ml-auto text-[10px] text-gray-500">
          {group.unread} unread
        </span>
        <span
          aria-hidden
          className="absolute bottom-0 left-0 h-0.5 bg-[#b20202]"
          style={{ width: `${(group.unread / group.items.length) * 100}%` }}
        />
      </button>
      <ul id={`notice-group-${group.key}`} hidden={collapsed}>
        {group.items.map((notice) => (
          <NotificationRow
            key={notice._id}
            notice={notice}
            checked={checked.has(notice._id)}
            active={selected === notice._id}
            toggle={() => toggle(notice._id)}
            select={() => select(notice._id)}
          />
        ))}
      </ul>
    </div>
  );
}
