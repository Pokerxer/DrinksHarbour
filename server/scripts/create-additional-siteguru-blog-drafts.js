// Create five additional original SEO drafts for SiteGuru opportunities.
// Deliberately does not import or call an AI provider.
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const BlogPost = require('../models/BlogPost');
const { computeReadTime, dedupeSlug, sanitizeContentBlocks, slugify } = require('../services/blog.helpers');
const { buildExternalLinkRecords } = require('../services/blog.links');

const AUTHOR = {
  name: 'DrinksHarbour Editorial Team',
  role: 'Drinks & Lifestyle Editors',
  bio: 'Our editorial team helps Nigerian shoppers choose, serve and enjoy original drinks with practical guides for every occasion.',
};

const POSTS = [
  {
    title: 'How to Order Cognac Online in Nigeria: A Practical Buying Guide',
    excerpt: 'Learn how to choose cognac online by age statement, bottle size, occasion and delivery details before you place an order in Nigeria.',
    category: 'Spirits Guide', tags: ['Cognac', 'Buying Guide', 'Nigeria', 'Gifting'],
    imageAlt: 'Cognac glass and bottle prepared for an online buying guide',
    seo: { metaTitle: 'How to Order Cognac Online in Nigeria', metaDescription: 'Choose the right cognac online in Nigeria with this guide to age statements, bottle sizes, gifting and delivery checks.' },
    content: [
      { type: 'p', text: 'Ordering cognac online should feel straightforward, whether you are buying a bottle for your home bar, a dinner or a gift. The label can include unfamiliar terms, so a few simple checks will help you choose confidently and avoid paying for a style that does not suit the occasion.' },
      { type: 'h2', text: 'Start with the occasion' },
      { type: 'p', text: 'For a first bottle or a casual after-dinner pour, look for a balanced, approachable expression. For a milestone gift, a more mature expression and presentation may be more appropriate. If the bottle will be used in cocktails, prioritise versatility and a flavour profile that will not disappear behind mixers.' },
      { type: 'h2', text: 'Understand VS, VSOP and XO' },
      { type: 'ul', items: ['VS is commonly chosen for mixing and easy everyday serves.', 'VSOP offers a more rounded option for sipping or gifting.', 'XO is usually selected for a slower, more formal drinking occasion.', 'Age labels are only one part of the decision; producer style and cask character also matter.'] },
      { type: 'tip', text: 'Pro tip: If you are buying a gift, check whether the recipient prefers neat spirits, cocktails or long drinks. The most expensive bottle is not always the most useful one.' },
      { type: 'h2', text: 'Check bottle size and delivery details' },
      { type: 'p', text: 'Compare the volume, seller, stock status and final checkout total. A smaller bottle can be useful for a first tasting or gift hamper, while a standard bottle is more practical for entertaining. Confirm your delivery area and any order cut-off before payment.' },
      { type: 'h2', text: 'Serve it properly' },
      { type: 'p', text: 'Serve cognac in a clean glass with enough room for the aroma. Start at room temperature, take a small sip and add a little water only if you want to explore the flavours. There is no requirement to drink it one particular way.' },
      { type: 'p', text: 'Browse the [spirits collection](/categories/spirits) and [shop original drinks online](/shop). DrinksHarbour products are sourced through verified channels and are checked before dispatch.' },
    ],
  },
  {
    title: 'Soju Explained: What It Tastes Like and How to Drink It',
    excerpt: 'Discover what soju tastes like, how it is served, which flavours to try and what to pair with it at home or with friends.',
    category: 'Spirits Guide', tags: ['Soju', 'Spirits', 'Serving Guide', 'Food Pairing'],
    imageAlt: 'Chilled soju bottle and small glasses on a sharing table',
    seo: { metaTitle: 'Soju Explained: Taste, Flavours and Serving Tips', metaDescription: 'What does soju taste like? Learn how to serve soju, choose flavours and pair it with food at home in Nigeria.' },
    content: [
      { type: 'p', text: 'Soju is a clear Korean spirit known for its clean profile, approachable texture and wide range of flavoured expressions. It is often served chilled and shared in small glasses, making it a natural choice for relaxed dinners, game nights and casual gatherings.' },
      { type: 'h2', text: 'What does soju taste like?' },
      { type: 'p', text: 'Unflavoured soju is usually clean, lightly sweet and relatively neutral compared with strongly aromatic spirits. Flavoured versions may bring fruit notes such as grape, peach, citrus or berry. The exact experience depends on the bottle, serving temperature and whether it is enjoyed neat or with food.' },
      { type: 'h2', text: 'How to serve soju' },
      { type: 'ul', items: ['Chill the bottle before serving.', 'Use small glasses and pour for one another when sharing.', 'Try it neat first so you can understand the flavour.', 'Add a mixer or fruit garnish if you prefer a longer, softer drink.', 'Drink responsibly and keep water available.'] },
      { type: 'tip', text: 'Pro tip: Start with an unflavoured or lightly flavoured bottle if you want to learn the spirit, then try fruit flavours once you know whether you prefer a clean or sweeter profile.' },
      { type: 'h2', text: 'What food goes with soju?' },
      { type: 'p', text: 'Soju works well with savoury, spicy and grilled foods. Try it with grilled chicken, barbecue, fried snacks, noodles or a sharing platter. In a Nigerian setting, its clean profile can also work alongside peppered dishes and grilled meats when served cold.' },
      { type: 'h2', text: 'Soju cocktails and easy mixes' },
      { type: 'p', text: 'A simple highball with soju, soda water and citrus is an easy starting point. Fruit juice can make a sweeter serve, while ginger or tonic adds spice and bitterness. Keep the proportions modest so the spirit remains part of the drink rather than disappearing completely.' },
      { type: 'p', text: 'Explore the [spirits section](/categories/spirits) and [browse all drinks](/shop) to find a bottle for your next shared meal. Check the product details and delivery information before checkout.' },
    ],
  },
  {
    title: 'Milk Drinks in Nigeria: What to Serve for Breakfast and Events',
    excerpt: 'A practical guide to choosing milk drinks in Nigeria for breakfast, family gatherings, office events and convenient refreshment.',
    category: 'Lifestyle', tags: ['Milk Drinks', 'Nigeria', 'Non-Alcoholic', 'Events'],
    imageAlt: 'Chilled milk drinks arranged for breakfast and a family gathering',
    seo: { metaTitle: 'Milk Drinks in Nigeria: A Practical Guide', metaDescription: 'Choose milk drinks in Nigeria for breakfast, family gatherings, office events and everyday refreshment with this simple guide.' },
    content: [
      { type: 'p', text: 'Milk drinks are useful when you want something filling, familiar and easy to serve. They can sit alongside juice, water and malt drinks at breakfast, school-friendly gatherings, office events and family celebrations. The right choice depends on sweetness, packaging, storage and the age of your guests.' },
      { type: 'h2', text: 'Choose by the occasion' },
      { type: 'p', text: 'For breakfast, smaller single-serve formats are convenient and easy to chill. For an event, multipacks reduce serving pressure and help hosts keep the drinks table organised. If guests will be moving around, sealed bottles or cartons are often easier than open glasses.' },
      { type: 'h2', text: 'Think about sweetness and variety' },
      { type: 'p', text: 'Some milk drinks are sweet and dessert-like, while others are lighter and more neutral. If you are buying for a group, include water and a less-sweet option so guests can choose according to their preference. Read the product description rather than assuming every milk drink tastes the same.' },
      { type: 'ul', items: ['Breakfast: pair with fruit, pastries or cereal.', 'Family gatherings: offer chilled single-serve bottles and water.', 'Office events: choose easy-to-carry formats with clear serving counts.', 'Parties: keep milk drinks in a separate cooler from strongly flavoured foods.'] },
      { type: 'tip', text: 'Pro tip: Keep milk drinks properly chilled and follow the storage instructions on the packaging. Buy quantities that can be served within the recommended period after opening.' },
      { type: 'h2', text: 'How much should you buy?' },
      { type: 'p', text: 'Estimate one serving per guest, then add a small buffer for longer events or popular flavours. Mix milk drinks with juice, sparkling water and other non-alcoholic options instead of making one product carry the whole drinks menu.' },
      { type: 'p', text: 'Browse [non-alcoholic drinks](/categories/non-alcoholic-drinks) and [shop online](/shop) to build a convenient order for home, work or an event. Compare pack sizes, availability and delivery details before checkout.' },
    ],
  },
  {
    title: 'Yogurt Drinks in Nigeria: How to Choose and Serve Them',
    excerpt: 'Learn how to choose yogurt drinks in Nigeria by flavour, format, storage and occasion, from breakfast to events.',
    category: 'Lifestyle', tags: ['Yogurt Drinks', 'Nigeria', 'Non-Alcoholic', 'Breakfast'],
    imageAlt: 'Chilled yogurt drinks with fruit prepared for a breakfast table',
    seo: { metaTitle: 'Yogurt Drinks in Nigeria: Buying Guide', metaDescription: 'Choose yogurt drinks in Nigeria by flavour, format, storage and occasion for breakfast, events and everyday refreshment.' },
    content: [
      { type: 'p', text: 'Yogurt drinks are a convenient way to add a creamy, chilled option to a drinks order. They work for breakfast, quick refreshment, family gatherings and office meetings. Since brands and flavours vary, a few simple checks will help you choose the right products and serve them well.' },
      { type: 'h2', text: 'Pick the flavour your guests will enjoy' },
      { type: 'p', text: 'Fruit flavours are usually easy for mixed groups, while plain or lightly sweetened options can suit guests who prefer a more subtle taste. If you are ordering for a family, choose at least two flavours rather than buying a large quantity of one unfamiliar option.' },
      { type: 'h2', text: 'Single-serve or larger format?' },
      { type: 'p', text: 'Single-serve bottles are ideal for breakfast, lunchboxes and meetings because they are easy to hand out. Larger containers can be more efficient for a home fridge, but they need cups and careful refrigeration after opening. Choose the format that matches how quickly the drinks will be consumed.' },
      { type: 'h2', text: 'Serving and storage checklist' },
      { type: 'ul', items: ['Chill yogurt drinks before serving.', 'Check the label for storage guidance and expiry information.', 'Keep opened containers refrigerated and serve them promptly.', 'Use a cooler with ice for longer events or transport.', 'Offer water alongside creamy or sweet drinks.'] },
      { type: 'tip', text: 'Pro tip: Create a simple breakfast station with yogurt drinks, fruit, pastries and water. It feels complete without requiring a complicated menu.' },
      { type: 'h2', text: 'When are yogurt drinks useful?' },
      { type: 'p', text: 'They are practical for early meetings, children’s gatherings, family brunches and events where guests want something filling but not carbonated. They can also complement a larger drinks table that includes juices, malt drinks and sparkling water.' },
      { type: 'p', text: 'Explore [non-alcoholic categories](/categories/non-alcoholic-drinks) and [browse all drinks online](/shop). Compare bottle sizes and delivery information so your order arrives ready to chill and serve.' },
    ],
  },
  {
    title: 'How to Order Drinks Online in Abuja: A Delivery Checklist',
    excerpt: 'Use this simple checklist to choose drinks, confirm stock, check delivery details and place a smoother online order in Abuja.',
    category: 'Lifestyle', tags: ['Drinks Online', 'Abuja', 'Delivery', 'Buying Guide'],
    imageAlt: 'Drinks order packed for delivery in Abuja',
    seo: { metaTitle: 'How to Order Drinks Online in Abuja', metaDescription: 'Order drinks online in Abuja with a simple checklist for choosing products, checking stock, delivery details and safe checkout.' },
    content: [
      { type: 'p', text: 'Ordering drinks online is easiest when you decide what you need before opening the shop. Whether you are restocking a home bar, planning dinner or preparing for an event in Abuja, this checklist helps you move from browsing to checkout with fewer surprises.' },
      { type: 'h2', text: '1. Start with the occasion and guest list' },
      { type: 'p', text: 'A dinner for four needs a different order from a birthday or office event. Decide whether you need wine, spirits, beer, non-alcoholic drinks, mixers or a combination. Include water and alcohol-free options so every guest has something suitable.' },
      { type: 'h2', text: '2. Compare size, style and quantity' },
      { type: 'p', text: 'Check the bottle or pack size rather than comparing prices alone. A larger format may suit a party, while smaller bottles are useful for sampling or gifting. For spirits, think about whether the bottle will be sipped, mixed or shared over several occasions.' },
      { type: 'h2', text: '3. Confirm stock and product details' },
      { type: 'ul', items: ['Read the product name and size carefully.', 'Check whether the item is currently available.', 'Review the category, alcohol status and serving style.', 'Choose original products from a trusted seller.', 'Add suitable mixers, ice and water to the plan.'] },
      { type: 'h2', text: '4. Check delivery information before payment' },
      { type: 'p', text: 'Enter the correct delivery area and review the available delivery option, order cut-off, fee and expected timing shown at checkout. If your order is for an event, leave enough time for changes or substitutions rather than ordering at the last minute.' },
      { type: 'tip', text: 'Pro tip: Place event orders early, keep a short backup list and confirm that someone of legal drinking age will be available to receive alcoholic products.' },
      { type: 'h2', text: '5. Store the order properly' },
      { type: 'p', text: 'Chill white wine, rosé, beer and non-alcoholic drinks before serving. Keep spirits and unopened wine away from direct heat and sunlight. Store opened products according to their labels and plan the serving order around what needs refrigeration.' },
      { type: 'p', text: 'Start with [DrinksHarbour’s online shop](/shop), browse by [drink category](/categories) and compare your options before checkout. Products are sourced through verified channels, and DrinksHarbour does not sell counterfeit drinks.' },
    ],
  },
];

async function main() {
  await connectDB();
  const saved = [];
  for (const source of POSTS) {
    const base = slugify(source.title);
    const existing = await BlogPost.find({ slug: new RegExp(`^${base}(-\\d+)?$`) }).select('slug').lean();
    const slug = dedupeSlug(base, existing.map((p) => p.slug));
    const content = sanitizeContentBlocks(source.content);
    const data = {
      ...source, slug, author: AUTHOR, content,
      readTime: computeReadTime(content), status: 'draft', featured: false,
      externalLinks: buildExternalLinkRecords(content), linksCheckedAt: null,
    };
    const post = await BlogPost.findOneAndUpdate(
      { slug }, { $set: data }, { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    saved.push({ id: post._id, slug: post.slug, title: post.title, status: post.status, readTime: post.readTime });
  }
  console.log(JSON.stringify({ provider: 'manual-editorial-draft', saved }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.stack || err.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
