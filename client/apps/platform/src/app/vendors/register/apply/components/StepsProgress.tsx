'use client';

import React from 'react';
import * as Icon from 'react-icons/pi';

export const STEP_LABELS = [
  { label: 'Business', icon: Icon.PiStorefrontBold },
  { label: 'Address', icon: Icon.PiMapPinBold },
  { label: 'Contact', icon: Icon.PiUserBold },
  { label: 'Legal', icon: Icon.PiIdentificationCardBold },
  { label: 'Plan', icon: Icon.PiTagBold },
  { label: 'Review', icon: Icon.PiClipboardTextBold },
];

export function StepsProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center mb-10">
      {STEP_LABELS.slice(0, total).map(({ label, icon: Ic }, i) => {
        const isDone = i < current;
        const isActive = i === current;
        const isLast = i === total - 1;

        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isDone
                    ? 'bg-emerald-500 text-white shadow-md'
                    : isActive
                      ? 'bg-gradient-to-br from-red-600 to-red-800 text-white shadow-lg ring-4 ring-red-100 scale-110'
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isDone ? (
                  <Icon.PiCheckBold size={18} />
                ) : (
                  <Ic size={18} />
                )}
              </div>
              <span
                className={`text-xs font-semibold transition-colors duration-300 ${
                  isActive ? 'text-red-700' : isDone ? 'text-emerald-600' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </div>

            {!isLast && (
              <div className="flex-1 h-0.5 mx-2 sm:mx-3 -mt-6 rounded-full overflow-hidden bg-gray-100 relative">
                <div
                  className={`absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 transition-transform duration-500 origin-left ${
                    isDone ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}