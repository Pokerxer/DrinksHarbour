// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
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
} from 'react-icons/pi';
import { blogService } from '@/services/blog.service';
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
  { label: 'Heading (H2)', value: 'h2' },
  { label: 'Subheading (H3)', value: 'h3' },
  { label: 'Bullet list', value: 'ul' },
  { label: 'Numbered list', value: 'ol' },
  { label: 'Quote', value: 'quote' },
  { label: 'Pro tip', value: 'tip' },
];
const LIST_TYPES = ['ul', 'ol'];

const emptyPost = {
  title: '',
  slug: '',
  excerpt: '',
  category: 'Wine Guide',
  tags: [],
  image: '',
  featured: false,
  author: { name: '', role: '', bio: '' },
  content: [{ type: 'p', text: '', items: [] }],
};

function slugify(title) {
  return String(title || '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
        })
      )
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [postId, token]);

  const set = (patch) => setPost((p) => ({ ...p, ...patch }));

  const setTitle = (title) => {
    set(slugTouched ? { title } : { title, slug: slugify(title) });
  };

  const updateBlock = (i, patch) =>
    setPost((p) => ({
      ...p,
      content: p.content.map((b, j) => (j === i ? { ...b, ...patch } : b)),
    }));
  const addBlock = () =>
    setPost((p) => ({
      ...p,
      content: [...p.content, { type: 'p', text: '', items: [] }],
    }));
  const removeBlock = (i) =>
    setPost((p) => ({ ...p, content: p.content.filter((_, j) => j !== i) }));
  const moveBlock = (i, dir) =>
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
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAiBusy(false);
    }
  };

  const regenerateField = async (field) => {
    setFieldBusy(field);
    try {
      const { value } = await blogService.generateField({ field, post }, token);
      if (field === 'tags') set({ tags: Array.isArray(value) ? value : [] });
      else set({ [field]: String(value || '') });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setFieldBusy('');
    }
  };

  const save = async (status) => {
    if (!post.title.trim()) return toast.error('Title is required');
    setSaving(true);
    try {
      const payload = { ...post, status };
      if (postId) await blogService.updatePost(postId, payload, token);
      else await blogService.createPost(payload, token);
      toast.success(status === 'published' ? 'Post published' : 'Draft saved');
      router.push(routes.blog.list);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />;
  }

  return (
    <div className="space-y-6 pb-24">
      {/* AI bar */}
      <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
        <Text className="mb-3 flex items-center gap-2 font-semibold text-violet-800">
          <PiSparkleBold /> Generate with AI (Haiku)
        </Text>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Topic"
            placeholder="e.g. Best champagnes for Nigerian weddings"
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
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
          <Button onClick={generateFullPost} isLoading={aiBusy}>
            <PiSparkleBold className="me-1.5 h-4 w-4" /> Generate full post
          </Button>
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:grid-cols-2">
        <Input
          label="Title"
          value={post.title}
          onChange={(e) => setTitle(e.target.value)}
          className="md:col-span-2"
        />
        <Input
          label="Slug"
          value={post.slug}
          onChange={(e) => {
            setSlugTouched(true);
            set({ slug: e.target.value });
          }}
          prefix="/blog/"
        />
        <Select
          label="Category"
          options={CATEGORY_OPTIONS}
          value={post.category}
          onChange={(v) => set({ category: v?.value ?? v })}
          getOptionValue={(o) => o.value}
          displayValue={(v) => v}
        />
        <div className="relative md:col-span-2">
          <Textarea
            label="Excerpt"
            rows={2}
            value={post.excerpt}
            onChange={(e) => set({ excerpt: e.target.value })}
          />
          <ActionIcon
            size="sm"
            variant="text"
            className="absolute right-1 top-7 text-violet-600"
            title="Regenerate excerpt with AI"
            isLoading={fieldBusy === 'excerpt'}
            onClick={() => regenerateField('excerpt')}
          >
            <PiSparkleBold className="h-4 w-4" />
          </ActionIcon>
        </div>
        <div className="relative">
          <Input
            label="Tags (comma-separated)"
            value={post.tags.join(', ')}
            onChange={(e) =>
              set({
                tags: e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
          />
          <ActionIcon
            size="sm"
            variant="text"
            className="absolute right-1 top-7 text-violet-600"
            title="Regenerate tags with AI"
            isLoading={fieldBusy === 'tags'}
            onClick={() => regenerateField('tags')}
          >
            <PiSparkleBold className="h-4 w-4" />
          </ActionIcon>
        </div>
        <Input
          label="Cover image URL"
          value={post.image}
          onChange={(e) => set({ image: e.target.value })}
        />
        {post.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image}
            alt="Cover preview"
            className="h-32 w-full rounded-xl object-cover md:col-span-2"
          />
        ) : null}
        <Input
          label="Author name"
          value={post.author.name}
          onChange={(e) =>
            set({ author: { ...post.author, name: e.target.value } })
          }
        />
        <Input
          label="Author role"
          value={post.author.role}
          onChange={(e) =>
            set({ author: { ...post.author, role: e.target.value } })
          }
        />
        <Textarea
          label="Author bio"
          rows={2}
          value={post.author.bio}
          onChange={(e) =>
            set({ author: { ...post.author, bio: e.target.value } })
          }
          className="md:col-span-2"
        />
        <Switch
          label="Featured post"
          checked={post.featured}
          onChange={(e) => set({ featured: e.target.checked })}
        />
      </div>

      {/* Content blocks */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <Text className="mb-4 font-semibold text-gray-900">Content</Text>
        <div className="space-y-4">
          {post.content.map((block, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-100 bg-gray-50/50 p-3"
            >
              <div className="mb-2 flex items-center gap-2">
                <Select
                  options={BLOCK_OPTIONS}
                  value={block.type}
                  onChange={(v) => updateBlock(i, { type: v?.value ?? v })}
                  getOptionValue={(o) => o.value}
                  displayValue={(v) =>
                    BLOCK_OPTIONS.find((o) => o.value === v)?.label
                  }
                  className="w-44"
                  size="sm"
                />
                <div className="ms-auto flex items-center gap-1">
                  <ActionIcon
                    size="sm"
                    variant="text"
                    onClick={() => moveBlock(i, -1)}
                    title="Move up"
                  >
                    <PiArrowUpBold className="h-4 w-4" />
                  </ActionIcon>
                  <ActionIcon
                    size="sm"
                    variant="text"
                    onClick={() => moveBlock(i, 1)}
                    title="Move down"
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
                </div>
              </div>
              {LIST_TYPES.includes(block.type) ? (
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
                  rows={block.type === 'p' ? 3 : 1}
                  placeholder={block.type === 'tip' ? 'Pro tip text…' : 'Text…'}
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

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          isLoading={saving}
          onClick={() => save('draft')}
        >
          Save Draft
        </Button>
        <Button isLoading={saving} onClick={() => save('published')}>
          Publish
        </Button>
      </div>
    </div>
  );
}
