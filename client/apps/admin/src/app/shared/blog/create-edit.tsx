// @ts-nocheck
'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Input,
  Textarea,
  Select,
  Button,
  Switch,
  Text,
  ActionIcon,
} from 'rizzui';
import {
  PiSparkleBold,
  PiPlusBold,
  PiTrashBold,
  PiArrowUpBold,
  PiArrowDownBold,
  PiXBold,
  PiLockSimpleBold,
  PiLockSimpleOpenBold,
  PiTagBold,
  PiImageBold,
  PiUserBold,
  PiArticleBold,
  PiMagnifyingGlassBold,
  PiFloppyDiskBold,
  PiRocketLaunchBold,
  PiClockBold,
  PiStarBold,
  PiUploadSimpleBold,
  PiSpinnerGapBold,
} from 'react-icons/pi';
import { blogService } from '@/services/blog.service';
import { uploadService } from '@/services/upload.service';
import { routes } from '@/config/routes';

const CATEGORIES = [
  'Wine Guide',
  'Spirits Guide',
  'Beer Guide',
  'Recipes',
  'Entertaining',
  'Lifestyle',
];
const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ label: c, value: c }));

const BLOCK_OPTIONS = [
  { label: 'Paragraph', value: 'p' },
  { label: 'Heading 2', value: 'h2' },
  { label: 'Heading 3', value: 'h3' },
  { label: 'Bullet list', value: 'ul' },
  { label: 'Numbered list', value: 'ol' },
  { label: 'Blockquote', value: 'quote' },
  { label: 'Pro tip', value: 'tip' },
  { label: 'Image', value: 'image' },
];

const BLOCK_ACCENT: Record<string, string> = {
  p: 'border-l-gray-300',
  h2: 'border-l-blue-500',
  h3: 'border-l-blue-300',
  ul: 'border-l-green-500',
  ol: 'border-l-emerald-400',
  quote: 'border-l-amber-400',
  tip: 'border-l-violet-500',
  image: 'border-l-sky-500',
};

const BLOCK_PLACEHOLDER: Record<string, string> = {
  p: 'Write your paragraph…',
  h2: 'Section heading…',
  h3: 'Sub-heading…',
  quote: 'Blockquote text…',
  tip: 'Pro tip text…',
};

const LIST_TYPES = ['ul', 'ol'];

const emptyPost = {
  title: '',
  slug: '',
  excerpt: '',
  category: 'Wine Guide',
  tags: [] as string[],
  image: '',
  imageAlt: '',
  featured: false,
  author: { name: '', role: '', bio: '' },
  content: [{ type: 'p', text: '', items: [] }],
  seo: { metaTitle: '', metaDescription: '', ogImage: '' },
};

function slugify(title: string) {
  return String(title || '')
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function computeReadTime(content: any[]) {
  const blocks = Array.isArray(content) ? content : [];
  const words = blocks.reduce((sum: number, b: any) => {
    if (!b) return sum;
    const itemWords = Array.isArray(b.items)
      ? b.items.reduce(
          (s: number, it: string) =>
            s +
            String(it || '')
              .split(/\s+/)
              .filter(Boolean).length,
          0
        )
      : 0;
    return (
      sum +
      String(b.text || '')
        .split(/\s+/)
        .filter(Boolean).length +
      itemWords
    );
  }, 0);
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

function CharCount({
  value,
  max,
  warn,
}: {
  value: string;
  max: number;
  warn?: number;
}) {
  const threshold = warn ?? Math.round(max * 0.9);
  const len = String(value || '').length;
  const cls =
    len > max
      ? 'text-red-500 font-medium'
      : len > threshold
        ? 'text-amber-500'
        : 'text-gray-400';
  return (
    <span className={`text-xs ${cls}`}>
      {len}/{max}
    </span>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: any;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
        {Icon && <Icon className="h-4 w-4 text-gray-500" />}
        <Text className="font-semibold text-gray-800">{title}</Text>
      </div>
      {children}
    </div>
  );
}

function ImageUploadButton({
  token,
  onUploaded,
  label = 'Upload image',
}: {
  token: string;
  onUploaded: (url: string) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    if (!token) return toast.error('Not authenticated — reload and try again');
    if (!file.type.startsWith('image/'))
      return toast.error('Please choose an image file');
    setBusy(true);
    try {
      const res = await uploadService.uploadImage(file, token, 'blog');
      const url = res?.data?.url;
      if (!url) throw new Error('Upload succeeded but no URL was returned');
      onUploaded(url);
      toast.success('Image uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <PiSpinnerGapBold className="me-1.5 h-4 w-4 animate-spin" />
        ) : (
          <PiUploadSimpleBold className="me-1.5 h-4 w-4" />
        )}
        {busy ? 'Uploading…' : label}
      </Button>
    </>
  );
}

export default function CreateEditBlogPost({ postId }: { postId?: string }) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const token = session?.token || session?.user?.token || '';

  const [post, setPost] = useState(emptyPost);
  const [slugTouched, setSlugTouched] = useState(Boolean(postId));
  const [loading, setLoading] = useState(Boolean(postId));
  const [saving, setSaving] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiCategory, setAiCategory] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [fieldBusy, setFieldBusy] = useState('');
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (!postId || !token) return;
    blogService
      .getPostById(postId, token)
      .then((data) =>
        setPost({
          ...emptyPost,
          ...data,
          author: { ...emptyPost.author, ...(data.author || {}) },
          content: data.content?.length ? data.content : emptyPost.content,
          seo: { ...emptyPost.seo, ...(data.seo || {}) },
        })
      )
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [postId, token]);

  const set = (patch: any) => setPost((p) => ({ ...p, ...patch }));

  const setTitle = (title: string) => {
    set(slugTouched ? { title } : { title, slug: slugify(title) });
  };

  const addTag = (raw: string) => {
    const parts = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (!parts.length) return;
    set({ tags: [...new Set([...post.tags, ...parts])] });
    setTagInput('');
  };

  const removeTag = (tag: string) =>
    set({ tags: post.tags.filter((t: string) => t !== tag) });

  const updateBlock = (i: number, patch: any) =>
    setPost((p) => ({
      ...p,
      content: p.content.map((b: any, j: number) =>
        j === i ? { ...b, ...patch } : b
      ),
    }));

  const addBlock = () =>
    setPost((p) => ({
      ...p,
      content: [...p.content, { type: 'p', text: '', items: [] }],
    }));

  const removeBlock = (i: number) =>
    setPost((p) => ({
      ...p,
      content: p.content.filter((_: any, j: number) => j !== i),
    }));

  const moveBlock = (i: number, dir: number) =>
    setPost((p) => {
      const content = [...p.content];
      const j = i + dir;
      if (j < 0 || j >= content.length) return p;
      [content[i], content[j]] = [content[j], content[i]];
      return { ...p, content };
    });

  const generateFullPost = async () => {
    if (!aiTopic.trim()) return toast.error('Enter a topic first');
    setAiBusy(true);
    try {
      const data = await blogService.generatePost(
        { topic: aiTopic, category: aiCategory || undefined },
        token
      );
      setPost((p) => ({
        ...p,
        title: data.title,
        slug: slugify(data.title),
        excerpt: data.excerpt,
        category: data.category,
        tags: data.tags,
        content: data.content?.length ? data.content : p.content,
        author: data.author?.name ? data.author : p.author,
      }));
      setSlugTouched(false);
      toast.success('Draft generated — review before saving');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAiBusy(false);
    }
  };

  const regenerateField = async (field: string) => {
    setFieldBusy(field);
    try {
      const { value } = await blogService.generateField({ field, post }, token);
      if (field === 'tags') set({ tags: Array.isArray(value) ? value : [] });
      else set({ [field]: String(value || '') });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setFieldBusy('');
    }
  };

  const save = async (status: string) => {
    if (!post.title.trim()) return toast.error('Title is required');
    setSaving(true);
    try {
      const payload = { ...post, status };
      if (postId) await blogService.updatePost(postId, payload, token);
      else await blogService.createPost(payload, token);
      toast.success(status === 'published' ? 'Post published' : 'Draft saved');
      router.push(routes.blog.list);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const liveReadTime = computeReadTime(post.content);
  const previewTitle =
    post.seo?.metaTitle ||
    (post.title ? `${post.title} | DrinksHarbour Blog` : '');
  const previewDesc = post.seo?.metaDescription || post.excerpt;

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-28">
      {/* ─── AI bar ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 p-5">
        <div className="mb-3 flex items-center gap-2">
          <PiSparkleBold className="h-5 w-5 text-violet-600" />
          <Text className="font-semibold text-violet-800">
            Generate with AI · Haiku
          </Text>
          <span className="ms-auto rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-600">
            Beta
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Topic"
            placeholder="e.g. Best champagnes for Nigerian weddings"
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generateFullPost()}
            className="min-w-64 flex-1"
          />
          <Select
            label="Category (optional)"
            options={[
              { label: 'Let AI choose', value: '' },
              ...CATEGORY_OPTIONS,
            ]}
            value={aiCategory}
            onChange={(v) => setAiCategory(v?.value ?? v ?? '')}
            getOptionValue={(o) => o.value}
            displayValue={(v) => (v ? v : 'Let AI choose')}
            className="w-52"
          />
          <Button
            onClick={generateFullPost}
            isLoading={aiBusy}
            className="bg-violet-600 hover:bg-violet-700"
          >
            <PiSparkleBold className="me-1.5 h-4 w-4" /> Generate full post
          </Button>
        </div>
      </div>

      {/* ─── Post details ────────────────────────────────────── */}
      <SectionCard title="Post Details" icon={PiArticleBold}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Title */}
          <div className="md:col-span-2">
            <Input
              label="Title *"
              placeholder="Enter a compelling post title"
              value={post.title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Slug */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              URL slug
            </label>
            <div className="relative">
              <Input
                value={post.slug}
                placeholder="auto-generated from title"
                onChange={(e) => {
                  setSlugTouched(true);
                  set({ slug: e.target.value });
                }}
                prefix="/blog/"
                className="pe-9"
              />
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                title={
                  slugTouched
                    ? 'Slug locked — you edited it manually'
                    : 'Slug auto-syncs with title'
                }
              >
                {slugTouched ? (
                  <PiLockSimpleBold className="h-4 w-4" />
                ) : (
                  <PiLockSimpleOpenBold className="h-4 w-4" />
                )}
              </span>
            </div>
          </div>

          {/* Category */}
          <Select
            label="Category"
            options={CATEGORY_OPTIONS}
            value={post.category}
            onChange={(v) => set({ category: v?.value ?? v })}
            getOptionValue={(o) => o.value}
            displayValue={(v) => v}
          />

          {/* Excerpt */}
          <div className="md:col-span-2">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Excerpt
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  Target 120–160 chars
                </span>
                <CharCount value={post.excerpt} max={160} warn={145} />
                <ActionIcon
                  size="sm"
                  variant="text"
                  className="text-violet-600"
                  title="Regenerate excerpt with AI"
                  isLoading={fieldBusy === 'excerpt'}
                  onClick={() => regenerateField('excerpt')}
                >
                  <PiSparkleBold className="h-4 w-4" />
                </ActionIcon>
              </div>
            </div>
            <Textarea
              rows={3}
              placeholder="A short summary shown in search results and social shares…"
              value={post.excerpt}
              onChange={(e) => set({ excerpt: e.target.value })}
            />
          </div>

          {/* Tag chips */}
          <div className="md:col-span-2">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <PiTagBold className="h-3.5 w-3.5" /> Tags
              </label>
              <ActionIcon
                size="sm"
                variant="text"
                className="text-violet-600"
                title="Regenerate tags with AI"
                isLoading={fieldBusy === 'tags'}
                onClick={() => regenerateField('tags')}
              >
                <PiSparkleBold className="h-4 w-4" />
              </ActionIcon>
            </div>
            <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 transition focus-within:border-violet-400 focus-within:ring-1 focus-within:ring-violet-400">
              {post.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-violet-400 hover:text-violet-700"
                  >
                    <PiXBold className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                  if (e.key === 'Backspace' && !tagInput && post.tags.length) {
                    removeTag(post.tags[post.tags.length - 1]);
                  }
                }}
                onBlur={() => tagInput.trim() && addTag(tagInput)}
                placeholder={post.tags.length ? '' : 'Type tag + Enter to add…'}
                className="min-w-[140px] flex-1 border-none bg-transparent text-sm outline-none placeholder:text-gray-400"
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Press Enter or comma to add · Backspace removes the last tag
            </p>
          </div>

          {/* Featured */}
          <div className="flex items-center gap-2">
            <Switch
              label="Featured post"
              checked={post.featured}
              onChange={(e) => set({ featured: e.target.checked })}
            />
            {post.featured && <PiStarBold className="h-4 w-4 text-amber-400" />}
          </div>
        </div>
      </SectionCard>

      {/* ─── Cover image ─────────────────────────────────────── */}
      <SectionCard title="Cover Image" icon={PiImageBold}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Image URL
              </label>
              <ImageUploadButton
                token={token}
                label="Upload"
                onUploaded={(url) => set({ image: url })}
              />
            </div>
            <Input
              placeholder="https://… or upload a file"
              value={post.image}
              onChange={(e) => set({ image: e.target.value })}
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Alt text
              </label>
              <CharCount value={post.imageAlt} max={125} warn={100} />
            </div>
            <Input
              placeholder="Describe the image for screen readers & SEO"
              value={post.imageAlt || ''}
              onChange={(e) => set({ imageAlt: e.target.value })}
            />
          </div>
        </div>
        {post.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image}
            alt={post.imageAlt || 'Cover preview'}
            className="mt-4 h-48 w-full rounded-xl object-cover"
          />
        ) : (
          <div className="mt-4 flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
            <div className="text-center text-gray-400">
              <PiImageBold className="mx-auto mb-2 h-8 w-8" />
              <p className="text-sm">Paste an image URL above to preview</p>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ─── Author ──────────────────────────────────────────── */}
      <SectionCard title="Author" icon={PiUserBold}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            className="md:col-span-2"
          />
        </div>
      </SectionCard>

      {/* ─── Content blocks ──────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
          <PiArticleBold className="h-4 w-4 text-gray-500" />
          <Text className="font-semibold text-gray-800">Content</Text>
          <span className="ms-auto flex items-center gap-1 text-xs text-gray-400">
            <PiClockBold className="h-3.5 w-3.5" />
            {liveReadTime}
          </span>
        </div>

        <p className="-mt-2 mb-4 text-xs text-gray-400">
          Formatting: link with{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px] text-gray-600">
            [anchor](/product/slug)
          </code>
          , bold with{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px] text-gray-600">
            **text**
          </code>
          , italic with{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px] text-gray-600">
            *text*
          </code>
          . Add an <span className="font-medium text-gray-500">Image</span> block
          to place photos between paragraphs.
        </p>

        <div className="space-y-3">
          {post.content.map((block: any, i: number) => (
            <div
              key={i}
              className={`rounded-xl border border-l-4 border-gray-100 bg-gray-50/60 p-3 ${BLOCK_ACCENT[block.type] ?? 'border-l-gray-300'}`}
            >
              <div className="mb-2 flex items-center gap-2">
                <Select
                  options={BLOCK_OPTIONS}
                  value={block.type}
                  onChange={(v) => updateBlock(i, { type: v?.value ?? v })}
                  getOptionValue={(o) => o.value}
                  displayValue={(v) =>
                    BLOCK_OPTIONS.find((o) => o.value === v)?.label ?? v
                  }
                  className="w-44"
                  size="sm"
                />
                <span className="ms-auto flex items-center gap-1">
                  <ActionIcon
                    size="sm"
                    variant="text"
                    onClick={() => moveBlock(i, -1)}
                    title="Move up"
                    disabled={i === 0}
                  >
                    <PiArrowUpBold className="h-4 w-4" />
                  </ActionIcon>
                  <ActionIcon
                    size="sm"
                    variant="text"
                    onClick={() => moveBlock(i, 1)}
                    title="Move down"
                    disabled={i === post.content.length - 1}
                  >
                    <PiArrowDownBold className="h-4 w-4" />
                  </ActionIcon>
                  <ActionIcon
                    size="sm"
                    variant="text"
                    color="danger"
                    onClick={() => removeBlock(i)}
                    title="Remove block"
                  >
                    <PiTrashBold className="h-4 w-4" />
                  </ActionIcon>
                </span>
              </div>

              {block.type === 'image' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-medium text-gray-500">
                      Image URL
                    </label>
                    <ImageUploadButton
                      token={token}
                      label="Upload"
                      onUploaded={(url) => updateBlock(i, { src: url })}
                    />
                  </div>
                  <Input
                    size="sm"
                    placeholder="https://… or upload a file"
                    value={block.src || ''}
                    onChange={(e) => updateBlock(i, { src: e.target.value })}
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input
                      size="sm"
                      placeholder="Alt text (accessibility & SEO)"
                      value={block.alt || ''}
                      onChange={(e) => updateBlock(i, { alt: e.target.value })}
                    />
                    <Input
                      size="sm"
                      placeholder="Caption (optional)"
                      value={block.caption || ''}
                      onChange={(e) =>
                        updateBlock(i, { caption: e.target.value })
                      }
                    />
                  </div>
                  {block.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={block.src}
                      alt={block.alt || 'Block image preview'}
                      className="mt-1 h-40 w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-white text-xs text-gray-400">
                      Upload or paste an image URL
                    </div>
                  )}
                </div>
              ) : LIST_TYPES.includes(block.type) ? (
                <Textarea
                  rows={3}
                  placeholder="One list item per line"
                  value={(block.items || []).join('\n')}
                  onChange={(e) =>
                    updateBlock(i, { items: e.target.value.split('\n') })
                  }
                />
              ) : (
                <Textarea
                  rows={block.type === 'p' ? 4 : 2}
                  placeholder={BLOCK_PLACEHOLDER[block.type] ?? 'Text…'}
                  value={block.text || ''}
                  onChange={(e) => updateBlock(i, { text: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>

        <Button variant="outline" className="mt-4" onClick={addBlock}>
          <PiPlusBold className="me-1.5 h-4 w-4" /> Add block
        </Button>
      </div>

      {/* ─── SEO & Meta ──────────────────────────────────────── */}
      <SectionCard title="SEO & Meta" icon={PiMagnifyingGlassBold}>
        <p className="mb-4 text-sm text-gray-500">
          Override what search engines and social platforms display. Leave blank
          to inherit from the post title and excerpt.
        </p>

        <div className="grid grid-cols-1 gap-4">
          {/* Meta title */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Meta title
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  Target 50–60 chars
                </span>
                <CharCount value={post.seo?.metaTitle} max={60} warn={55} />
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

          {/* Meta description */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Meta description
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  Target 150–160 chars
                </span>
                <CharCount
                  value={post.seo?.metaDescription}
                  max={160}
                  warn={145}
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
            />
          </div>

          {/* OG image */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Social / OG image URL
              </label>
              <ImageUploadButton
                token={token}
                label="Upload"
                onUploaded={(url) =>
                  set({ seo: { ...post.seo, ogImage: url } })
                }
              />
            </div>
            <Input
              placeholder={
                post.image ||
                'Defaults to cover image · 1200×630 px recommended'
              }
              value={post.seo?.ogImage || ''}
              onChange={(e) =>
                set({ seo: { ...post.seo, ogImage: e.target.value } })
              }
            />
            {post.seo?.ogImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.seo.ogImage}
                alt="OG image preview"
                className="mt-3 h-40 w-full rounded-xl object-cover"
              />
            ) : null}
          </div>
        </div>

        {/* Google SERP preview */}
        {(post.title || post.seo?.metaTitle) && (
          <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
              Google preview
            </p>
            <p className="text-xs text-green-700">
              drinksharbour.com › blog › {post.slug || '…'}
            </p>
            <p className="mt-0.5 truncate text-[17px] font-medium leading-snug text-blue-700">
              {previewTitle || '…'}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-gray-600">
              {previewDesc || 'No description yet.'}
            </p>
          </div>
        )}
      </SectionCard>

      {/* ─── Sticky action bar ───────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-100 bg-white/90 px-6 py-3 shadow-xl backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <p className="hidden truncate text-sm text-gray-400 sm:block">
            {post.title
              ? `"${post.title.slice(0, 48)}${post.title.length > 48 ? '…' : ''}"`
              : 'Untitled post'}
          </p>
          <div className="ms-auto flex items-center gap-3">
            <Button
              variant="outline"
              isLoading={saving}
              onClick={() => save('draft')}
            >
              <PiFloppyDiskBold className="me-1.5 h-4 w-4" /> Save Draft
            </Button>
            <Button isLoading={saving} onClick={() => save('published')}>
              <PiRocketLaunchBold className="me-1.5 h-4 w-4" /> Publish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
