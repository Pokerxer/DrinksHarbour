// Create five original, SEO-focused blog drafts from the SiteGuru opportunity list.
// Deliberately does not import or call an AI provider.
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const BlogPost = require('../models/BlogPost');
const {
  computeReadTime,
  dedupeSlug,
  sanitizeContentBlocks,
  slugify,
} = require('../services/blog.helpers');
const { buildExternalLinkRecords } = require('../services/blog.links');

const AUTHOR = {
  name: 'DrinksHarbour Editorial Team',
  role: 'Drinks & Lifestyle Editors',
  bio: 'Our editorial team helps Nigerian shoppers choose, serve and enjoy original drinks with practical guides for every occasion.',
};

const POSTS = [
  {
    title: 'Macallan 12 vs 15 vs 18: Which Whisky Is Worth Buying in Nigeria?',
    excerpt: 'A practical comparison of Macallan 12, 15 and 18: flavour, occasion, gifting and how to choose the right bottle for your budget.',
    category: 'Spirits Guide',
    tags: ['Macallan', 'Whisky', 'Buying Guide', 'Nigeria'],
    imageAlt: 'Three whisky glasses representing Macallan age statements',
    seo: {
      metaTitle: 'Macallan 12 vs 15 vs 18 in Nigeria',
      metaDescription: 'Compare Macallan 12, 15 and 18 by flavour, occasion and value before you buy whisky online in Nigeria.',
    },
    content: [
      { type: 'p', text: 'Macallan 12, 15 and 18 are often compared because the age statement is easy to understand, but the best bottle depends on how you plan to enjoy it. Are you buying a first single malt, choosing a gift or planning a special tasting? This guide breaks down the practical differences before you buy whisky online in Nigeria.' },
      { type: 'image', src: '', alt: 'Three whisky glasses beside bottles with different age statements', caption: 'A side-by-side tasting is the clearest way to notice how age and cask character change a whisky.' },
      { type: 'h2', text: 'Macallan 12: the versatile starting point' },
      { type: 'p', text: 'Macallan 12 is usually the easiest place to begin. It is approachable enough for a new whisky drinker, while still offering the oak, dried fruit and gentle spice that make a single malt interesting. It works well neat, with a few drops of water or as the centrepiece of a relaxed home tasting.' },
      { type: 'p', text: 'Choose the 12 when you want a bottle that can be shared without making the occasion feel overly formal. It is also a sensible option when you want to explore the style before spending more on an older expression. Browse the [whisky selection](/categories/spirits) to compare other single malts and blended options.' },
      { type: 'h2', text: 'Macallan 15: a richer gifting choice' },
      { type: 'p', text: 'The 15 sits between everyday enjoyment and milestone gifting. Expect a fuller, more rounded profile, with the cask influence playing a larger role in the experience. It is a good fit for a birthday, promotion, housewarming or a dinner where the bottle will be sipped slowly rather than mixed.' },
      { type: 'tip', text: 'Pro tip: If the recipient already enjoys whisky, pay attention to how they drink it. A neat whisky drinker may appreciate an older expression, while someone who enjoys highballs may prefer a flexible bottle at a lower price point.' },
      { type: 'h2', text: 'Macallan 18: for a milestone moment' },
      { type: 'p', text: 'Macallan 18 is best treated as a special-occasion bottle. Its appeal is not simply the number on the label; it is the slower, more deliberate drinking experience that comes with a premium expression. Serve it in a tulip-shaped glass and give it time to open before tasting.' },
      { type: 'h2', text: 'Which one should you buy?' },
      { type: 'ul', items: ['Choose Macallan 12 for versatility and an approachable single-malt introduction.', 'Choose Macallan 15 for a richer gift or a more elevated dinner pour.', 'Choose Macallan 18 for a milestone, collector-style gift or formal tasting.', 'Compare the bottle size, seller, delivery area and final price before checkout.'] },
      { type: 'p', text: 'There is no universal winner. The right choice is the expression that matches the drinker, the occasion and your budget. Once you have decided, [shop original drinks online](/shop) and check delivery details before placing your order.' },
    ],
  },
  {
    title: '8 Types of Chardonnay Explained: Which One Should You Buy?',
    excerpt: 'From crisp and citrusy to buttery and oak-aged, learn how Chardonnay styles differ and how to choose one for dinner or gifting.',
    category: 'Wine Guide',
    tags: ['Chardonnay', 'Wine Guide', 'Food Pairing', 'Nigeria'],
    imageAlt: 'Chardonnay wine poured into a glass beside a dinner table',
    seo: {
      metaTitle: '8 Types of Chardonnay to Try in Nigeria',
      metaDescription: 'Learn the main Chardonnay styles, from crisp and unoaked to rich and oak-aged, and choose the right bottle online.',
    },
    content: [
      { type: 'p', text: 'Chardonnay can taste light and citrusy, creamy and buttery, or somewhere between the two. That range is why it is one of the most useful wines to understand when buying drinks online. Instead of choosing only by country or price, use the style clues below to find a bottle that suits your palate.' },
      { type: 'image', src: '', alt: 'Pale Chardonnay wine in a glass with citrus and green apple', caption: 'Chardonnay can be bright and fresh or rich and textured depending on the winemaking style.' },
      { type: 'h2', text: '1. Unoaked Chardonnay' },
      { type: 'p', text: 'Unoaked Chardonnay is fermented and matured without significant oak influence. Look for lemon, green apple, pear and a clean finish. It is a strong choice for hot afternoons, seafood, salads and shoppers who prefer crisp white wine.' },
      { type: 'h2', text: '2. Lightly oaked Chardonnay' },
      { type: 'p', text: 'A lightly oaked bottle keeps its fresh fruit character while adding a little roundness and spice. It is a useful middle ground when one guest likes crisp wine and another prefers something softer.' },
      { type: 'h2', text: '3. Full-bodied oak-aged Chardonnay' },
      { type: 'p', text: 'Oak-aged Chardonnay can show vanilla, toast, baking spice and a fuller texture. Pair it with grilled chicken, creamy pasta, prawns or roasted vegetables. It is also a dependable white-wine gift because it feels substantial without being too challenging.' },
      { type: 'h2', text: '4. Buttery Chardonnay' },
      { type: 'p', text: 'The buttery character often comes from malolactic fermentation, a process that softens acidity and can create a creamy impression. If you enjoy smooth, rounded wines rather than sharp, zesty whites, this is the style to look for.' },
      { type: 'h2', text: '5. Mineral and high-acid Chardonnay' },
      { type: 'p', text: 'Some Chardonnays are valued for freshness, acidity and a stony or mineral impression. They are excellent with oysters, grilled fish, light appetisers and dishes that need a wine with energy.' },
      { type: 'tip', text: 'Pro tip: Serve Chardonnay chilled but not ice-cold. If the bottle is too cold, its aroma and texture disappear; allow it to sit for a few minutes before serving.' },
      { type: 'h2', text: '6. Tropical-fruit Chardonnay' },
      { type: 'p', text: 'Warmer growing conditions can produce ripe peach, pineapple and melon notes. This style is friendly for casual gatherings and works well when guests prefer fruit-forward drinks.' },
      { type: 'h2', text: '7. Sparkling Chardonnay' },
      { type: 'p', text: 'Chardonnay is also used in sparkling wines. Expect lively bubbles, citrus and a celebratory feel. Choose it for brunch, birthdays, engagement parties or a welcome drink.' },
      { type: 'h2', text: '8. Sweet or late-harvest styles' },
      { type: 'p', text: 'Less common than dry Chardonnay, sweeter styles can suit dessert, fruit-based dishes or anyone who prefers noticeable sweetness. Read the label and product description carefully so the bottle matches your expectations.' },
      { type: 'p', text: 'The simplest buying rule is to match the style to the occasion: crisp for seafood and heat, creamy for richer food, and sparkling for celebration. Explore the [wine collection](/categories/wine) and compare the available bottles before checkout.' },
    ],
  },
  {
    title: 'Best Wines in Nigeria: 10 Bottles Worth Trying in 2026',
    excerpt: 'A practical guide to choosing red, white, rosé and sparkling wines in Nigeria for dinners, gifting, parties and easy drinking.',
    category: 'Wine Guide',
    tags: ['Wine', 'Nigeria', 'Buying Guide', 'Food Pairing'],
    imageAlt: 'A selection of red, white, rosé and sparkling wine bottles',
    seo: {
      metaTitle: 'Best Wines in Nigeria to Buy Online',
      metaDescription: 'Discover how to choose the best red, white, rosé and sparkling wines in Nigeria for dinner, gifting and celebrations.',
    },
    content: [
      { type: 'p', text: 'The best wine in Nigeria is not one specific label. It is the bottle that suits your food, occasion, preferred sweetness and budget. Whether you are stocking a home bar in Abuja, ordering a gift or planning a weekend gathering, this guide gives you ten styles and bottle profiles to look for when shopping online.' },
      { type: 'image', src: '', alt: 'Wine bottles arranged for a Nigerian dinner or celebration', caption: 'A useful wine selection includes different colours, body levels and sweetness preferences.' },
      { type: 'h2', text: '1. A smooth Cabernet Sauvignon' },
      { type: 'p', text: 'Cabernet Sauvignon is a dependable red for grilled meat, burgers, tomato-based dishes and evening entertaining. Choose a smoother, fruit-led example if your guests are new to red wine.' },
      { type: 'h2', text: '2. A fruit-forward Shiraz or Syrah' },
      { type: 'p', text: 'Shiraz often brings dark fruit, pepper and a generous texture. It is a strong match for suya, barbecue and smoky flavours. Look for it when you want a red that can stand up to bold food.' },
      { type: 'h2', text: '3. A fresh Sauvignon Blanc' },
      { type: 'p', text: 'Sauvignon Blanc is crisp, aromatic and refreshing. It works well with grilled fish, salads, prawns and light appetisers, especially when the weather is warm.' },
      { type: 'h2', text: '4. A versatile Chardonnay' },
      { type: 'p', text: 'Chardonnay can range from bright and clean to creamy and oak-aged. Choose an unoaked bottle for freshness or a richer style for roast chicken and creamy dishes.' },
      { type: 'h2', text: '5. A chilled rosé' },
      { type: 'p', text: 'Rosé is useful for parties because it sits between red and white wine in style and serving temperature. It pairs with grilled prawns, salads, spicy starters and casual outdoor meals.' },
      { type: 'h2', text: '6. A semi-sweet rosé or white' },
      { type: 'p', text: 'If your guests prefer softer, fruitier wine, a semi-sweet option is more welcoming than a very dry bottle. Serve it chilled and pair it with spicy food or fruit-forward desserts.' },
      { type: 'h2', text: '7. A sparkling wine for celebrations' },
      { type: 'p', text: 'Sparkling wine instantly makes a gathering feel special. It works as a welcome drink, a toast or a pairing for fried appetisers and light snacks.' },
      { type: 'h2', text: '8. A lighter Pinot Noir' },
      { type: 'p', text: 'Pinot Noir is a good choice when you want red wine with less weight and softer tannins. It can work with roast chicken, mushrooms and lighter meals.' },
      { type: 'h2', text: '9. A bold Malbec' },
      { type: 'p', text: 'Malbec is known for dark fruit and a generous, full-bodied feel. It suits grilled meats and is a good choice for drinkers who prefer bold reds.' },
      { type: 'h2', text: '10. A non-alcoholic wine alternative' },
      { type: 'p', text: 'A thoughtful drinks table includes an alcohol-free option for drivers, guests taking a break or anyone who simply prefers not to drink alcohol. It also gives hosts an easy choice for daytime gatherings.' },
      { type: 'tip', text: 'Pro tip: For a mixed group, buy one crisp white, one smooth red, one rosé or sparkling bottle, and at least one non-alcoholic option. This covers more preferences than buying several similar reds.' },
      { type: 'p', text: 'Browse [wines available online](/categories/wine), compare bottle details and check delivery coverage before ordering. DrinksHarbour sells original products sourced through verified channels.' },
    ],
  },
  {
    title: 'Single Malt vs Single Grain Whisky: What’s the Difference?',
    excerpt: 'Understand the difference between single malt and single grain whisky, including ingredients, flavour, serving and buying advice.',
    category: 'Spirits Guide',
    tags: ['Whisky', 'Single Malt', 'Single Grain', 'Buying Guide'],
    imageAlt: 'Two whisky glasses showing single malt and single grain styles',
    seo: {
      metaTitle: 'Single Malt vs Single Grain Whisky Guide',
      metaDescription: 'Single malt vs single grain whisky explained simply: ingredients, flavour, price and how to choose your next bottle.',
    },
    content: [
      { type: 'p', text: 'The terms single malt and single grain can sound similar, but they describe different production choices. Understanding the difference makes it easier to choose a bottle for sipping, cocktails or gifting instead of relying only on the label or price.' },
      { type: 'image', src: '', alt: 'Whisky tasting setup with two glasses and a water jug', caption: 'A simple side-by-side tasting helps reveal the different texture and aroma of each whisky style.' },
      { type: 'h2', text: 'What is single malt whisky?' },
      { type: 'p', text: 'Single malt whisky is made at one distillery using malted barley. “Single” refers to the distillery, not to a single barrel or a single year. A bottle can contain whisky from several casks made at that distillery and still be a single malt.' },
      { type: 'p', text: 'Single malts are often chosen for their layered aroma and sense of place. Depending on the distillery and cask programme, you may notice fruit, cereal, honey, dried fruit, spice, oak or smoke.' },
      { type: 'h2', text: 'What is single grain whisky?' },
      { type: 'p', text: 'Single grain whisky is also produced at one distillery, but it can use grains beyond malted barley, such as maize or wheat. The word “grain” describes the grain recipe and production style; it does not mean the whisky is low quality.' },
      { type: 'p', text: 'Single grain whisky is often lighter, smoother and more delicate. That makes it enjoyable on its own for drinkers who prefer a softer profile, and useful in highballs and cocktails where a spirit should support rather than dominate the other ingredients.' },
      { type: 'h2', text: 'The difference at a glance' },
      { type: 'ul', items: ['Single malt: one distillery and malted barley; often more aromatic and textured.', 'Single grain: one distillery and a broader grain recipe; often lighter and smoother.', 'Neither term automatically tells you the age, sweetness, strength or cask type.', 'The best choice depends on how you plan to drink it and what flavours you enjoy.'] },
      { type: 'tip', text: 'Pro tip: Taste both styles in the same glassware with a little water available. Start neat, then add a few drops and notice whether the aroma becomes sweeter, fruitier or more floral.' },
      { type: 'h2', text: 'Which one should you buy?' },
      { type: 'p', text: 'Choose a single malt when the bottle is the main event: a slow pour, a tasting night or a thoughtful whisky gift. Choose a single grain when you want an easy-drinking dram, a lighter style or a base for a highball. If you are shopping for a group, a versatile blended whisky can also be a practical middle ground.' },
      { type: 'p', text: 'Explore the [spirits collection](/categories/spirits) and compare the product description, bottle size and delivery details before you order. The label matters, but your preferred drinking occasion matters more.' },
    ],
  },
  {
    title: 'Best Non-Alcoholic Drinks to Buy Online in Nigeria',
    excerpt: 'Stock your home, office or event with refreshing non-alcoholic drinks, from sparkling options and malt drinks to juices and mixers.',
    category: 'Lifestyle',
    tags: ['Non-Alcoholic', 'Drinks Online', 'Nigeria', 'Party Planning'],
    imageAlt: 'Colourful non-alcoholic drinks served chilled for a gathering',
    seo: {
      metaTitle: 'Best Non-Alcoholic Drinks in Nigeria',
      metaDescription: 'Find the best non-alcoholic drinks to buy online in Nigeria for parties, family gatherings, work events and everyday refreshment.',
    },
    content: [
      { type: 'p', text: 'A good drinks order should work for everyone at the table. Non-alcoholic drinks are useful for children, drivers, guests taking a break, daytime events and anyone who prefers not to drink alcohol. They can also be more exciting than plain water when chosen with the same care as wine or spirits.' },
      { type: 'image', src: '', alt: 'Chilled non-alcoholic drinks, juices and sparkling bottles on a table', caption: 'A varied alcohol-free selection makes every guest feel considered at a gathering.' },
      { type: 'h2', text: 'Sparkling drinks for celebrations' },
      { type: 'p', text: 'Sparkling grape drinks, alcohol-free sparkling wines and flavoured sodas bring a celebratory feel without alcohol. Chill them well and serve in stemware or attractive tumblers so they feel like part of the occasion rather than an afterthought.' },
      { type: 'h2', text: 'Malt drinks for a familiar favourite' },
      { type: 'p', text: 'Malt drinks are popular across Nigeria because they are easy to serve, widely understood and suitable for many gatherings. Keep them chilled for parties, family meals and office events.' },
      { type: 'h2', text: 'Juices and fruit blends' },
      { type: 'p', text: 'Juices and fruit blends add colour and natural fruit flavour to a drinks table. Serve them on their own, combine them with soda water or use them as a base for a simple mocktail. Check sweetness levels when planning a full menu so the table has variety.' },
      { type: 'h2', text: 'Mixers that work beyond cocktails' },
      { type: 'p', text: 'Tonic water, ginger drinks, soda water and other mixers can be served alcohol-free with citrus, herbs or fresh fruit. They are especially useful when some guests want cocktails and others want a similar-looking alternative.' },
      { type: 'h2', text: 'How much should you buy?' },
      { type: 'ul', items: ['For a short event, plan at least two non-alcoholic servings per guest.', 'For a family gathering, include both familiar favourites and one lighter or less-sweet option.', 'For an office or daytime event, prioritise sparkling water, juices and malt drinks.', 'Add extra water, ice and cups; good hydration should be easy throughout the event.'] },
      { type: 'tip', text: 'Pro tip: Build a simple mocktail station with ice, citrus, mint, ginger drink and sparkling water. Guests can customise their own drink without needing a bartender.' },
      { type: 'h2', text: 'Shopping checklist' },
      { type: 'p', text: 'Before you buy, check bottle size, serving count, storage needs and delivery coverage. Mix single-serve bottles for convenience with larger formats for the main table. If your order includes alcoholic drinks too, keep the alcohol-free options clearly visible so guests can choose comfortably.' },
      { type: 'p', text: 'Browse [non-alcoholic drinks online](/categories/non-alcoholic-drinks) and [shop all drinks](/shop) to build a balanced order for your home, office or next celebration. DrinksHarbour sells original products and does not sell counterfeit drinks.' },
    ],
  },
];

async function main() {
  await connectDB();
  const created = [];
  const updated = [];
  for (const source of POSTS) {
    const base = slugify(source.title);
    const existing = await BlogPost.find({ slug: new RegExp(`^${base}(-\\d+)?$`) }).select('slug').lean();
    const slug = dedupeSlug(base, existing.map((p) => p.slug));
    const content = sanitizeContentBlocks(source.content);
    const data = {
      ...source,
      slug,
      author: AUTHOR,
      content,
      readTime: computeReadTime(content),
      status: 'draft',
      featured: false,
      externalLinks: buildExternalLinkRecords(content),
      linksCheckedAt: null,
      publishedAt: undefined,
    };
    const post = await BlogPost.findOneAndUpdate(
      { slug },
      { $set: data, $setOnInsert: { createdAt: new Date() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    if (post.createdAt && post.updatedAt && +post.createdAt === +post.updatedAt) created.push(post);
    else updated.push(post);
  }
  console.log(JSON.stringify({
    provider: 'manual-editorial-draft',
    created: created.map((p) => ({ id: p._id, slug: p.slug, title: p.title, status: p.status, readTime: p.readTime })),
    updated: updated.map((p) => ({ id: p._id, slug: p.slug, title: p.title, status: p.status, readTime: p.readTime })),
  }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.stack || err.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
