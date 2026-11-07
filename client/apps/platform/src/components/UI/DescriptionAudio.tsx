'use client';

import { useEffect, useRef, useState } from 'react';
import { PiSpinnerGap, PiStopFill, PiSpeakerHigh } from 'react-icons/pi';
import { AudioReadError, descriptionText, readDescription } from './description-audio';

interface Props {
  description?: string;
  shortDescription?: string;
  subject?: 'description' | 'brand information' | 'category information' | 'subcategory information';
}

export default function DescriptionAudio({ description, shortDescription, subject = 'description' }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    setStatus('idle');
    setError('');
    return () => {
      controller.current?.abort();
      controller.current = null;
    };
  }, [description, shortDescription]);

  const toggle = async () => {
    if (controller.current) {
      controller.current.abort();
      controller.current = null;
      setStatus('idle');
      return;
    }
    const text = descriptionText(description, shortDescription);
    if (!text) return;
    const active = new AbortController();
    controller.current = active;
    setError('');
    setStatus('loading');
    try {
      await readDescription(text, active.signal, () => {
        if (controller.current === active) setStatus('playing');
      });
    } catch (error) {
      if (!active.signal.aborted) {
        const guidance = {
          unreachable: 'Could not connect to the audio service. Check your connection and try again.',
          'rate-limited': 'Too many audio requests. Please wait before trying again.',
          unavailable: 'Audio is temporarily unavailable. Please try again later.',
        };
        setError(error instanceof AudioReadError ? guidance[error.reason]
          : `Could not read the ${subject}. Please try again.`);
      }
    } finally {
      if (controller.current === active) {
        controller.current = null;
        setStatus('idle');
      }
    }
  };

  if (!description?.trim() && !shortDescription?.trim()) return null;
  const active = status !== 'idle';
  const Icon = status === 'loading' ? PiSpinnerGap : active ? PiStopFill : PiSpeakerHigh;

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-label={active ? `Stop reading ${subject}` : `Listen to ${subject}`}
        aria-pressed={active}
        className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-[#b20202] hover:text-[#b20202] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b20202]"
      >
        <Icon size={18} aria-hidden="true" className={status === 'loading' ? 'animate-spin' : ''} />
        {active ? 'Stop' : `Listen to ${subject}`}
      </button>
      <span role="status" className="sr-only">
        {status === 'loading' ? `Preparing ${subject} audio` : status === 'playing' ? `Reading ${subject}` : ''}
      </span>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
