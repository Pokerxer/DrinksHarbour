'use client';

import React from 'react';
import { PiX } from 'react-icons/pi';

interface DateTimeRangeProps {
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  onDateFrom: (value: string) => void;
  onDateTo: (value: string) => void;
  onTimeFrom: (value: string) => void;
  onTimeTo: (value: string) => void;
  onClear: () => void;
}

export default function DateTimeRange(props: DateTimeRangeProps) {
  const endpoints = [
    {
      label: 'From',
      date: props.dateFrom,
      time: props.timeFrom,
      onDate: props.onDateFrom,
      onTime: props.onTimeFrom,
    },
    {
      label: 'To',
      date: props.dateTo,
      time: props.timeTo,
      onDate: props.onDateTo,
      onTime: props.onTimeTo,
    },
  ];

  return (
    <div className="flex w-full min-w-0 flex-wrap items-end gap-2 xl:w-auto">
      <div className="grid w-full min-w-0 gap-2 sm:w-auto sm:flex-1 sm:grid-cols-2">
        {endpoints.map(({ label, date, time, onDate, onTime }) => (
          <fieldset key={label} className="min-w-0">
            <legend className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {label}
            </legend>
            <div className="grid min-w-0 grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-2">
              <input
                aria-label={`${label} date`}
                type="date"
                value={date}
                onChange={(event) => onDate(event.target.value)}
                className="h-10 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-800 focus:border-[#b20202] focus:outline-none sm:h-[34px]"
              />
              <input
                aria-label={`${label} time`}
                type="time"
                value={time}
                onChange={(event) => onTime(event.target.value)}
                className="h-10 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-800 focus:border-[#b20202] focus:outline-none sm:h-[34px]"
              />
            </div>
          </fieldset>
        ))}
      </div>
      {(props.dateFrom || props.dateTo || props.timeFrom || props.timeTo) && (
        <button
          type="button"
          onClick={props.onClear}
          aria-label="Clear date range"
          title="Clear date range"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 sm:h-[34px] sm:w-[34px]"
        >
          <PiX className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
