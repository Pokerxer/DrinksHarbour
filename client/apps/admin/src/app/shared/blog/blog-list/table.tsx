// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Text, Badge, Button, Select, ActionIcon, Popover } from 'rizzui';
import {
  PiPencilSimpleBold,
  PiTrashBold,
  PiEyeBold,
  PiEyeSlashBold,
  PiArrowsClockwiseBold,
  PiStarFill,
  PiWarningBold,
} from 'react-icons/pi';
import { blogService } from '@/services/blog.service';
import { routes } from '@/config/routes';

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

export default function BlogPostsTable() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const token = session?.token || session?.user?.token || '';

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');

  const fetchPosts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = { limit: '100' };
      if (category) params.category = category;
      if (status) params.status = status;
      const data = await blogService.getPosts(token, params);
      setPosts(data.posts || []);
    } catch (err) {
      setError(err.message || 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [token, category, status]);

  useEffect(() => {
    if (sessionStatus === 'authenticated') fetchPosts();
  }, [sessionStatus, fetchPosts]);

  const toggleStatus = async (post) => {
    const next = post.status === 'published' ? 'draft' : 'published';
    try {
      await blogService.setStatus(post._id, next, token);
      toast.success(
        next === 'published' ? 'Post published' : 'Post unpublished'
      );
      fetchPosts();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const removePost = async (post) => {
    try {
      await blogService.deletePost(post._id, token);
      toast.success('Post deleted');
      fetchPosts();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div className="h-12 w-16 flex-shrink-0 animate-pulse rounded-lg bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-gray-100" />
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
        <Text className="mb-2 text-lg font-bold text-red-600">
          Failed to load posts
        </Text>
        <Text className="mb-6 text-gray-500">{error}</Text>
        <Button onClick={fetchPosts}>
          <PiArrowsClockwiseBold className="me-1.5 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={(v) => setCategory(v?.value ?? v ?? '')}
          getOptionValue={(o) => o.value}
          displayValue={(v) =>
            CATEGORY_OPTIONS.find((o) => o.value === v)?.label
          }
          placeholder="Category"
          className="w-48"
        />
        <Select
          options={STATUS_OPTIONS}
          value={status}
          onChange={(v) => setStatus(v?.value ?? v ?? '')}
          getOptionValue={(o) => o.value}
          displayValue={(v) => STATUS_OPTIONS.find((o) => o.value === v)?.label}
          placeholder="Status"
          className="w-40"
        />
        <Text className="ms-auto text-sm text-gray-500">
          {posts.length} posts
        </Text>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-3xl border border-gray-100 bg-white p-12 text-center">
          <Text className="mb-2 text-lg font-bold text-gray-700">
            No posts yet
          </Text>
          <Text className="mb-6 text-gray-500">
            Create your first post — or generate one with AI.
          </Text>
          <Link href={routes.blog.create}>
            <Button as="span">Add Post</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post._id}
              className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="relative h-12 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                {post.image ? (
                  <Image
                    src={post.image}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Text className="truncate font-semibold text-gray-900">
                    {post.title}
                  </Text>
                  {post.featured && (
                    <PiStarFill
                      className="h-4 w-4 flex-shrink-0 text-amber-400"
                      title="Featured"
                    />
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                  <span>{post.category}</span>
                  <span>·</span>
                  <span>/{post.slug}</span>
                  {post.publishedAt && (
                    <>
                      <span>·</span>
                      <span>
                        {new Date(post.publishedAt).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <Badge
                color={post.status === 'published' ? 'success' : 'secondary'}
                variant="flat"
              >
                {post.status}
              </Badge>
              <div className="flex items-center gap-1.5">
                <ActionIcon
                  size="sm"
                  variant="outline"
                  title={post.status === 'published' ? 'Unpublish' : 'Publish'}
                  onClick={() => toggleStatus(post)}
                >
                  {post.status === 'published' ? (
                    <PiEyeSlashBold className="h-4 w-4" />
                  ) : (
                    <PiEyeBold className="h-4 w-4" />
                  )}
                </ActionIcon>
                <ActionIcon
                  size="sm"
                  variant="outline"
                  title="Edit"
                  onClick={() => router.push(routes.blog.edit(post._id))}
                >
                  <PiPencilSimpleBold className="h-4 w-4" />
                </ActionIcon>
                <Popover placement="left">
                  <Popover.Trigger>
                    <ActionIcon
                      size="sm"
                      variant="outline"
                      color="danger"
                      title="Delete"
                    >
                      <PiTrashBold className="h-4 w-4" />
                    </ActionIcon>
                  </Popover.Trigger>
                  <Popover.Content>
                    {({ setOpen }) => (
                      <div className="w-56 p-1 text-center">
                        <Text className="mb-3 font-semibold">
                          Delete this post?
                        </Text>
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            color="danger"
                            onClick={() => {
                              setOpen(false);
                              removePost(post);
                            }}
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
