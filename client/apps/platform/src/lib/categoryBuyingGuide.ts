export type CategoryBuyingGuide = {
  slug: string;
  name: string;
  description: string;
  advice: string;
  compare: string;
};

// Editorial guidance enriches an existing catalogue category; it never creates one.
const guides: CategoryBuyingGuide[] = [
  { slug: 'gin', name: 'Gin',
    description: 'Buy gin online in Nigeria. Compare London dry, flavoured and botanical bottles, sizes and seller prices. Check delivery options for Abuja and Lagos.',
    advice: 'Start with how you plan to serve it. London dry gin suits a classic gin and tonic; flavoured gin changes the sweetness and mixer choice. Check each bottle’s botanicals and ABV rather than relying on the label colour.',
    compare: 'Compare the same bottle size and ABV, then allow for tonic, ice and delivery in your total budget.' },
  { slug: 'scotch', name: 'Scotch Whisky',
    description: 'Buy Scotch whisky online in Nigeria. Compare single malts and blended Scotch by bottle size, style and seller price, with delivery options at checkout.',
    advice: 'Single malt and blended Scotch are different styles, not a quality ranking. Read the bottle’s region, age statement where supplied and tasting notes; smoky Islay styles and lighter blends suit different preferences.',
    compare: 'Match the expression and bottle size before comparing seller prices. An age statement, gift box or cask edition can change what you are buying.' },
  { slug: 'whisky', name: 'Whisky',
    description: 'Buy whisky online in Nigeria. Explore Scotch, Irish and other whisky styles, compare available bottle sizes and prices, and check delivery before payment.',
    advice: 'Choose a style before choosing a brand. Compare the origin, stated age and tasting notes, then decide whether the bottle is for sipping, mixing or a gift. Not every whisky has an age statement.',
    compare: 'Compare the same expression and size. A larger bottle or presentation pack should not be compared as if it were the standard bottle.' },
  { slug: 'wine', name: 'Wine',
    description: 'Buy wine online in Nigeria. Browse red, white, rosé and sparkling styles, compare bottles and prices, and plan wine for dinner, weddings or gifting.',
    advice: 'Match sweetness, body and serving style to the meal and your guests. Read the origin and grape details where provided. For a wedding, agree the menu and budget before choosing quantities.',
    compare: 'Match the producer, label, vintage where shown and bottle size. Check whether a displayed price is for one bottle or a pack.' },
  { slug: 'tequila', name: 'Tequila',
    description: 'Buy tequila online in Nigeria. Compare blanco, reposado and añejo bottles by size and seller price. Check Abuja and interstate delivery options at checkout.',
    advice: 'Blanco, reposado and añejo describe different maturation styles. Look for the bottle’s agave statement and ABV. Decide whether you want a cocktail ingredient or a sipping bottle before comparing prices.',
    compare: 'Match the expression and bottle size, and read the agave description on the product rather than assuming every tequila is 100% agave.' },
  { slug: 'champagne', name: 'Champagne',
    description: 'Buy champagne online in Nigeria. Compare brut, rosé and other available styles, check bottle sizes and prices, and arrange delivery for celebrations.',
    advice: 'Check the producer, sweetness and bottle size. Champagne and other sparkling wines are different categories; choose by the actual label, not simply the presence of bubbles. Plan chilling and storage before your event.',
    compare: 'Compare the same cuvée and size. Rosé, vintage and gift-box editions can differ in price; ask about your event deadline before ordering.' },
  { slug: 'beer', name: 'Beer',
    description: 'Buy beer online in Nigeria. Compare available lagers, ales and stouts, bottle and can sizes, pack quantities and seller prices before arranging delivery.',
    advice: 'Choose the style and container size your guests prefer. Check ABV and the product’s storage guidance. A case count is not universal, so confirm how many bottles or cans the offer contains.',
    compare: 'Compare the price per bottle or can at the same volume, then include pack count, quantity limits and delivery costs.' },
  { slug: 'non-alcoholic', name: 'Non-Alcoholic Drinks',
    description: 'Buy non-alcoholic drinks online in Nigeria. Compare mixers, soft drinks and alcohol-free options by label, volume and price, with delivery at checkout.',
    advice: 'Check the exact label and ABV where supplied: an alcohol-free claim and a low-alcohol product are not interchangeable. Include water and mixers when planning drinks for a mixed group.',
    compare: 'Compare volume, pack count and ingredients. If you need a strict 0.0% product, confirm the bottle details rather than relying on the category alone.' },
];

const aliases: Record<string, string> = { 'scotch-whisky': 'scotch', wines: 'wine', whiskies: 'whisky', whiskeys: 'whisky', beers: 'beer', nonalcoholic: 'non-alcoholic' };

export function getCategoryBuyingGuide(slug: string): CategoryBuyingGuide | undefined {
  const key = slug.toLowerCase().trim();
  return guides.find(guide => guide.slug === (aliases[key] || key));
}

export function categoryGuideForParams(params: Record<string, string>): CategoryBuyingGuide | undefined {
  if (Object.entries(params).some(([key, value]) => value && key !== 'category' && !(key === 'page' && value === '1'))) return undefined;
  return getCategoryBuyingGuide(params.category || '');
}
