import React from 'react';

// ─── Shared legal-page UI primitives ───────────────────────────────────────────
// Reused across Privacy Policy, Terms of Service, and other policy pages so every
// legal document renders with a single consistent look.

export interface PolicySectionDef {
  id: string;
  title: string;
  icon: React.ElementType;
  Body: React.FC;
}

export function PolicySection({
  id, title, icon: Ic, children,
}: {
  id: string; title: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-red-50 text-red-700 rounded-xl flex items-center justify-center flex-shrink-0">
          <Ic size={18} />
        </div>
        <h2 className="text-lg font-black text-gray-900">{title}</h2>
      </div>
      <div className="space-y-3 text-sm text-gray-600 leading-relaxed pl-0 sm:pl-12">
        {children}
      </div>
    </section>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-gray-700">{children}</p>;
}

export function SubHeading({ children }: { children: React.ReactNode }) {
  return <p className="font-semibold text-gray-800 mt-4 mb-1.5">{children}</p>;
}

export function BulletList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-2" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function NumberedList({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-1.5 list-none">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="w-5 h-5 rounded-md bg-red-50 text-red-700 text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

type CalloutTone = 'info' | 'warning' | 'danger' | 'success';

const CALLOUT_STYLES: Record<CalloutTone, string> = {
  info:    'bg-red-50 border-red-600 text-gray-700',
  warning: 'bg-amber-50 border-amber-500 text-amber-900',
  danger:  'bg-rose-50 border-rose-600 text-rose-900',
  success: 'bg-emerald-50 border-emerald-600 text-emerald-900',
};

export function Callout({
  children, tone = 'info',
}: {
  children: React.ReactNode; tone?: CalloutTone;
}) {
  return (
    <div className={`border-l-4 rounded-r-xl p-4 text-sm leading-relaxed ${CALLOUT_STYLES[tone]}`}>
      {children}
    </div>
  );
}

export function MailLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className="text-red-700 font-semibold hover:underline">
      {email}
    </a>
  );
}

export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-red-700 font-semibold hover:underline">
      {children}
    </a>
  );
}

export function DataTable({
  columns, rows,
}: {
  columns: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto -mx-2 sm:mx-0">
      <table className="w-full text-xs border-collapse min-w-[520px]">
        <thead>
          <tr className="bg-gray-50">
            {columns.map((c, i) => (
              <th
                key={c}
                className={`text-left p-3 font-bold text-gray-700 border border-gray-100 ${
                  i === 0 ? 'rounded-tl-lg' : ''
                } ${i === columns.length - 1 ? 'rounded-tr-lg' : ''}`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-gray-50 align-top">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`p-3 border border-gray-100 ${
                    ci === 0 ? 'font-semibold text-gray-800' : 'text-gray-600'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
      {children}
    </div>
  );
}
