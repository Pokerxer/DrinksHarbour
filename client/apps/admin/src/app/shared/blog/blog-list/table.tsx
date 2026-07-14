// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Text, Badge, Button, Select, ActionIcon, Popover, Input } from 'rizzui';
import {
  PiPencilSimpleBold,
  PiTrashBold,
  PiEyeBold,
  PiEyeSlashBold,
  PiArrowsClockwiseBold,
  PiStarFill,
  PiWarningBold,
  PiMagnifyingGlassBold,
  PiClockBold,
  PiArrowSquareOutBold,
} from 'react-icons/pi';
import { blogService } from '@/services/blog.service';
import { routes } from '@/config/routes';

const PLATFORM_URL = process.env.NEXT_PUBLIC_PLATFORM_URL || 'http://localhost:3000';

const CATEGORY_OPTIONS = [
  { label: 'All categories', value: '' },
  { label: 'Wine Guide', value: 'Wine Guide' },
  { label: 'Spirits Guide', value: 'Spirits Guide' },
  { label: 'Beer Guide', value: 'Beer Guide' },
  { label: 'Recipes', value: 'Recipes' },
  { label: 'Entertaining', value: 'Entertaining' },
  { label: 'Lifestyle', value: 'Lifestyle' },
];

const STATUS_OPTIONS = [
  { label: 'All statuses', value: '' },
  { label: 'Published', value: 'published' },
  { label: 'Draft', value: 'draft' },
];

const CATEGORY_COLORS: Record<string, string> = {
  'Wine Guide':    'bg-purple-100 text-purple-700',
  'Spirits Guide': 'bg-amber-100 text-amber-700',
  'Beer Guide':    'bg-yellow-100 text-yellow-700',
  'Recipes':       'bg-orange-100 text-orange-700',
  'Entertaining':  'bg-pink-100 text-pink-700',
  'Lifestyle':     'bg-teal-100 text-teal-700',
};

export default function BlogPostsTable() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const token = session?.token || session?.user?.token || '';

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const fetchPosts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = { limit: '200' };
      if (category) params.category = category;
      if (status) params.status = status;
      const data = await blogService.getPosts(token, params);
      setPosts(data.posts || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [token, category, status]);

  useEffect(() => {
    if (sessionStatus === 'authenticated') fetchPosts();
  }, [sessionStatus, fetchPosts]);

  const toggleStatus = async (post: any) => {
    const next = post.status === 'published' ? 'draft' : 'published';
    try {
      await blogService.setStatus(post._id, next, token);
      toast.success(next === 'published' ? 'Post published' : 'Post unpublished');
      fetchPosts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const removePost = async (post: any) => {
    try {
      await blogService.deletePost(post._id, token);
      toast.success('Post deleted');
      fetchPosts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const visible = posts.filter((p: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.title?.toLowerCase().includes(q) ||
      p.excerpt?.toLowerCase().includes(q) ||
      p.tags?.some((t: string) => t.toLowerCase().includes(q))
    );
  });

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="h-20 w-28 flex-shrink-0 animate-pulse rounded-xl bg-gray-200" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 w-3/5 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-2/5 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-white p-12 text-center">
        <PiWarningBold className="mx-auto mb-4 h-10 w-10 text-red-500" />
        <Text className="mb-2 text-lg font-bold text-red-600">Failed to load posts</Text>
        <Text className="mb-6 text-gray-500">{error}</Text>
        <Button onClick={fetchPosts}>
          <PiArrowsClockwiseBold className="me-1.5 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <PiMagnifyingGlassBold className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search posts…"
            className="ps-9"
          />
        </div>
        <Select
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={(v) => setCategory(v?.value ?? v ?? '')}
          getOptionValue={(o) => o.value}
          displayValue={(v) => CATEGORY_OPTIONS.find((o) => o.value === v)?.label ?? 'Category'}
          placeholder="Category"
          className="w-48"
        />
        <Select
          options={STATUS_OPTIONS}
          value={status}
          onChange={(v) => setStatus(v?.value ?? v ?? '')}
          getOptionValue={(o) => o.value}
          displayValue={(v) => STATUS_OPTIONS.find((o) => o.value === v)?.label ?? 'Status'}
          placeholder="Status"
          className="w-40"
        />
        <Text className="ms-auto whitespace-nowrap text-sm text-gray-400">
          {visible.length} / {posts.length} posts
        </Text>
      </div>

      {/* Empty state */}
      {visible.length === 0 ? (
        <div className="rounded-3xl border border-gray-100 bg-white p-12 text-center">
          <Text className="mb-2 text-lg font-bold text-gray-700">
            {posts.length === 0 ? 'No posts yet' : 'No posts match your filters'}
          </Text>
          <Text className="mb-6 text-gray-500">
            {posts.length === 0
              ? 'Create your first post — or generate one with AI.'
              : 'Try adjusting the filters above.'}
          </Text>
          {posts.length === 0 && (
            <Link href={routes.blog.create}>
              <Button as="span">Add Post</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((post: any) => (
            <div
              key={post._id}
              className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Thumbnail */}
              <div className="relative h-20 w-28 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100">
                {post.image ? (
                  <Image
                    src={post.image}
                    alt={post.imageAlt || post.title || ''}
                    fill
                    sizes="112px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-300 text-xs text-center px-1">
                    No image
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="min-w-0 flex-1">
                {/* Title row */}
                <div className="flex flex-wrap items-start gap-2">
                  <Text className="line-clamp-1 font-semibold text-gray-900">
                    {post.title}
                  </Text>
                  {post.featured && (
                    <PiStarFill className="h-4 w-4 flex-shrink-0 text-amber-400" title="Featured" />
                  )}
                  <Badge
                    color={post.status === 'published' ? 'success' : 'secondary'}
                    variant="flat"
                    className="ms-auto flex-shrink-0"
                  >
                    {post.status}
                  </Badge>
                </div>

                {/* Excerpt */}
                {post.excerpt && (
                  <Text className="mt-1 line-clamp-1 text-sm text-gray-500">
                    {post.excerpt}
                  </Text>
                )}

                {/* Meta row */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[post.category] || 'bg-gray-100 text-gray-600'}`}>
                    {post.category}
                  </span>
                  {post.readTime && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <PiClockBold className="h-3.5 w-3.5" /> {post.readTime}
                    </span>
                  )}
                  {post.tags?.slice(0, 3).map((tag: string) => (
                    <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      {tag}
                    </span>
                  ))}
                  {post.tags?.length > 3 && (
                    <span className="text-xs text-gray-400">+{post.tags.length - 3}</span>
                  )}
                  {post.publishedAt && (
                    <span className="ms-auto text-xs text-gray-400">
                      {new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-shrink-0 flex-col items-center justify-center gap-1.5">
                <ActionIcon
                  size="sm"
                  variant="outline"
                  title={post.status === 'published' ? 'Unpublish' : 'Publish'}
                  onClick={() => toggleStatus(post)}
                >
                  {post.status === 'published'
                    ? <PiEyeSlashBold className="h-4 w-4" />
                    : <PiEyeBold className="h-4 w-4" />}
                </ActionIcon>
                <ActionIcon
                  size="sm"
                  variant="outline"
                  title="Edit"
                  onClick={() => router.push(routes.blog.edit(post._id))}
                >
                  <PiPencilSimpleBold className="h-4 w-4" />
                </ActionIcon>
                {post.status === 'published' && (
                  <a
                    href={`${PLATFORM_URL}/blog/${post.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View on site"
                  >
                    <ActionIcon size="sm" variant="outline" as="span">
                      <PiArrowSquareOutBold className="h-4 w-4" />
                    </ActionIcon>
                  </a>
                )}
                <Popover placement="left">
                  <Popover.Trigger>
                    <ActionIcon size="sm" variant="outline" color="danger" title="Delete">
                      <PiTrashBold className="h-4 w-4" />
                    </ActionIcon>
                  </Popover.Trigger>
                  <Popover.Content>
                    {({ setOpen }: any) => (
                      <div className="w-56 p-1 text-center">
                        <Text className="mb-1 font-semibold">Delete this post?</Text>
                        <Text className="mb-3 text-xs text-gray-500 line-clamp-1">{post.title}</Text>
                        <div className="flex justify-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            color="danger"
                            onClick={() => { setOpen(false); removePost(post); }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </Popover.Content>
                </Popover>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
