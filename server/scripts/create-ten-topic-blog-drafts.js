// Ten manually authored SEO blog drafts selected by the user.
// No Anthropic or other AI-provider call is made by this script.
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

const posts = [
  {
    title: 'What Wine Should I Buy? A Simple Guide for Nigerian Beginners',
    category: 'Wine Guide', tags: ['Wine', 'Beginners', 'Nigeria', 'Buying Guide'],
    excerpt: 'Not sure what wine to buy? Use this simple guide to choose red, white, rosé or sparkling wine for your taste, meal and occasion.',
    imageAlt: 'Beginner wine selection with red white rosé and sparkling bottles',
    seo: { metaTitle: 'What Wine Should I Buy in Nigeria?', metaDescription: 'A simple Nigerian beginner’s guide to choosing red, white, rosé and sparkling wine for your taste, meal and occasion.' },
    content: [
      { type: 'p', text: 'If you are wondering what wine to buy, start with the occasion rather than the most expensive label. Wine can be dry or sweet, light or full-bodied, crisp or creamy. The best first bottle is one that matches your taste, your meal and the people you are serving.' },
      { type: 'p', text: 'WSET describes wine as a drink with several characteristics to understand, including sweetness, acidity, body and tannin. You do not need advanced vocabulary to shop well; you only need a few useful clues. Read the [WSET introduction to wine](https://www.wsetglobal.com/knowledge-centre/blog/2021/december/14/what-is-wine/) if you want a deeper foundation.' },
      { type: 'h2', text: 'Choose red wine for richer food and fuller flavour' },
      { type: 'p', text: 'Red wine is a useful choice for grilled meats, tomato-based dishes and meals with smoky or spicy flavours. Cabernet Sauvignon and Shiraz are often fuller and fruit-forward, while Pinot Noir is generally lighter. If you are new to red wine, choose a smooth, fruit-led bottle rather than one described as very tannic.' },
      { type: 'h2', text: 'Choose white wine for freshness' },
      { type: 'p', text: 'White wine is usually served chilled and works well with seafood, chicken, salads and lighter appetisers. Sauvignon Blanc is often crisp and aromatic; Chardonnay can be fresh and citrusy or richer and oak-aged. Browse the [wine collection](/categories/wine) and read the flavour notes before choosing.' },
      { type: 'h2', text: 'Rosé and sparkling wine are easy entertaining choices' },
      { type: 'p', text: 'Rosé is flexible for gatherings because it sits between red and white in style. Sparkling wine is useful for a toast, brunch or celebration. For a mixed group, one red, one white and one alcohol-free option often gives guests more choice than several similar bottles.' },
      { type: 'tip', text: 'Pro tip: If you do not know the guest’s preference, ask whether they normally enjoy sweet, crisp or bold drinks. That answer is more useful than guessing from a favourite colour.' },
      { type: 'p', text: 'Once you know the style, compare size, availability and delivery details, then [shop original wines online](/shop). DrinksHarbour products are sourced through verified channels and are checked before dispatch.' },
    ],
  },
  {
    title: 'Red Wine and Nigerian Food: Pairings for Jollof, Suya and Asun',
    category: 'Wine Guide', tags: ['Red Wine', 'Nigerian Food', 'Pairing', 'Jollof'],
    excerpt: 'Find red wine pairings for jollof rice, suya, asun and other bold Nigerian dishes using simple flavour-matching principles.',
    imageAlt: 'Red wine served beside a Nigerian dinner table',
    seo: { metaTitle: 'Red Wine Pairings for Nigerian Food', metaDescription: 'Discover red wines to pair with jollof rice, suya, asun and spicy Nigerian dishes using simple flavour principles.' },
    content: [
      { type: 'p', text: 'The best red wine for Nigerian food depends on spice, salt, smoke, fat and the sauce—not just the name of the dish. A wine with ripe fruit and balanced acidity can refresh a spicy meal, while a heavy, highly tannic red may feel harder when the food is very hot.' },
      { type: 'p', text: 'The [Wine & Spirit Education Trust’s pairing guide](https://www.wsetglobal.com/knowledge-centre/blog/2023/july/13/four-rules-to-masterful-food-and-wine-pairing/) recommends thinking about the basic components of food and how they change the taste of wine. Use that principle as a starting point, then trust your own palate.' },
      { type: 'h2', text: 'Jollof rice and tomato-based sauces' },
      { type: 'p', text: 'Tomato-based jollof has acidity, spice and savoury depth. Try a red with fresh fruit and moderate tannin, such as a softer Cabernet Sauvignon, Merlot or a fruit-forward Shiraz. Avoid a wine so delicate that the stew overwhelms it.' },
      { type: 'h2', text: 'Suya and smoky grilled meat' },
      { type: 'p', text: 'Suya brings smoke, roasted spice, salt and fat. A medium- to full-bodied red can stand beside those flavours. Shiraz, Malbec and Cabernet Sauvignon are useful styles to explore, especially when the wine has ripe fruit rather than aggressive dryness.' },
      { type: 'h2', text: 'Asun and peppered dishes' },
      { type: 'p', text: 'Pepper heat can make alcohol feel stronger and tannin feel rougher. Choose a juicy red with good fruit character, or move to a rosé if the dish is especially hot. The goal is balance, not a competition between the food and the bottle.' },
      { type: 'tip', text: 'Pro tip: Chill a bold red for 15–20 minutes before serving in hot weather. A slightly cooler serving temperature can make the wine feel fresher with spicy food.' },
      { type: 'p', text: 'Explore [red wines for dinner](/categories/wine), compare tasting notes and [order drinks online](/shop) for your next Nigerian meal.' },
    ],
  },
  {
    title: 'How Much Should You Spend on Wine in Nigeria?',
    category: 'Wine Guide', tags: ['Wine Prices', 'Nigeria', 'Buying Guide', 'Budget'],
    excerpt: 'A practical way to choose wine by budget in Nigeria without assuming that the most expensive bottle is always the best match.',
    imageAlt: 'Wine bottles grouped by budget on a shopping table',
    seo: { metaTitle: 'How Much to Spend on Wine in Nigeria', metaDescription: 'Learn how to choose wine by budget in Nigeria, from everyday bottles to gifting and special-occasion selections.' },
    content: [
      { type: 'p', text: 'Wine prices in Nigeria vary by grape, origin, import costs, bottle size, seller and availability. That means a useful budget guide should help you decide what you need from a bottle rather than promise one universal “best” price. Start with the occasion, then compare style and value within that range.' },
      { type: 'h2', text: 'Everyday wine for a home meal' },
      { type: 'p', text: 'For a weekday meal or casual glass, prioritise freshness, balance and a style you already enjoy. You do not need a prestigious label. A well-made red, white or rosé that matches your food can be more satisfying than a premium bottle opened for the wrong occasion.' },
      { type: 'h2', text: 'Mid-range wine for dinner and entertaining' },
      { type: 'p', text: 'For guests, look for a reliable producer, a clear product description and a style that suits more than one dish. A crisp white, smooth red and versatile rosé can cover a table better than several bottles with similar flavour profiles. Check the volume before comparing prices.' },
      { type: 'h2', text: 'Premium wine for gifting and milestones' },
      { type: 'p', text: 'A premium bottle can make sense when presentation, provenance and the occasion matter. For a gift, consider the recipient’s taste, the label’s condition, the bottle size and whether it arrives in suitable packaging. A thoughtful match is more valuable than an unfamiliar name chosen only for price.' },
      { type: 'h2', text: 'What actually signals value?' },
      { type: 'ul', items: ['A style that matches the meal or recipient.', 'A product description that explains flavour and serving.', 'A seller with clear stock and delivery information.', 'A bottle size that suits the number of people.', 'A price that fits the occasion without stretching the budget.'] },
      { type: 'tip', text: 'Pro tip: Set a per-bottle budget, then compare three similar styles. This gives you a fairer value check than comparing a sweet rosé with a premium aged red.' },
      { type: 'p', text: 'Browse the [wine category](/categories/wine), compare bottles and [shop drinks online in Nigeria](/shop) with delivery information visible before checkout.' },
    ],
  },
  {
    title: 'The Best Whisky Gifts in Nigeria for Birthdays and Promotions',
    category: 'Spirits Guide', tags: ['Whisky Gifts', 'Nigeria', 'Gifting', 'Whisky'],
    excerpt: 'Choose a whisky gift in Nigeria by the recipient’s taste, occasion, presentation and drinking style—not just the price tag.',
    imageAlt: 'Premium whisky bottle prepared as a gift',
    seo: { metaTitle: 'Best Whisky Gifts in Nigeria', metaDescription: 'Choose a whisky gift in Nigeria for birthdays, promotions and milestones with practical advice on style, age and presentation.' },
    content: [
      { type: 'p', text: 'A good whisky gift feels personal. The right bottle depends on whether the recipient is new to whisky, already collects bottles, enjoys cocktails or prefers a slow neat pour. Use the occasion and the drinker’s habits to guide the choice before you compare premium labels.' },
      { type: 'h2', text: 'For someone new to whisky' },
      { type: 'p', text: 'Choose an approachable bottle with a clear style and a balanced profile. Irish whiskey, a smooth blended Scotch or a softer bourbon can be easier starting points than a very smoky or intensely cask-driven expression.' },
      { type: 'h2', text: 'For a whisky enthusiast' },
      { type: 'p', text: 'Look for information that gives the enthusiast something to explore: age statement, cask type, region, bottling strength or a distinctive production style. The [Scotch Whisky Association’s category guide](https://www.scotch-whisky.org.uk/discover-scotch/enjoying-scotch/scotch-whisky-categories/) explains the formal difference between single malt, single grain and blended categories.' },
      { type: 'h2', text: 'For a promotion or milestone' },
      { type: 'p', text: 'A presentation-focused bottle works well for a promotion, retirement or major birthday. Consider the label design, box, bottle size and whether the recipient drinks whisky neat or shares it with guests. Add a handwritten note or appropriate glassware if the occasion allows.' },
      { type: 'h2', text: 'For a host or corporate gift' },
      { type: 'p', text: 'A versatile bottle is safer when you do not know the recipient’s exact preference. Avoid choosing an extremely smoky or sweet style unless you know they enjoy it. A recognised bottle with an accessible profile is usually easier to share.' },
      { type: 'tip', text: 'Pro tip: Never judge a whisky gift by age alone. Age is one useful clue, but flavour, presentation and the recipient’s drinking style are just as important.' },
      { type: 'p', text: 'Explore the [whisky and spirits collection](/categories/spirits), compare bottle sizes and [order a gift online](/shop) with delivery details checked before payment.' },
    ],
  },
  {
    title: 'Macallan Alternatives: 7 Excellent Whiskies to Try Before Spending More',
    category: 'Spirits Guide', tags: ['Whisky', 'Macallan Alternatives', 'Buying Guide', 'Nigeria'],
    excerpt: 'Looking for a whisky like Macallan? Compare seven styles and flavour directions before spending more on a premium bottle.',
    imageAlt: 'A whisky tasting flight with several alternative bottles',
    seo: { metaTitle: '7 Macallan Alternatives to Try in Nigeria', metaDescription: 'Explore seven Macallan alternatives by flavour, style and occasion before you buy a premium whisky online in Nigeria.' },
    content: [
      { type: 'p', text: 'Macallan is a familiar reference point for shoppers looking for a polished, premium single malt. But it is not the only route to a rewarding whisky. You can find excellent alternatives by deciding first whether you want dried fruit, oak, smoke, honey, spice, lightness or a richer texture.' },
      { type: 'h2', text: '1. A sherry-influenced single malt' },
      { type: 'p', text: 'If you enjoy dried fruit, baking spice and a rounded texture, look for another single malt with sherry-cask influence. Read the product description carefully; cask information can tell you more than the brand name alone.' },
      { type: 'h2', text: '2. A honeyed Speyside style' },
      { type: 'p', text: 'Speyside whiskies can offer orchard fruit, honey and gentle spice. They are useful alternatives for someone who wants an approachable, elegant dram without heavy smoke.' },
      { type: 'h2', text: '3. A smoky Islay-style whisky' },
      { type: 'p', text: 'For a completely different experience, try peat and smoke. This is not a direct flavour substitute, but it is a memorable option for a whisky drinker who wants something more coastal, savoury and intense.' },
      { type: 'h2', text: '4. A smooth Irish whiskey' },
      { type: 'p', text: 'Irish whiskey can be a softer, lighter gift for someone who finds single malt too intense. It is also flexible in a highball or simple cocktail.' },
      { type: 'h2', text: '5. A premium bourbon' },
      { type: 'p', text: 'Bourbon offers vanilla, caramel, oak and sweet spice. It makes a good alternative when the drinker enjoys a richer, sweeter profile rather than dried fruit and malt.' },
      { type: 'h2', text: '6. A Japanese whisky style' },
      { type: 'p', text: 'Japanese whisky is often chosen for balance, precision and delicate aroma. Availability can vary, so verify the product details and authenticity before buying.' },
      { type: 'h2', text: '7. A well-made blended whisky' },
      { type: 'p', text: 'A blend can be excellent value and highly enjoyable. Blends combine different malt and grain whiskies to create a consistent style, making them useful for entertaining or cocktails.' },
      { type: 'tip', text: 'Pro tip: Search by flavour direction—rich, smoky, honeyed, spicy or light—rather than searching only for a substitute brand.' },
      { type: 'p', text: 'Browse [whisky online](/categories/spirits) and compare the flavour notes, bottle size and seller before you choose your next pour.' },
    ],
  },
  {
    title: 'Cognac vs Brandy: What’s the Difference and Which Should You Buy?',
    category: 'Spirits Guide', tags: ['Cognac', 'Brandy', 'Spirits Guide', 'Buying Guide'],
    excerpt: 'Cognac is brandy, but not all brandy is Cognac. Learn the difference in origin, production, labels and how to choose a bottle.',
    imageAlt: 'Cognac and brandy glasses beside two bottles',
    seo: { metaTitle: 'Cognac vs Brandy: What Is the Difference?', metaDescription: 'Cognac vs brandy explained: compare origin, production, VS, VSOP and XO labels before buying a bottle in Nigeria.' },
    content: [
      { type: 'p', text: 'Cognac and brandy are related, but the words are not interchangeable. Brandy is a broad family of spirits made by distilling fermented fruit juice or wine. Cognac is a protected regional style produced in the Cognac area of France under specific rules.' },
      { type: 'p', text: 'The official [Cognac FAQ](https://www.cognac.fr/faq/) explains that Cognac is produced in a defined geographical area, distilled twice in a Charentais still and aged in oak. Those origin and production rules are why Cognac is a particular type of brandy rather than a synonym for every fruit spirit.' },
      { type: 'h2', text: 'How brandy differs from Cognac' },
      { type: 'p', text: 'Brandy can be made in many countries from different fruit bases and production methods. It may be young, aged, fruit-forward, sweet, spicy or designed for cocktails. Cognac has a more specific regional identity and label language.' },
      { type: 'h2', text: 'What do VS, VSOP and XO mean?' },
      { type: 'ul', items: ['VS is generally the youngest and most mixable category.', 'VSOP is often chosen for a more rounded sipping or gifting experience.', 'XO indicates a longer minimum ageing category and is commonly reserved for a more special pour.', 'The label describes ageing, but producer style still shapes aroma and texture.'] },
      { type: 'h2', text: 'Which should you buy?' },
      { type: 'p', text: 'Choose Cognac when origin, classic style and a polished gift presentation matter. Choose another brandy when you want to explore different fruit, regional or cocktail styles. Neither is automatically better; they suit different preferences and budgets.' },
      { type: 'tip', text: 'Pro tip: For cocktails, a versatile VS or quality brandy may be more practical. For slow sipping or gifting, compare VSOP and XO options and check the bottle presentation.' },
      { type: 'p', text: 'Explore the [spirits collection](/categories/spirits) and [shop original bottles online](/shop). Check product details and delivery coverage before checkout.' },
    ],
  },
  {
    title: 'How to Build a Home Bar in Nigeria Without Overspending',
    category: 'Entertaining', tags: ['Home Bar', 'Nigeria', 'Cocktails', 'Buying Guide'],
    excerpt: 'Build a useful home bar in stages with versatile spirits, mixers, glassware and non-alcoholic options for Nigerian entertaining.',
    imageAlt: 'Compact home bar with bottles mixers glassware and citrus',
    seo: { metaTitle: 'How to Build a Home Bar in Nigeria', metaDescription: 'Build a practical home bar in Nigeria with versatile spirits, mixers, glassware and alcohol-free options without overspending.' },
    content: [
      { type: 'p', text: 'A home bar does not need dozens of bottles. The smartest setup starts with a few versatile drinks, a small set of mixers and the tools you will actually use. Build it in stages so every purchase earns its place on the shelf.' },
      { type: 'h2', text: 'Start with three base spirits' },
      { type: 'p', text: 'Vodka, gin and whisky cover a wide range of simple serves. Add rum, tequila or cognac later according to what you and your guests enjoy. Choose one bottle from each style before buying several similar expressions.' },
      { type: 'h2', text: 'Add mixers with multiple uses' },
      { type: 'ul', items: ['Tonic water for gin and long drinks.', 'Soda water for lighter highballs and mocktails.', 'Ginger drinks for whisky, rum and alcohol-free serves.', 'Fruit juice for simple punches and breakfast-friendly options.', 'Fresh citrus, ice and water for balance and hydration.'] },
      { type: 'h2', text: 'Choose essential glassware' },
      { type: 'p', text: 'Two or three glass shapes are enough to begin: a tumbler for spirits and short drinks, a tall glass for highballs and a wine glass for wine or sparkling pours. You can add cocktail glasses once you know which drinks you make most often.' },
      { type: 'h2', text: 'Keep non-alcoholic choices visible' },
      { type: 'p', text: 'A thoughtful home bar includes alcohol-free options for drivers, guests taking a break and family members who do not drink. This also makes it easier to host daytime events without building the menu around alcohol.' },
      { type: 'tip', text: 'Pro tip: Before buying a new bottle, name three drinks you can make with it. If you cannot, choose a more versatile option or wait.' },
      { type: 'p', text: 'Browse [spirits](/categories/spirits), [wine](/categories/wine) and [all drinks online](/shop) to build your home bar gradually. Drink responsibly and keep alcoholic products away from children.' },
    ],
  },
  {
    title: 'The Best Drinks to Order Online for a Nigerian Wedding or Large Event',
    category: 'Entertaining', tags: ['Wedding Drinks', 'Events', 'Nigeria', 'Party Planning'],
    excerpt: 'Plan a balanced wedding or event drinks menu with quantity, variety, mixers, water, delivery timing and alcohol-free choices.',
    imageAlt: 'Drinks table prepared for a Nigerian wedding celebration',
    seo: { metaTitle: 'Best Drinks for a Nigerian Wedding or Event', metaDescription: 'Plan drinks for a Nigerian wedding or large event with practical advice on variety, quantities, mixers, water and delivery timing.' },
    content: [
      { type: 'p', text: 'A large event drinks order should be planned around guest count, event length, food and service style. The goal is not to buy the most bottles; it is to make sure guests have enough variety, chilled options, water and alcohol-free choices throughout the celebration.' },
      { type: 'h2', text: 'Build the menu in five groups' },
      { type: 'ul', items: ['Welcome drinks: sparkling wine, juice or a light alcohol-free serve.', 'Wine: one red and one white for dinner and mixed preferences.', 'Spirits: a few versatile options for simple mixed drinks.', 'Beer and soft drinks: easy choices for a busy dance floor.', 'Water and non-alcoholic drinks: visible and continuously available.'] },
      { type: 'h2', text: 'Match drinks to the food' },
      { type: 'p', text: 'For spicy or grilled Nigerian dishes, choose refreshing drinks and wines with fruit or acidity. The [WSET guide to food pairing](https://www.wsetglobal.com/knowledge-centre/blog/2020/june/02/how-to-pair-wine-with-your-favourite-takeaway-meals) explains how salt, acidity, spice and fat change how wine tastes. Use it as a principle rather than a rigid rule.' },
      { type: 'h2', text: 'Plan quantities and service' },
      { type: 'p', text: 'Estimate based on the number of guests, the length of the event and whether drinks are self-service or poured by staff. Add a buffer for popular options, but avoid overbuying products that need special storage. Confirm who will chill bottles, manage ice and monitor responsible service.' },
      { type: 'h2', text: 'Order early and check delivery' },
      { type: 'p', text: 'Place the order with enough time to review stock, delivery fees, order cut-offs and substitutions. Keep a written list of the agreed products and quantities so the event team can receive and organise the delivery efficiently.' },
      { type: 'tip', text: 'Pro tip: Set up a separate alcohol-free station. Guests should not have to ask for water or a non-alcoholic drink while the main bar is busy.' },
      { type: 'p', text: 'Start with [event-friendly drinks](/shop), browse [wine](/categories/wine) and [spirits](/categories/spirits), then confirm delivery details before checkout.' },
    ],
  },
  {
    title: 'How to Check If a Bottle of Alcohol Is Original Before You Buy It',
    category: 'Lifestyle', tags: ['Original Drinks', 'Counterfeit Prevention', 'Nigeria', 'Buying Guide'],
    excerpt: 'Use this practical checklist to assess labels, packaging, seller information and product details before buying alcohol in Nigeria.',
    imageAlt: 'Close view of an alcohol bottle label being checked for authenticity',
    seo: { metaTitle: 'How to Check If Alcohol Is Original in Nigeria', metaDescription: 'Learn how to check alcohol labels, packaging, seller information and product details before buying drinks in Nigeria.' },
    content: [
      { type: 'p', text: 'When buying alcohol, authenticity and traceability matter as much as flavour and price. No visual checklist can replace a regulator or laboratory, but you can reduce risk by buying through a trusted seller and checking the bottle carefully before accepting it.' },
      { type: 'h2', text: 'Buy from a seller with clear information' },
      { type: 'p', text: 'Look for a named business, clear contact information, product details and a transparent checkout process. Be cautious when a bottle is dramatically cheaper than comparable offers, has no product information or is being sold through an untraceable account.' },
      { type: 'h2', text: 'Inspect the label and packaging' },
      { type: 'ul', items: ['Check spelling, print quality, seal and cap condition.', 'Look for batch, volume, alcohol-by-volume and importer or producer information where applicable.', 'Make sure the bottle matches the product name and image shown online.', 'Do not accept packaging that is leaking, tampered with or badly damaged.', 'Keep your receipt and order details.'] },
      { type: 'h2', text: 'Understand the regulatory context' },
      { type: 'p', text: 'Nigeria’s [NAFDAC spirit-drink regulations](https://www.nafdac.gov.ng/wp-content/uploads/Files/Resources/Regulations/All_Regulations/Spirit-Drink-Regulations-2019.pdf) set requirements for spirit-drink labelling and sale. The [NAFDAC product registration portal](https://registration.nafdac.gov.ng/) is also a useful reference for understanding the regulator’s role.' },
      { type: 'h2', text: 'What to do if something looks wrong' },
      { type: 'p', text: 'Do not consume a bottle if the seal, smell, liquid or packaging seems unusual. Photograph the product, keep the receipt and contact the seller. If you suspect a safety issue, follow the appropriate regulator’s complaint process rather than passing the bottle to someone else.' },
      { type: 'tip', text: 'Pro tip: Authenticity begins before delivery. Choose a seller with a documented storefront, product information and customer support, then inspect the package when it arrives.' },
      { type: 'p', text: 'DrinksHarbour sells original products sourced through verified channels and does not sell counterfeit drinks. [Browse the shop](/shop) and review product details before placing an order.' },
    ],
  },
  {
    title: 'Abuja Drinks Delivery: How to Plan an Order for Dinner, Gifting or Events',
    category: 'Lifestyle', tags: ['Abuja', 'Drinks Delivery', 'Online Shopping', 'Nigeria'],
    excerpt: 'Plan an Abuja drinks delivery with a simple checklist for occasion, quantity, stock, delivery timing and responsible receiving.',
    imageAlt: 'Drinks order prepared for delivery in Abuja',
    seo: { metaTitle: 'Abuja Drinks Delivery: Online Ordering Guide', metaDescription: 'Plan an Abuja drinks delivery for dinner, gifting or events with a checklist for products, quantity, timing and checkout.' },
    content: [
      { type: 'p', text: 'A smooth Abuja drinks delivery starts with a clear plan. Whether you need wine for dinner, a whisky gift or drinks for an event, decide what you need first and use the checkout information to confirm availability, delivery area, fees and timing.' },
      { type: 'h2', text: 'Choose the occasion before the bottle' },
      { type: 'p', text: 'Dinner may need one red, one white or a sparkling bottle. A gift may need a premium spirit and suitable presentation. An event usually needs variety, water, mixers and alcohol-free options. Shopping by occasion prevents you from ordering several products that serve the same role.' },
      { type: 'h2', text: 'Make a short shopping list' },
      { type: 'ul', items: ['Main drinks: wine, spirits, beer or non-alcoholic products.', 'Mixers: tonic, soda, juice or ginger drinks.', 'Water and ice for serving and hydration.', 'Quantity and bottle sizes for the guest count.', 'A backup choice in case a preferred product is unavailable.'] },
      { type: 'h2', text: 'Confirm delivery details at checkout' },
      { type: 'p', text: 'Use an accurate address and phone number, review the delivery option and check the final fee before payment. For an event, order early enough to allow time for chilling, organising the drinks table and resolving any change in availability.' },
      { type: 'h2', text: 'Receive and store the order responsibly' },
      { type: 'p', text: 'Make sure an adult is available to receive alcoholic products. Check the packaging and items against your order, then store wine, beer and non-alcoholic drinks according to their product instructions. Keep alcoholic products away from children.' },
      { type: 'tip', text: 'Pro tip: Save your final shopping list and delivery details before checkout. It makes repeat orders for dinners, gifting and events much faster.' },
      { type: 'p', text: 'Begin with [DrinksHarbour’s shop](/shop), browse [wine](/categories/wine) or [spirits](/categories/spirits), and review delivery information before you order online in Abuja.' },
    ],
  },
];

async function main() {
  await connectDB();
  const saved = [];
  for (const source of posts) {
    const base = slugify(source.title);
    const existing = await BlogPost.find({ slug: new RegExp(`^${base}(-\\d+)?$`) }).select('slug').lean();
    const slug = dedupeSlug(base, existing.map((p) => p.slug));
    const content = sanitizeContentBlocks(source.content);
    const data = {
      ...source, slug, author: AUTHOR, content,
      readTime: computeReadTime(content), status: 'draft', featured: false,
      externalLinks: buildExternalLinkRecords(content), linksCheckedAt: null,
    };
    const post = await BlogPost.findOneAndUpdate({ slug }, { $set: data }, { new: true, upsert: true, setDefaultsOnInsert: true }).lean();
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
