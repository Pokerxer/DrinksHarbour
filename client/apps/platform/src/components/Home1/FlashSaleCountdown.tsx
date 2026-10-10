"use client";
import { memo, useState, useRef, useEffect } from "react";
import { PiClock } from "react-icons/pi";
interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

const CountdownTimer = memo(function CountdownTimer({
  endTime,
  onExpire,
}: {
  endTime: Date;
  onExpire?: () => void;
}) {
  // The browser starts the clock after hydration; server markup is deterministic.
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;

    const calculate = () => {
      if (document.hidden) return;

      const diff = endTime.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        if (!expiredRef.current) {
          expiredRef.current = true;
          onExpire?.();
        }
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        isExpired: false,
      });
    };

    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [endTime, onExpire]);

  if (!timeLeft) {
    return <span className="min-w-[100px] text-center text-white font-bold tabular-nums" aria-label="Loading sale countdown">--:--:--</span>;
  }

  if (timeLeft.isExpired) {
    return (
      <div className="flex items-center gap-1.5 text-white/80 text-xs">
        <PiClock size={14} />
        <span>Sale Ended</span>
      </div>
    );
  }

  const TimeBox = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center">
        <span className="text-white font-black text-xs sm:text-sm tabular-nums leading-none">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="text-[9px] text-white/70 font-medium mt-0.5 uppercase tracking-wide">
        {label}
      </span>
    </div>
  );

  const Colon = () => (
    <span className="text-white font-black text-sm sm:text-base mb-2 sm:mb-3 opacity-80">:</span>
  );

  return (
    <div className="flex items-end gap-0.5 sm:gap-1">
      {timeLeft.days > 0 && (
        <>
          <TimeBox value={timeLeft.days} label="Days" />
          <Colon />
        </>
      )}
      <TimeBox value={timeLeft.hours} label="Hrs" />
      <Colon />
      <TimeBox value={timeLeft.minutes} label="Min" />
      <Colon />
      <TimeBox value={timeLeft.seconds} label="Sec" />
    </div>
  );
});


export default CountdownTimer;
