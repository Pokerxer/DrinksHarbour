import { useId, useState, type ReactNode } from 'react';
import { PiCaretDown } from 'react-icons/pi';
interface Props {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: number;
  isLoading?: boolean;
}
export default function FilterSection({ title, icon, children, defaultOpen = true, badge, isLoading = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return <section className="border-b border-gray-200 last:border-b-0">
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}
      className="flex w-full items-center justify-between rounded-lg px-4 py-4 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b20202]">
      <span className="flex items-center gap-3">
        <span aria-hidden="true" className="text-gray-600">{icon}</span>
        <span className="font-semibold text-gray-900">{title}</span>
        {!!badge && <span className="rounded-full bg-[#b20202] px-2 py-0.5 text-xs font-medium text-white">{badge}</span>}
      </span>
      <PiCaretDown aria-hidden="true" size={18} className={`text-gray-400 ${open ? 'rotate-180' : ''}`} />
    </button>
    <div id={id} hidden={!open}>
      <div className="px-4 pb-4">
        {isLoading ? <div className="space-y-2" aria-label="Loading filter options" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />)}
        </div> : children}
      </div>
    </div>
  </section>;
}
