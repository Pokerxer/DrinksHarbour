'use client';

/**
 * Shared card-section chrome for the ads forms — same rounded-2xl language as
 * the pairing/banner editors: icon, title + subtitle header, plain body.
 */

export default function FormSection({
  icon,
  iconBg,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
        <div
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${iconBg}`}
        >
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </div>
  );
}
