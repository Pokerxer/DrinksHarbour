'use client';
import { useEffect, useState } from 'react';
import ProfileSchedule from './profile-schedule';
import type { Profile } from '@/services/venue/experience';
import {
  fieldClass,
  hintClass,
  UnsavedHint,
  buttonClass,
  primaryButtonClass,
} from './controls';
const blank: Profile = {
  slug: '',
  name: '',
  types: ['lounge'],
  timezone: 'Africa/Lagos',
  description: '',
  address: '',
  hours: [],
  exceptions: [],
  policies: '',
};
const nameFields: [
  'name' | 'slug' | 'timezone' | 'address',
  string,
  string,
][] = [
  ['name', 'Venue name', 'Shown to guests browsing the marketplace and storefront.'],
  ['slug', 'Listing slug', 'Used in the public URL, e.g. /v/your-lounge-name.'],
  ['timezone', 'Timezone', 'Opens times, bookings and confirmations use this zone.'],
  ['address', 'Address', 'Where guests would find this location physically.'],
];
export default function ProfileEditor({
  value,
  onSave,
  busy,
}: {
  value: Profile | null;
  onSave: (profile: Profile) => Promise<void>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<Profile>(value || blank);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Chrome requires returnValue to be set to trigger the prompt.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  const field = (name: keyof Profile, value: unknown) => {
    setDirty(true);
    setDraft((old) => ({ ...old, [name]: value }));
  };
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setDirty(false);
        void onSave(draft);
      }}
    >
      <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
        Changes return the public profile to review. Paid access and publication
        approval are checked separately.
      </p>
      <fieldset className="space-y-1 rounded-xl border border-muted p-4 dark:border-gray-700">
        <legend className="text-base font-semibold">
          Location details
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {nameFields.map(([name, label, hint]) => (
            <div key={name} className="space-y-1">
              <label className="block text-sm font-medium">
                {label}
                <input
                  required
                  value={draft[name]}
                  onChange={(e) => field(name, e.target.value)}
                  className={fieldClass}
                />
              </label>
              <p className={hintClass}>{hint}</p>
            </div>
          ))}
        </div>
        <label className="block text-sm font-medium">
          Public contact phone
          <input
            type="tel"
            maxLength={40}
            value={draft.publicPhone || ''}
            onChange={(e) => field('publicPhone', e.target.value)}
            className={fieldClass}
          />
          <span className={hintClass}>
            Optional. Displayed for guest questions and reservations.
          </span>
        </label>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-base font-semibold">Location photos</legend>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Use uploaded Cloudinary images and describe each photo for visitors
          using screen readers.
        </p>
        {(draft.photos || []).map((photo, index) => (
          <div
            key={index}
            className="grid items-end gap-2 rounded-xl border border-muted bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60 sm:grid-cols-[1fr_1fr_auto]"
          >
            <label className="block text-sm font-medium">
              Photo URL
              <input
                type="url"
                required
                value={photo.url}
                onChange={(e) =>
                  field(
                    'photos',
                    draft.photos?.map((p, i) =>
                      i === index ? { ...p, url: e.target.value } : p,
                    ),
                  )
                }
                className={fieldClass}
              />
            </label>
            <label className="block text-sm font-medium">
              Photo description
              <input
                required
                maxLength={200}
                value={photo.alt}
                onChange={(e) =>
                  field(
                    'photos',
                    draft.photos?.map((p, i) =>
                      i === index ? { ...p, alt: e.target.value } : p,
                    ),
                  )
                }
                className={fieldClass}
              />
            </label>
            <button
              type="button"
              className={buttonClass}
              onClick={() =>
                field(
                  'photos',
                  draft.photos?.filter((_, i) => i !== index),
                )
              }
            >
              Remove photo {index + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          className={buttonClass}
          disabled={(draft.photos?.length || 0) >= 8}
          onClick={() =>
            field('photos', [...(draft.photos || []), { url: '', alt: '' }])
          }
        >
          Add location photo{(draft.photos?.length || 0) >= 8 ? ' (limit 8 reached)' : ''}
        </button>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-base font-semibold">Venue types</legend>
        <div className="flex flex-wrap gap-4">
          {['restaurant', 'bar', 'lounge', 'club'].map((type) => (
            <label key={type} className="inline-flex min-h-11 items-center gap-2 font-medium capitalize">
              <input
                type="checkbox"
                className="size-4 rounded border-gray-400"
                checked={draft.types.includes(type)}
                onChange={(e) =>
                  field(
                    'types',
                    e.target.checked
                      ? [...draft.types, type]
                      : draft.types.filter((t) => t !== type),
                  )
                }
              />{' '}
              {type}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-medium">
        Description
        <textarea
          value={draft.description}
          onChange={(e) => field('description', e.target.value)}
          maxLength={2000}
          rows={4}
          className={fieldClass}
        ></textarea>
        <span className={hintClass}>
          Up to 2000 characters. Describe the atmosphere, seating and dress code.
        </span>
      </label>
      <label className="block text-sm font-medium">
        Visit policies
        <textarea
          required
          value={draft.policies}
          onChange={(e) => field('policies', e.target.value)}
          maxLength={3000}
          rows={4}
          className={fieldClass}
        ></textarea>
        <span className={hintClass}>
          Required. House rules guests see before requesting a booking, up to 3000 characters.
        </span>
      </label>
      <ProfileSchedule draft={draft} field={field} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={busy}
          className={primaryButtonClass}
        >
          Save location profile
        </button>
        <UnsavedHint dirty={dirty} />
      </div>
    </form>
  );
}
