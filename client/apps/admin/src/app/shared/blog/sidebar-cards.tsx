'use client';

// Sidebar pieces: Cover image, Author, SEO & Meta with live previews.
// Each is a self-contained card so the page composer stays small.

import { Input, Textarea } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiImageBold,
  PiUserBold,
  PiMagnifyingGlassBold,
  PiGlobeBold,
  PiCameraBold,
  PiSparkleBold,
} from 'react-icons/pi';
import {
  SectionCard,
  CharCount,
  FieldLabel,
  ImageUploadButton,
  UrlInput,
} from './editor-primitives';
import { RegenerateButton } from './ai-bar';

interface AiProps {
  fieldBusy: string;
  onRegenerate: (field: string) => void;
}

// ─── Cover image ─────────────────────────────────────────────────────────────

export function CoverImageCard({
  post,
  set,
  token,
  fieldBusy,
  onRegenerate,
}: {
  post: any;
  set: (patch: any) => void;
  token: string;
} & AiProps) {
  return (
    <SectionCard
      title="Cover Image"
      description="Shown at the top of the article and in social cards."
      icon={PiImageBold}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
        {/* Inputs */}
        <div className="space-y-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <FieldLabel className="mb-0">Image URL</FieldLabel>
              <ImageUploadButton
                token={token}
                label="Upload"
                onUploaded={(url) => set({ image: url })}
              />
            </div>
            <UrlInput
              value={post.image}
              onChange={(v) => set({ image: v })}
              placeholder="https://… or upload a file"
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <FieldLabel className="mb-0">Alt text</FieldLabel>
              <div className="flex items-center gap-1">
                <CharCount value={post.imageAlt} max={125} warn={100} />
                <RegenerateButton
                  field="imageAlt"
                  busy={fieldBusy}
                  onClick={onRegenerate}
                />
              </div>
            </div>
            <Input
              placeholder="Describe the image for screen readers & SEO"
              value={post.imageAlt || ''}
              onChange={(e) => set({ imageAlt: e.target.value })}
            />
          </div>
        </div>

        {/* Preview */}
        <div className="relative aspect-[3/2] overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          {post.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.image}
              alt={post.imageAlt || 'Cover preview'}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 text-gray-400">
              <PiCameraBold className="h-6 w-6" />
              <span className="text-[11px]">No image yet</span>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Author ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function AuthorCard({
  post,
  set,
}: {
  post: any;
  set: (patch: any) => void;
}) {
  const name = post.author.name || '';
  return (
    <SectionCard
      title="Author"
      description="Shown in the article byline and author card."
      icon={PiUserBold}
    >
      <div className="flex items-start gap-4">
        {/* Avatar preview */}
        <div
          className={cn(
            'flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-lg font-bold',
            name
              ? 'bg-gradient-to-br from-red-100 to-red-200 text-red-700'
              : 'bg-gray-100 text-gray-400',
          )}
        >
          {name ? initials(name) : <PiUserBold className="h-6 w-6" />}
        </div>
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Name"
            placeholder="Author name"
            value={post.author.name}
            onChange={(e) =>
              set({ author: { ...post.author, name: e.target.value } })
            }
          />
          <Input
            label="Role / Title"
            placeholder="e.g. Senior Wine Correspondent"
            value={post.author.role}
            onChange={(e) =>
              set({ author: { ...post.author, role: e.target.value } })
            }
          />
          <Textarea
            label="Bio"
            rows={2}
            placeholder="Short bio shown below the article…"
            value={post.author.bio}
            onChange={(e) =>
              set({ author: { ...post.author, bio: e.target.value } })
            }
            className="sm:col-span-2"
          />
        </div>
      </div>
    </SectionCard>
  );
}

// ─── SEO & Meta ──────────────────────────────────────────────────────────────

function GooglePreview({
  url,
  title,
  desc,
}: {
  url: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3.5">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
        Google preview
      </p>
      <p className="truncate text-xs text-emerald-700">
        drinksharbour.com › blog › {url || '…'}
      </p>
      <p className="mt-0.5 truncate text-[17px] font-medium leading-snug text-blue-700">
        {title || '…'}
      </p>
      <p className="mt-1 line-clamp-2 text-sm text-gray-600">
        {desc || 'No description yet.'}
      </p>
    </div>
  );
}

function SocialPreview({
  image,
  title,
  desc,
  domain,
}: {
  image: string;
  title: string;
  desc: string;
  domain: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
      <div className="flex aspect-[1.91/1] items-center justify-center bg-gray-100 text-gray-400">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="Social preview" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs">No social image — falls back to cover</span>
        )}
      </div>
      <div className="border-t border-gray-100 px-3.5 py-2.5">
        <p className="text-[10px] uppercase tracking-wider text-gray-400">
          {domain}
        </p>
        <p className="mt-0.5 line-clamp-1 text-sm font-semibold text-gray-900">
          {title || '…'}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
          {desc || 'No description yet.'}
        </p>
      </div>
    </div>
  );
}

export function SeoCard({
  post,
  set,
  token,
  previewTitle,
  previewDesc,
  fieldBusy,
  onRegenerate,
  onGenerateSeo,
}: {
  post: any;
  set: (patch: any) => void;
  token: string;
  previewTitle: string;
  previewDesc: string;
  onGenerateSeo: () => void;
} & AiProps) {
  const ogImage = post.seo?.ogImage || post.image;
  const domain = 'drinksharbour.com';
  const seoBusy = fieldBusy === 'seo';

  return (
    <SectionCard
      title="SEO & Meta"
      description="Override what search engines and social platforms display. Leave blank to inherit."
      icon={PiMagnifyingGlassBold}
      right={
        <button
          type="button"
          onClick={onGenerateSeo}
          disabled={seoBusy}
          title="Generate SEO title + description from the post content"
          className={cn(
            'flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-700 transition',
            'hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          {seoBusy ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
          ) : (
            <PiSparkleBold className="h-3.5 w-3.5" />
          )}
          Generate SEO
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Inputs */}
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <FieldLabel className="mb-0">Meta title</FieldLabel>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">50–60</span>
                <CharCount value={post.seo?.metaTitle} max={60} warn={55} />
                <RegenerateButton
                  field="seoTitle"
                  busy={fieldBusy}
                  onClick={onRegenerate}
                />
              </div>
            </div>
            <Input
              placeholder={
                post.title
                  ? `${post.title} | DrinksHarbour Blog`
                  : 'Defaults to post title'
              }
              value={post.seo?.metaTitle || ''}
              onChange={(e) =>
                set({ seo: { ...post.seo, metaTitle: e.target.value } })
              }
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <FieldLabel className="mb-0">Meta description</FieldLabel>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">150–160</span>
                <CharCount
                  value={post.seo?.metaDescription}
                  max={160}
                  warn={145}
                />
                <RegenerateButton
                  field="seoDescription"
                  busy={fieldBusy}
                  onClick={onRegenerate}
                />
              </div>
            </div>
            <Textarea
              rows={3}
              placeholder={post.excerpt || 'Defaults to excerpt'}
              value={post.seo?.metaDescription || ''}
              onChange={(e) =>
                set({ seo: { ...post.seo, metaDescription: e.target.value } })
              }
              className="[&>textarea]:resize-y"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <FieldLabel className="mb-0">Social / OG image</FieldLabel>
              <ImageUploadButton
                token={token}
                label="Upload"
                onUploaded={(url) =>
                  set({ seo: { ...post.seo, ogImage: url } })
                }
              />
            </div>
            <UrlInput
              value={post.seo?.ogImage || ''}
              onChange={(v) => set({ seo: { ...post.seo, ogImage: v } })}
              placeholder={
                post.image
                  ? 'Defaults to cover image · 1200×630 recommended'
                  : '1200×630 px recommended'
              }
            />
            <p className="mt-1.5 text-xs text-gray-400">
              Recommended size 1200×630 px. Falls back to the cover image.
            </p>
          </div>
        </div>

        {/* Live previews */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <PiGlobeBold className="h-3 w-3" /> Live previews
          </div>
          <GooglePreview
            url={post.slug}
            title={previewTitle}
            desc={previewDesc}
          />
          <SocialPreview
            image={ogImage}
            title={previewTitle}
            desc={previewDesc}
            domain={domain}
          />
        </div>
      </div>
    </SectionCard>
  );
}