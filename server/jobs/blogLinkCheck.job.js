// server/jobs/blogLinkCheck.job.js
// Keeps outbound citations honest after publication. Blog posts are written once
// and read for years; the sources they cite move and disappear. This re-checks
// every external link in published posts and strips the dead ones — stripping
// removes the markdown markup only, so the sentence still reads exactly as
// written, minus a link that would have 404'd.
'use strict';

const cron = require('node-cron');
const BlogPost = require('../models/BlogPost');
const { sanitizeLinks } = require('../services/blog.helpers');
const {
  partitionExternalLinks,
  verifyLiveUrls,
  makeExternalLinkValidator,
  buildExternalLinkRecords,
} = require('../services/blog.links');

// Bounded per run so one pass never turns into an hour of outbound requests.
const DEFAULT_LIMIT = 40;

/**
 * Re-verify external links on published posts, oldest check first (a null
 * `linksCheckedAt` sorts ahead of every date, so posts never checked go first).
 * Rewrites content only when a link actually failed.
 */
async function scanBlogLinks(opts = {}) {
  const { model = BlogPost, fetchImpl, limit = DEFAULT_LIMIT } = opts;

  const posts = await model
    .find({ status: 'published', 'externalLinks.0': { $exists: true } })
    .sort({ linksCheckedAt: 1 })
    .limit(limit)
    .lean();

  let stripped = 0;
  for (const post of posts) {
    const { external } = partitionExternalLinks(post.content);
    if (!external.length) continue;

    const verdicts = await verifyLiveUrls(external, fetchImpl ? { fetchImpl } : {});
    const isAllowed = makeExternalLinkValidator(verdicts);
    const dead = external.filter((href) => !isAllowed(href));

    const content = dead.length ? sanitizeLinks(post.content, isAllowed) : post.content;
    dead.forEach((url) => {
      console.log(`blog link check: stripped dead link ${url} from /blog/${post.slug}`);
    });
    stripped += dead.length;

    await model.updateOne(
      { _id: post._id },
      {
        $set: {
          content,
          externalLinks: buildExternalLinkRecords(content, verdicts),
          linksCheckedAt: new Date(),
        },
      }
    );
  }

  return { scanned: posts.length, stripped };
}

/** Start the link-check cron (guarded by the caller). Runs weekly, Monday 04:00. */
function startBlogLinkCheckCron() {
  cron.schedule('0 4 * * 1', () => {
    scanBlogLinks().catch((e) => console.error('blog link check cron error:', e.message));
  });
  console.log('   Cron:        blog external link check (weekly, Mon 04:00)');
}

module.exports = { scanBlogLinks, startBlogLinkCheckCron };
