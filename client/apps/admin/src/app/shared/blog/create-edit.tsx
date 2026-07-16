'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiFloppyDiskBold,
  PiRocketLaunchBold,
  PiClockBold,
  PiPencilSimpleBold,
  PiEyeBold,
  PiArticleBold,
  PiCircleBold,
  PiWarningBold,
} from 'react-icons/pi';
import { blogService } from '@/services/blog.service';
import { routes } from '@/config/routes';
import {
  emptyPost,
  slugify,
  computeReadTime,
  countWordsInContent,
  makeBlock,
  type ContentBlock,
} from './blog-helpers';
import AiBar from './ai-bar';
import PostDetailsPanel from './post-details-panel';
import ContentBlockEditor from './content-block-editor';
import BlogPreview from './blog-preview';
import { SectionCard, StatusPill } from './editor-primitives';
import { CoverImageCard, AuthorCard, SeoCard } from './sidebar-cards';

type View = 'write' | 'preview';

const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  excerpt: 'Excerpt',
  tags: 'Tags',
  seoTitle: 'SEO title',
  seoDescription: 'SEO description',
  imageAlt: 'Alt text',
  seo: 'SEO metadata',
};
function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

export default function CreateEditBlogPost({ postId }: { postId?: string }) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const token = (session as any)?.token || (session as any)?.user?.token || '';

  const [post, setPost] = useState<any>(emptyPost);
  const [initialStatus, setInitialStatus] = useState<string>('');
  const [slugTouched, setSlugTouched] = useState(Boolean(postId));
  const [loading, setLoading] = useState(Boolean(postId));
  const [saving, setSaving] = useState(false);
  const [fieldBusy, setFieldBusy] = useState('');
  const [view, setView] = useState<View>('write');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!postId || !token) return;
    blogService
      .getPostById(postId, token)
      .then((data: any) => {
        setPost({
          ...emptyPost,
          ...data,
          author: { ...emptyPost.author, ...(data.author || {}) },
          content: data.content?.length ? data.content : emptyPost.content,
          seo: { ...emptyPost.seo, ...(data.seo || {}) },
        });
        setInitialStatus(data.status || 'draft');
        setDirty(false);
      })
      .catch((err: any) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [postId, token]);

  // Track dirty state for the unsaved hint in the action bar.
  const set = (patch: any) => {
    setPost((p: any) => ({ ...p, ...patch }));
    setDirty(true);
  };

  const setTitle = (title: string) => {
    set(slugTouched ? { title } : { title, slug: slugify(title) });
  };

  const updateBlock = (i: number, patch: Partial<ContentBlock>) => {
    setPost((p: any) => ({
      ...p,
      content: p.content.map((b: ContentBlock, j: number) =>
        j === i ? { ...b, ...patch } : b
      ),
    }));
    setDirty(true);
  };

  const addBlock = () => {
    setPost((p: any) => ({
      ...p,
      content: [...p.content, makeBlock('p')],
    }));
    setDirty(true);
  };

  const removeBlock = (i: number) => {
    setPost((p: any) => ({
      ...p,
      content: p.content.filter((_: any, j: number) => j !== i),
    }));
    setDirty(true);
  };

  const moveBlock = (i: number, dir: number) =>
    setPost((p: any) => {
      const content = [...p.content];
      const j = i + dir;
      if (j < 0 || j >= content.length) return p;
      [content[i], content[j]] = [content[j], content[i]];
      return { ...p, content };
    });

  const reorderBlock = (from: number, to: number) =>
    setPost((p: any) => {
      const content = [...p.content];
      const [moved] = content.splice(from, 1);
      content.splice(to, 0, moved);
      return { ...p, content };
    });

  const hasExistingContent = useMemo(
    () =>
      Boolean(post.title || post.excerpt || post.tags.length) ||
      post.content.some(
        (b: ContentBlock) => b.text || b.src || b.items?.length
      ),
    [post.title, post.excerpt, post.tags, post.content]
  );

  const applyAi = (data: any) => {
    const overwrite = () => {
      setPost((p: any) => ({
        ...p,
        title: data.title,
        slug: slugify(data.title),
        excerpt: data.excerpt,
        category: data.category,
        tags: data.tags,
        imageAlt: data.imageAlt || p.imageAlt,
        seo: {
          metaTitle: data.seo?.metaTitle || p.seo?.metaTitle || '',
          metaDescription:
            data.seo?.metaDescription || p.seo?.metaDescription || '',
          ogImage: p.seo?.ogImage || '',
        },
        content: data.content?.length ? data.content : p.content,
        author: data.author?.name ? data.author : p.author,
      }));
      setSlugTouched(false);
      setDirty(true);
      setView('write');
      toast.success('Draft generated — review before saving');
    };

    if (hasExistingContent) {
      // Confirm before clobbering work the editor may have already done.
      if (
        window.confirm(
          'Generating a new draft will replace the current title, content, tags, and SEO. Continue?'
        )
      ) {
        overwrite();
      }
      return;
    }
    overwrite();
  };

  const regenerateField = async (field: string) => {
    setFieldBusy(field);
    try {
      if (field === 'seoTitle' || field === 'seoDescription') {
        // Generate both SEO fields as a coherent pair.
        const seo: any = await blogService.generateSeo({ post }, token);
        set({
          seo: {
            ...post.seo,
            metaTitle: seo.metaTitle || post.seo?.metaTitle || '',
            metaDescription:
              seo.metaDescription || post.seo?.metaDescription || '',
          },
        });
      } else {
        const res: any = await blogService.generateField(
          { field: field as any, post } as any,
          token
        );
        const value = res?.value;
        if (field === 'tags') set({ tags: Array.isArray(value) ? value : [] });
        else if (field === 'imageAlt') set({ imageAlt: String(value || '') });
        else set({ [field]: String(value || '') });
      }
      toast.success(`${fieldLabel(field)} updated`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setFieldBusy('');
    }
  };

  const generateSeo = async () => {
    if (!post.title.trim() && !post.content.some((b: ContentBlock) => b.text)) {
      return toast.error('Write a title or some content first');
    }
    setFieldBusy('seo');
    try {
      const seo: any = await blogService.generateSeo({ post }, token);
      set({
        seo: {
          ...post.seo,
          metaTitle: seo.metaTitle || post.seo?.metaTitle || '',
          metaDescription:
            seo.metaDescription || post.seo?.metaDescription || '',
        },
      });
      toast.success('SEO metadata generated');
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
      setDirty(false);
      setInitialStatus(status);
      toast.success(status === 'published' ? 'Post published' : 'Draft saved');
      router.push(routes.blog.list);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const liveReadTime = computeReadTime(post.content);
  const wordCount = countWordsInContent(post.content);
  const previewTitle =
    post.seo?.metaTitle ||
    (post.title ? `${post.title} | DrinksHarbour Blog` : '');
  const previewDesc = post.seo?.metaDescription || post.excerpt;
  const currentStatus = post.status || initialStatus || 'draft';

  const blockCount = useMemo(() => post.content.length, [post.content]);

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-2xl bg-gray-100"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-28">
      <AiBar token={token} onApply={applyAi} />

      <PostDetailsPanel
        post={post}
        slugTouched={slugTouched}
        setSlugTouched={setSlugTouched}
        set={set}
        setTitle={setTitle}
        fieldBusy={fieldBusy}
        regenerateField={regenerateField}
      />

      {/* Content editor — full width with Write/Preview tabs */}
      <SectionCard
        title="Content"
        description="Compose your article with blocks. Drag to reorder, use the toolbar to format."
        icon={PiArticleBold}
        right={
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-xs text-gray-400 sm:flex">
              <PiClockBold className="h-3.5 w-3.5" />
              {liveReadTime}
              <span className="text-gray-200">·</span>
              {wordCount} words
              <span className="text-gray-200">·</span>
              {blockCount} blocks
            </span>
            <div className="flex items-center rounded-lg bg-gray-100 p-0.5">
              <button
                type="button"
                onClick={() => setView('write')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition',
                  view === 'write'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                )}
              >
                <PiPencilSimpleBold className="h-3.5 w-3.5" /> Write
              </button>
              <button
                type="button"
                onClick={() => setView('preview')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition',
                  view === 'preview'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                )}
              >
                <PiEyeBold className="h-3.5 w-3.5" /> Preview
              </button>
            </div>
          </div>
        }
      >
        {view === 'write' ? (
          <ContentBlockEditor
            content={post.content}
            token={token}
            postMeta={{ title: post.title, category: post.category }}
            onUpdate={updateBlock}
            onAdd={addBlock}
            onRemove={removeBlock}
            onMove={moveBlock}
            onReorder={reorderBlock}
          />
        ) : (
          <BlogPreview
            title={post.title}
            excerpt={post.excerpt}
            content={post.content}
            author={post.author}
          />
        )}
      </SectionCard>

      {/* Sidebar grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <CoverImageCard
          post={post}
          set={set}
          token={token}
          fieldBusy={fieldBusy}
          onRegenerate={regenerateField}
        />
        <AuthorCard post={post} set={set} />
        <div className="lg:col-span-2">
          <SeoCard
            post={post}
            set={set}
            token={token}
            previewTitle={previewTitle}
            previewDesc={previewDesc}
            fieldBusy={fieldBusy}
            onRegenerate={regenerateField}
            onGenerateSeo={generateSeo}
          />
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white/95 px-6 py-3 shadow-[0_-4px_16px_rgba(16,24,40,0.06)] backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <StatusPill status={currentStatus} />
          <div className="hidden h-5 w-px bg-gray-200 sm:block" />
          <p className="hidden min-w-0 truncate text-sm text-gray-500 sm:block">
            {post.title
              ? `"${post.title.slice(0, 42)}${post.title.length > 42 ? '…' : ''}"`
              : 'Untitled post'}
          </p>
          {dirty ? (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
              <PiWarningBold className="h-3.5 w-3.5" /> Unsaved
            </span>
          ) : (
            <span className="hidden items-center gap-1 text-xs text-gray-400 sm:flex">
              <PiCircleBold className="h-3 w-3 text-emerald-500" /> All changes
              saved
            </span>
          )}
          <div className="ms-auto flex items-center gap-2.5">
            <Button
              variant="outline"
              isLoading={saving}
              onClick={() => save('draft')}
              className="border-gray-200"
            >
              <PiFloppyDiskBold className="me-1.5 h-4 w-4" /> Save Draft
            </Button>
            <Button
              isLoading={saving}
              onClick={() => save('published')}
              className="bg-gray-900 hover:bg-gray-800"
            >
              <PiRocketLaunchBold className="me-1.5 h-4 w-4" /> Publish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
