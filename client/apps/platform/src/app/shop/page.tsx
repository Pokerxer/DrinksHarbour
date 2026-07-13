import type { Metadata } from 'next';
import ShopClient from './ShopClient';
import { buildShopSearchParams, parseProductsResponse } from './searchQuery';
import { fetchInitialRecommendations } from '@/components/Shop/recommendations';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.drinksharbour.com';
const SITE_NAME = 'DrinksHarbour';

// Duplicate/legacy category slugs mapped onto the one real catalog slug, so
// their pages canonicalize to a single URL instead of cannibalizing each other.
const CATEGORY_CANONICAL_ALIASES: Record<string, string> = {
  'scotch-whisky': 'scotch',
};

// Fetch the initial product page on the server so the grid — product names,
// prices and crawlable /product/<slug> links — is present in the raw HTML for
// search engines. ShopClient hydrates from this and takes over filtering.
async function fetchInitialProducts(
  params: Record<string, string>,
): Promise<{ products: any[]; total: number }> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
  if (!API_URL) return { products: [], total: 0 };
  try {
    const sp = new URLSearchParams(
      Object.entries(params).filter(([, v]) => typeof v === 'string') as [string, string][],
    );
    const query = buildShopSearchParams(sp).toString();
    const res = await fetch(`${API_URL}/api/products/search?${query}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return { products: [], total: 0 };
    return parseProductsResponse(await res.json());
  } catch {
    return { products: [], total: 0 };
  }
}

// ─── Label maps ───────────────────────────────────────────────────────────────

type LabelEntry = { title: string; description: string; keywords: string[] };

const CATEGORY_LABELS: Record<string, LabelEntry> = {
  whisky: {
    title: 'Whisky',
    description: 'Shop premium Scotch, Irish, Japanese & bourbon whiskies delivered across Nigeria',
    keywords: [
      'buy whisky Nigeria', 'whisky online Nigeria', 'whisky delivery Nigeria',
      'buy Scotch whisky Nigeria', 'single malt Nigeria', 'blended Scotch Nigeria',
      'best whisky Nigeria', 'premium whisky Nigeria', 'whisky price Nigeria',
      'buy whisky Lagos', 'buy whisky Abuja', 'buy whisky Port Harcourt',
      'Glenfiddich Nigeria', 'Macallan Nigeria', 'Johnnie Walker Nigeria',
      'Chivas Regal Nigeria', 'order whisky Nigeria', 'whisky store Nigeria',
    ],
  },
  whiskey: {
    title: 'Whiskey',
    description: 'Shop premium American, Irish & blended whiskeys delivered in Nigeria',
    keywords: [
      'buy whiskey Nigeria', 'whiskey online Nigeria', 'American whiskey Nigeria',
      'buy bourbon Nigeria', 'Irish whiskey Nigeria', 'Jack Daniels Nigeria',
      'Jameson Nigeria', 'Bulleit Nigeria', 'Makers Mark Nigeria',
      'whiskey price Nigeria', 'buy whiskey Lagos', 'buy whiskey Abuja',
      'Tennessee whiskey Nigeria', 'rye whiskey Nigeria',
    ],
  },
  scotch: {
    title: 'Scotch Whisky',
    description: 'Shop premium Scotch whiskies — single malts, blended Scotch & Islay expressions delivered in Nigeria',
    keywords: [
      'buy Scotch whisky Nigeria', 'Scotch online Nigeria', 'Scotch delivery Nigeria',
      'single malt Scotch Nigeria', 'blended Scotch Nigeria', 'Islay Scotch Nigeria',
      'Highlands Scotch Nigeria', 'Speyside whisky Nigeria', 'Lowlands Scotch Nigeria',
      'best Scotch Nigeria', 'Scotch price Nigeria', 'buy Scotch Lagos', 'buy Scotch Abuja',
      'Glenfiddich Nigeria', 'Macallan Nigeria', 'Johnnie Walker Nigeria',
      'Chivas Regal Nigeria', 'Ballantines Nigeria', 'Lagavulin Nigeria',
      'Ardbeg Nigeria', 'Laphroaig Nigeria', 'Scotch whisky store Nigeria',
      'premium Scotch Nigeria', 'order Scotch whisky Nigeria',
    ],
  },
  'scotch-whisky': {
    title: 'Scotch Whisky',
    description: 'Shop premium Scotch whiskies — single malts, blended Scotch & Islay expressions delivered in Nigeria',
    keywords: [
      'buy Scotch whisky Nigeria', 'Scotch online Nigeria', 'Scotch delivery Nigeria',
      'single malt Scotch Nigeria', 'blended Scotch Nigeria', 'Scotch price Nigeria',
      'Glenfiddich Nigeria', 'Macallan Nigeria', 'Johnnie Walker Nigeria',
      'best Scotch Nigeria', 'buy Scotch Lagos', 'buy Scotch Abuja',
    ],
  },
  wine: {
    title: 'Wine',
    description: 'Explore red, white, rosé & sparkling wines from around the world, delivered in Nigeria',
    keywords: [
      'buy wine Nigeria', 'wine online Nigeria', 'wine delivery Nigeria',
      'red wine Nigeria', 'white wine Nigeria', 'rosé wine Nigeria',
      'sparkling wine Nigeria', 'best wine Nigeria', 'wine price Nigeria',
      'buy wine Lagos', 'buy wine Abuja', 'imported wine Nigeria',
      'wine shop Nigeria', 'order wine Nigeria', 'wine delivery Lagos',
      'Bordeaux Nigeria', 'Merlot Nigeria', 'Chardonnay Nigeria', 'Sauvignon Blanc Nigeria',
    ],
  },
  champagne: {
    title: 'Champagne',
    description: 'Premium champagnes & sparkling wines delivered in Nigeria',
    keywords: [
      'buy champagne Nigeria', 'champagne online Nigeria', 'champagne delivery Nigeria',
      'Moët Chandon Nigeria', 'Veuve Clicquot Nigeria', 'Dom Perignon Nigeria',
      'Perrier Jouet Nigeria', 'buy Moët Nigeria', 'champagne price Nigeria',
      'buy champagne Lagos', 'buy champagne Abuja', 'cheap champagne Nigeria',
      'luxury champagne Nigeria', 'Bollinger Nigeria', 'Krug Nigeria',
    ],
  },
  vodka: {
    title: 'Vodka',
    description: 'Premium & flavoured vodkas available online in Nigeria with fast delivery',
    keywords: [
      'buy vodka Nigeria', 'vodka online Nigeria', 'vodka delivery Nigeria',
      'Ciroc Nigeria', 'buy Ciroc Nigeria', 'Grey Goose Nigeria',
      'Belvedere Nigeria', 'Absolut Nigeria', 'Ketel One Nigeria',
      'premium vodka Nigeria', 'vodka price Nigeria', 'buy vodka Lagos',
      'buy vodka Abuja', 'flavoured vodka Nigeria', 'order vodka Nigeria',
    ],
  },
  rum: {
    title: 'Rum',
    description: 'Dark, white & spiced rums delivered across Nigeria',
    keywords: [
      'buy rum Nigeria', 'rum online Nigeria', 'rum delivery Nigeria',
      'Captain Morgan Nigeria', 'Bacardi Nigeria', 'Havana Club Nigeria',
      'Appleton Estate Nigeria', 'dark rum Nigeria', 'spiced rum Nigeria',
      'white rum Nigeria', 'rum price Nigeria', 'buy rum Lagos',
      'buy rum Abuja', 'aged rum Nigeria', 'Caribbean rum Nigeria',
    ],
  },
  gin: {
    title: 'Gin',
    description: 'London dry, craft & flavoured gins online in Nigeria',
    keywords: [
      'buy gin Nigeria', 'gin online Nigeria', 'gin delivery Nigeria',
      'Hendricks Nigeria', 'Tanqueray Nigeria', 'Bombay Sapphire Nigeria',
      'Gordon\'s gin Nigeria', 'craft gin Nigeria', 'London dry gin Nigeria',
      'pink gin Nigeria', 'gin price Nigeria', 'buy gin Lagos',
      'buy gin Abuja', 'premium gin Nigeria', 'flavoured gin Nigeria',
      'Monkey 47 Nigeria', 'Roku gin Nigeria',
    ],
  },
  tequila: {
    title: 'Tequila',
    description: 'Blanco, reposado & añejo tequilas delivered in Nigeria',
    keywords: [
      'buy tequila Nigeria', 'tequila online Nigeria', 'tequila delivery Nigeria',
      'Patron Nigeria', 'Don Julio Nigeria', 'Jose Cuervo Nigeria',
      'Casamigos Nigeria', 'Olmeca Nigeria', '1800 Tequila Nigeria',
      'tequila price Nigeria', 'buy tequila Lagos', 'blanco tequila Nigeria',
      'reposado tequila Nigeria', 'añejo tequila Nigeria', 'premium tequila Nigeria',
    ],
  },
  mezcal: {
    title: 'Mezcal',
    description: 'Artisanal & premium mezcals delivered in Nigeria',
    keywords: [
      'buy mezcal Nigeria', 'mezcal online Nigeria', 'artisanal mezcal Nigeria',
      'Del Maguey Nigeria', 'Montelobos Nigeria', 'smoky spirits Nigeria',
      'mezcal price Nigeria', 'premium mezcal Nigeria',
    ],
  },
  brandy: {
    title: 'Brandy & Cognac',
    description: 'Premium brandies, cognacs & armagnacs in Nigeria',
    keywords: [
      'buy brandy Nigeria', 'brandy online Nigeria', 'brandy delivery Nigeria',
      'buy cognac Nigeria', 'Hennessy Nigeria', 'Rémy Martin Nigeria',
      'brandy price Nigeria', 'premium brandy Nigeria', 'buy brandy Lagos',
      'Klipdrift Nigeria', 'brandy and cognac Nigeria',
    ],
  },
  cognac: {
    title: 'Cognac',
    description: 'Hennessy, Rémy Martin, Martell & more delivered in Nigeria',
    keywords: [
      'buy cognac Nigeria', 'cognac online Nigeria', 'cognac delivery Nigeria',
      'Hennessy Nigeria', 'buy Hennessy Nigeria', 'Hennessy VS Nigeria',
      'Hennessy VSOP Nigeria', 'Hennessy XO Nigeria', 'Hennessy price Nigeria',
      'Rémy Martin Nigeria', 'Remy Martin VSOP Nigeria', 'Remy Martin XO Nigeria',
      'Martell Nigeria', 'Courvoisier Nigeria', 'Hennessy Pure White Nigeria',
      'cognac price Nigeria', 'buy cognac Lagos', 'buy cognac Abuja',
      'XO cognac Nigeria', 'VSOP cognac Nigeria', 'best cognac Nigeria',
      'cognac gift Nigeria', 'luxury cognac Nigeria',
    ],
  },
  beer: {
    title: 'Beer',
    description: 'Craft beers, lagers, ales & stouts delivered in Nigeria',
    keywords: [
      'buy beer Nigeria', 'beer online Nigeria', 'beer delivery Nigeria',
      'craft beer Nigeria', 'imported beer Nigeria', 'Corona Nigeria',
      'Heineken Nigeria', 'Stella Artois Nigeria', 'Guinness Nigeria',
      'beer price Nigeria', 'buy beer Lagos', 'buy beer Abuja',
      'IPA Nigeria', 'stout Nigeria', 'lager Nigeria', 'ale Nigeria',
      'foreign beer Nigeria', 'order beer online Nigeria',
    ],
  },
  cider: {
    title: 'Cider',
    description: 'Premium ciders & fruit ciders delivered in Nigeria',
    keywords: [
      'buy cider Nigeria', 'cider online Nigeria', 'cider delivery Nigeria',
      'Savanna cider Nigeria', 'Strongbow Nigeria', 'Hunters cider Nigeria',
      'fruit cider Nigeria', 'cider price Nigeria', 'apple cider Nigeria',
    ],
  },
  liqueur: {
    title: 'Liqueurs',
    description: 'Amaretto, triple sec, cream liqueurs & more in Nigeria',
    keywords: [
      'buy liqueur Nigeria', 'liqueur online Nigeria', 'liqueur delivery Nigeria',
      'Baileys Nigeria', 'Kahlúa Nigeria', 'Amarula Nigeria',
      'Disaronno Nigeria', 'triple sec Nigeria', 'cream liqueur Nigeria',
      'Cointreau Nigeria', 'Frangelico Nigeria', 'liqueur price Nigeria',
      'buy Baileys Nigeria', 'cocktail liqueur Nigeria',
    ],
  },
  'non-alcoholic': {
    title: 'Non-Alcoholic',
    description: 'Premium non-alcoholic drinks, mocktail ingredients & alcohol-free spirits',
    keywords: [
      'buy non-alcoholic drinks Nigeria', 'alcohol-free drinks Nigeria',
      'mocktail ingredients Nigeria', 'non-alcoholic spirits Nigeria',
      'non-alcoholic wine Nigeria', 'non-alcoholic beer Nigeria',
      'Seedlip Nigeria', 'sober drinks Nigeria', 'zero alcohol Nigeria',
      'non-alcoholic beverages Nigeria', 'buy alcohol-free Nigeria',
    ],
  },
  spirits: {
    title: 'Spirits',
    description: 'Premium spirits — whisky, gin, rum, vodka, tequila & more delivered in Nigeria',
    keywords: [
      'buy spirits Nigeria', 'spirits online Nigeria', 'spirits delivery Nigeria',
      'premium spirits Nigeria', 'spirits price Nigeria', 'buy spirits Lagos',
      'buy spirits Abuja', 'online spirits store Nigeria', 'alcohol delivery Nigeria',
      'order spirits Nigeria', 'spirits shop Nigeria',
    ],
  },
  sake: {
    title: 'Sake',
    description: 'Japanese sake & rice wines delivered in Nigeria',
    keywords: [
      'buy sake Nigeria', 'Japanese sake Nigeria', 'rice wine Nigeria',
      'sake delivery Nigeria', 'sake price Nigeria', 'premium sake Nigeria',
    ],
  },
  port: {
    title: 'Port & Fortified',
    description: 'Port wines, sherry & fortified wines delivered in Nigeria',
    keywords: [
      'buy port wine Nigeria', 'port wine Nigeria', 'sherry Nigeria',
      'fortified wine Nigeria', 'Tawny port Nigeria', 'Ruby port Nigeria',
      'port wine delivery Nigeria', 'buy sherry Nigeria',
    ],
  },
  bitters: {
    title: 'Bitters',
    description: 'Cocktail bitters, amaro & aperitivo in Nigeria',
    keywords: [
      'buy bitters Nigeria', 'cocktail bitters Nigeria', 'Angostura Nigeria',
      'amaro Nigeria', 'Aperol Nigeria', 'Campari Nigeria',
      'aperitivo Nigeria', 'bitters delivery Nigeria',
    ],
  },
  mixers: {
    title: 'Mixers & Sodas',
    description: 'Premium cocktail mixers, tonics & sodas in Nigeria',
    keywords: [
      'buy cocktail mixers Nigeria', 'tonic water Nigeria', 'Fever-Tree Nigeria',
      'premium mixers Nigeria', 'cocktail soda Nigeria', 'ginger beer Nigeria',
      'soda water Nigeria', 'mixers delivery Nigeria',
    ],
  },
  'gift-sets': {
    title: 'Gift Sets',
    description: 'Premium drinks gift sets & hampers delivered in Nigeria',
    keywords: [
      'buy drinks gift set Nigeria', 'whisky gift set Nigeria', 'cognac gift Nigeria',
      'drinks hamper Nigeria', 'alcohol gift Nigeria', 'wine gift set Nigeria',
      'luxury drinks gift Nigeria', 'gift delivery Nigeria', 'drinks hamper Lagos',
      'corporate gift drinks Nigeria', 'birthday drinks gift Nigeria',
    ],
  },
};

const SUBCATEGORY_LABELS: Record<string, LabelEntry> = {
  // Whisky
  'single-malt': {
    title: 'Single Malt Whisky',
    description: 'Shop single malt Scotch & single malt whiskies online in Nigeria — Glenfiddich, Macallan, Glenlivet & more',
    keywords: [
      'buy single malt whisky Nigeria', 'single malt Scotch Nigeria',
      'Glenfiddich Nigeria', 'Macallan Nigeria', 'Glenlivet Nigeria',
      'Laphroaig Nigeria', 'Ardbeg Nigeria', 'Balvenie Nigeria',
      'single malt delivery Nigeria', 'best single malt Nigeria',
      'single malt price Nigeria', 'Highlands whisky Nigeria',
      'Speyside whisky Nigeria', 'Islay whisky Nigeria',
    ],
  },
  'single malt': {
    title: 'Single Malt Whisky',
    description: 'Shop single malt Scotch & single malt whiskies online in Nigeria — Glenfiddich, Macallan, Glenlivet & more',
    keywords: [
      'buy single malt whisky Nigeria', 'single malt Scotch Nigeria',
      'Glenfiddich Nigeria', 'Macallan Nigeria', 'Glenlivet Nigeria',
      'single malt delivery Nigeria', 'best single malt Nigeria',
      'single malt price Nigeria', 'Speyside whisky Nigeria',
    ],
  },
  blended: {
    title: 'Blended Whisky',
    description: 'Shop blended Scotch & blended whiskies online in Nigeria — Johnnie Walker, Chivas Regal, Ballantine\'s & more',
    keywords: [
      'buy blended Scotch Nigeria', 'blended whisky Nigeria',
      'Johnnie Walker Nigeria', 'Chivas Regal Nigeria', 'Ballantines Nigeria',
      'Dewar\'s Nigeria', 'Famous Grouse Nigeria', 'J&B Nigeria',
      'Black Label Nigeria', 'Blue Label Nigeria', 'Gold Label Nigeria',
      'blended whisky delivery Nigeria', 'blended whisky price Nigeria',
    ],
  },
  bourbon: {
    title: 'Bourbon Whiskey',
    description: 'Shop premium American bourbon whiskeys delivered in Nigeria — Jack Daniel\'s, Maker\'s Mark, Woodford Reserve & more',
    keywords: [
      'buy bourbon Nigeria', 'bourbon whiskey Nigeria', 'Jack Daniels Nigeria',
      'Makers Mark Nigeria', 'Woodford Reserve Nigeria', 'Bulleit Bourbon Nigeria',
      'Jim Beam Nigeria', 'Wild Turkey Nigeria', 'Buffalo Trace Nigeria',
      'American bourbon Nigeria', 'bourbon delivery Nigeria', 'bourbon price Nigeria',
      'best bourbon Nigeria', 'Tennessee whiskey Nigeria',
    ],
  },
  'irish whiskey': {
    title: 'Irish Whiskey',
    description: 'Shop Jameson, Bushmills, Redbreast & more Irish whiskeys delivered in Nigeria',
    keywords: [
      'buy Irish whiskey Nigeria', 'Jameson Nigeria', 'buy Jameson Nigeria',
      'Jameson price Nigeria', 'Bushmills Nigeria', 'Redbreast Nigeria',
      'Tullamore Dew Nigeria', 'Powers Irish whiskey Nigeria',
      'Irish whiskey delivery Nigeria', 'best Irish whiskey Nigeria',
      'smooth Irish whiskey Nigeria',
    ],
  },
  'japanese whisky': {
    title: 'Japanese Whisky',
    description: 'Shop Suntory, Nikka & premium Japanese whiskies in Nigeria',
    keywords: [
      'buy Japanese whisky Nigeria', 'Suntory Nigeria', 'Nikka Nigeria',
      'Hibiki Nigeria', 'Yamazaki Nigeria', 'Hakushu Nigeria',
      'Toki whisky Nigeria', 'Japanese whisky delivery Nigeria',
      'best Japanese whisky Nigeria', 'Japanese whisky price Nigeria',
    ],
  },
  rye: {
    title: 'Rye Whiskey',
    description: 'Shop premium rye whiskeys delivered in Nigeria',
    keywords: [
      'buy rye whiskey Nigeria', 'rye whiskey Nigeria', 'Bulleit Rye Nigeria',
      'WhistlePig Nigeria', 'Rittenhouse rye Nigeria', 'rye whiskey delivery Nigeria',
    ],
  },
  // Wine
  'red wine': {
    title: 'Red Wine',
    description: 'Shop premium red wines from Bordeaux, Tuscany, Napa & more, delivered in Nigeria',
    keywords: [
      'buy red wine Nigeria', 'red wine online Nigeria', 'red wine delivery Nigeria',
      'Cabernet Sauvignon Nigeria', 'Merlot Nigeria', 'Shiraz Nigeria',
      'Pinot Noir Nigeria', 'Malbec Nigeria', 'Bordeaux Nigeria',
      'Chianti Nigeria', 'red wine price Nigeria', 'best red wine Nigeria',
      'buy red wine Lagos', 'buy red wine Abuja',
    ],
  },
  'white wine': {
    title: 'White Wine',
    description: 'Shop crisp white wines — Chardonnay, Sauvignon Blanc, Pinot Grigio & more in Nigeria',
    keywords: [
      'buy white wine Nigeria', 'white wine online Nigeria', 'white wine delivery Nigeria',
      'Chardonnay Nigeria', 'Sauvignon Blanc Nigeria', 'Pinot Grigio Nigeria',
      'Riesling Nigeria', 'white wine price Nigeria', 'best white wine Nigeria',
      'dry white wine Nigeria', 'buy white wine Lagos',
    ],
  },
  'rosé': {
    title: 'Rosé Wine',
    description: 'Shop premium rosé wines delivered in Nigeria',
    keywords: [
      'buy rosé wine Nigeria', 'rose wine Nigeria', 'pink wine Nigeria',
      'Whispering Angel Nigeria', 'Provence rosé Nigeria',
      'rosé wine delivery Nigeria', 'rosé wine price Nigeria',
    ],
  },
  rose: {
    title: 'Rosé Wine',
    description: 'Shop premium rosé wines delivered in Nigeria',
    keywords: [
      'buy rosé wine Nigeria', 'rose wine Nigeria', 'pink wine Nigeria',
      'rosé wine delivery Nigeria', 'rosé wine price Nigeria',
    ],
  },
  sparkling: {
    title: 'Sparkling Wine',
    description: 'Shop Prosecco, Cava & sparkling wines delivered in Nigeria',
    keywords: [
      'buy sparkling wine Nigeria', 'Prosecco Nigeria', 'Cava Nigeria',
      'sparkling wine delivery Nigeria', 'buy Prosecco Nigeria',
      'sparkling wine price Nigeria', 'celebratory wine Nigeria',
    ],
  },
  'dessert wine': {
    title: 'Dessert Wine',
    description: 'Shop Sauternes, ice wine & dessert wines in Nigeria',
    keywords: [
      'buy dessert wine Nigeria', 'sweet wine Nigeria', 'Sauternes Nigeria',
      'dessert wine delivery Nigeria', 'port wine Nigeria', 'ice wine Nigeria',
    ],
  },
  // Rum
  'dark rum': {
    title: 'Dark Rum',
    description: 'Shop rich dark rums & aged rums delivered in Nigeria',
    keywords: [
      'buy dark rum Nigeria', 'dark rum online Nigeria', 'dark rum delivery Nigeria',
      'aged rum Nigeria', 'Appleton Estate Nigeria', 'Diplomatico Nigeria',
      'dark rum price Nigeria', 'premium dark rum Nigeria',
    ],
  },
  'white rum': {
    title: 'White Rum',
    description: 'Shop light & white rums for cocktails in Nigeria',
    keywords: [
      'buy white rum Nigeria', 'white rum online Nigeria', 'Bacardi white Nigeria',
      'cocktail rum Nigeria', 'light rum Nigeria', 'white rum delivery Nigeria',
    ],
  },
  'spiced rum': {
    title: 'Spiced Rum',
    description: 'Shop flavoured & spiced rums delivered in Nigeria',
    keywords: [
      'buy spiced rum Nigeria', 'Captain Morgan Nigeria', 'Sailor Jerry Nigeria',
      'spiced rum delivery Nigeria', 'flavoured rum Nigeria', 'spiced rum price Nigeria',
    ],
  },
  // Gin
  'london dry': {
    title: 'London Dry Gin',
    description: 'Shop classic London dry gins in Nigeria',
    keywords: [
      'buy London dry gin Nigeria', 'Tanqueray Nigeria', 'Beefeater Nigeria',
      'Gordon\'s gin Nigeria', 'London dry gin delivery Nigeria',
      'classic gin Nigeria', 'dry gin Nigeria', 'gin price Nigeria',
    ],
  },
  'craft gin': {
    title: 'Craft Gin',
    description: 'Shop artisanal & craft gins delivered in Nigeria',
    keywords: [
      'buy craft gin Nigeria', 'artisan gin Nigeria', 'Monkey 47 Nigeria',
      'Hendricks Nigeria', 'craft gin delivery Nigeria', 'small batch gin Nigeria',
    ],
  },
  'flavoured gin': {
    title: 'Flavoured Gin',
    description: 'Shop pink, citrus & flavoured gins in Nigeria',
    keywords: [
      'buy flavoured gin Nigeria', 'pink gin Nigeria', 'fruit gin Nigeria',
      'Gordon\'s Pink Nigeria', 'citrus gin Nigeria', 'flavoured gin delivery Nigeria',
    ],
  },
  // Beer
  'craft beer': {
    title: 'Craft Beer',
    description: 'Shop artisanal craft beers delivered in Nigeria',
    keywords: [
      'buy craft beer Nigeria', 'artisan beer Nigeria', 'microbrewery beer Nigeria',
      'craft IPA Nigeria', 'craft beer delivery Nigeria', 'craft beer Lagos',
    ],
  },
  lager: {
    title: 'Lager',
    description: 'Shop premium lager beers delivered in Nigeria',
    keywords: [
      'buy lager Nigeria', 'Heineken Nigeria', 'Corona lager Nigeria',
      'Stella Artois Nigeria', 'premium lager Nigeria', 'lager delivery Nigeria',
      'imported lager Nigeria', 'lager price Nigeria',
    ],
  },
  stout: {
    title: 'Stout',
    description: 'Shop Guinness & premium stouts delivered in Nigeria',
    keywords: [
      'buy stout Nigeria', 'Guinness Nigeria', 'Guinness Foreign Extra Nigeria',
      'premium stout Nigeria', 'stout delivery Nigeria', 'dark beer Nigeria',
      'Murphy\'s stout Nigeria',
    ],
  },
  ale: {
    title: 'Ale',
    description: 'Shop ales, IPAs & craft ales in Nigeria',
    keywords: [
      'buy ale Nigeria', 'pale ale Nigeria', 'craft ale Nigeria',
      'ale delivery Nigeria', 'British ale Nigeria', 'ale price Nigeria',
    ],
  },
  ipa: {
    title: 'IPA',
    description: 'Shop India Pale Ales delivered in Nigeria',
    keywords: [
      'buy IPA Nigeria', 'India Pale Ale Nigeria', 'craft IPA Nigeria',
      'IPA delivery Nigeria', 'hoppy beer Nigeria', 'IPA beer Nigeria',
    ],
  },
  // Wine varietals (often used as subcategory)
  chardonnay: {
    title: 'Chardonnay',
    description: 'Shop premium Chardonnay wines delivered in Nigeria — oaked, unoaked & Burgundy styles',
    keywords: [
      'buy Chardonnay Nigeria', 'Chardonnay online Nigeria', 'Chardonnay delivery Nigeria',
      'white Burgundy Nigeria', 'oaked Chardonnay Nigeria', 'unoaked Chardonnay Nigeria',
      'Chardonnay price Nigeria', 'best Chardonnay Nigeria', 'Chardonnay wine Nigeria',
      '19 Crimes Chardonnay Nigeria', 'Chardonnay Lagos', 'Chardonnay Abuja',
    ],
  },
  'sauvignon-blanc': {
    title: 'Sauvignon Blanc',
    description: 'Shop crisp Sauvignon Blanc wines from New Zealand, France & more in Nigeria',
    keywords: [
      'buy Sauvignon Blanc Nigeria', 'Sauvignon Blanc online Nigeria',
      'Marlborough Sauvignon Blanc Nigeria', 'New Zealand wine Nigeria',
      'Sauvignon Blanc price Nigeria', 'Sauvignon Blanc delivery Nigeria',
      'Kim Crawford Nigeria', 'Cloudy Bay Nigeria',
    ],
  },
  'sauvignon blanc': {
    title: 'Sauvignon Blanc',
    description: 'Shop crisp Sauvignon Blanc wines from New Zealand, France & more in Nigeria',
    keywords: [
      'buy Sauvignon Blanc Nigeria', 'Sauvignon Blanc online Nigeria',
      'Sauvignon Blanc price Nigeria', 'Sauvignon Blanc delivery Nigeria',
    ],
  },
  'cabernet-sauvignon': {
    title: 'Cabernet Sauvignon',
    description: 'Shop bold Cabernet Sauvignon red wines from Napa, Bordeaux & more in Nigeria',
    keywords: [
      'buy Cabernet Sauvignon Nigeria', 'Cab Sav Nigeria', 'Cabernet wine Nigeria',
      'Napa Cabernet Nigeria', 'Bordeaux Nigeria', 'full-bodied red wine Nigeria',
      'Cabernet Sauvignon price Nigeria', 'Cabernet delivery Nigeria',
      '19 Crimes Cabernet Nigeria', 'Cabernet Lagos', 'Cabernet Abuja',
    ],
  },
  'cabernet sauvignon': {
    title: 'Cabernet Sauvignon',
    description: 'Shop bold Cabernet Sauvignon red wines from Napa, Bordeaux & more in Nigeria',
    keywords: [
      'buy Cabernet Sauvignon Nigeria', 'Cab Sav Nigeria',
      'Cabernet Sauvignon price Nigeria', 'Cabernet delivery Nigeria',
    ],
  },
  merlot: {
    title: 'Merlot',
    description: 'Shop smooth, velvety Merlot red wines delivered in Nigeria',
    keywords: [
      'buy Merlot Nigeria', 'Merlot wine Nigeria', 'Merlot delivery Nigeria',
      'Merlot price Nigeria', 'smooth red wine Nigeria', 'Merlot Lagos',
    ],
  },
  'pinot-noir': {
    title: 'Pinot Noir',
    description: 'Shop elegant Pinot Noir red wines from Burgundy, Oregon & more in Nigeria',
    keywords: [
      'buy Pinot Noir Nigeria', 'Pinot Noir wine Nigeria', 'Pinot Noir delivery Nigeria',
      'red Burgundy Nigeria', 'Pinot Noir price Nigeria', 'Pinot Noir Lagos',
    ],
  },
  'pinot noir': {
    title: 'Pinot Noir',
    description: 'Shop elegant Pinot Noir red wines from Burgundy, Oregon & more in Nigeria',
    keywords: [
      'buy Pinot Noir Nigeria', 'Pinot Noir price Nigeria', 'Pinot Noir delivery Nigeria',
    ],
  },
  malbec: {
    title: 'Malbec',
    description: 'Shop rich Argentine & French Malbec wines delivered in Nigeria',
    keywords: [
      'buy Malbec Nigeria', 'Malbec wine Nigeria', 'Argentine Malbec Nigeria',
      'Malbec delivery Nigeria', 'Malbec price Nigeria', 'Malbec Lagos',
    ],
  },
  shiraz: {
    title: 'Shiraz',
    description: 'Shop bold Australian & South African Shiraz wines delivered in Nigeria',
    keywords: [
      'buy Shiraz Nigeria', 'Shiraz wine Nigeria', 'Syrah Nigeria',
      'Australian Shiraz Nigeria', 'Shiraz delivery Nigeria', 'Shiraz price Nigeria',
    ],
  },
  prosecco: {
    title: 'Prosecco',
    description: 'Shop premium Prosecco sparkling wines delivered in Nigeria',
    keywords: [
      'buy Prosecco Nigeria', 'Prosecco online Nigeria', 'Prosecco delivery Nigeria',
      'Italian sparkling wine Nigeria', 'Prosecco price Nigeria',
      'Prosecco Lagos', 'cheap Prosecco Nigeria', 'celebration wine Nigeria',
    ],
  },
  // Whisky sub-types often used as standalone subcategory
  'single-barrel': {
    title: 'Single Barrel Whisky',
    description: 'Shop rare single barrel & single cask whiskies delivered in Nigeria',
    keywords: [
      'buy single barrel whisky Nigeria', 'single cask whisky Nigeria',
      'rare whisky Nigeria', 'limited edition whisky Nigeria', 'single barrel price Nigeria',
    ],
  },
  'cask-strength': {
    title: 'Cask Strength Whisky',
    description: 'Shop high-proof cask strength whiskies delivered in Nigeria',
    keywords: [
      'buy cask strength whisky Nigeria', 'barrel proof whisky Nigeria',
      'high ABV whisky Nigeria', 'cask strength delivery Nigeria',
    ],
  },
  // Vodka
  'flavoured vodka': {
    title: 'Flavoured Vodka',
    description: 'Shop premium flavoured vodkas in Nigeria',
    keywords: [
      'buy flavoured vodka Nigeria', 'Ciroc flavours Nigeria', 'fruit vodka Nigeria',
      'flavoured vodka delivery Nigeria', 'peach vodka Nigeria', 'berry vodka Nigeria',
    ],
  },
  'premium vodka': {
    title: 'Premium Vodka',
    description: 'Shop Grey Goose, Belvedere & premium vodkas in Nigeria',
    keywords: [
      'buy premium vodka Nigeria', 'Grey Goose Nigeria', 'Belvedere Nigeria',
      'Ketel One Nigeria', 'premium vodka delivery Nigeria', 'luxury vodka Nigeria',
    ],
  },
};

const ORIGIN_LABELS: Record<string, LabelEntry> = {
  scotland: {
    title: 'Scottish',
    description: 'Shop premium Scotch whisky & Scottish spirits — single malts, blends & more in Nigeria',
    keywords: [
      'buy Scotch whisky Nigeria', 'Scottish whisky Nigeria', 'Scotch delivery Nigeria',
      'Highlands Scotch Nigeria', 'Speyside whisky Nigeria', 'Islay whisky Nigeria',
      'Lowlands Scotch Nigeria', 'Scottish spirits Nigeria', 'Scotch price Nigeria',
    ],
  },
  ireland: {
    title: 'Irish',
    description: 'Shop authentic Irish whiskey & Irish spirits delivered in Nigeria',
    keywords: [
      'buy Irish whiskey Nigeria', 'Irish spirits Nigeria', 'Jameson Nigeria',
      'Bushmills Nigeria', 'Irish whiskey delivery Nigeria', 'Irish spirits price Nigeria',
    ],
  },
  japan: {
    title: 'Japanese',
    description: 'Shop premium Japanese whisky & spirits delivered in Nigeria',
    keywords: [
      'buy Japanese whisky Nigeria', 'Japanese spirits Nigeria', 'Suntory Nigeria',
      'Nikka Nigeria', 'Yamazaki Nigeria', 'Hibiki Nigeria',
      'Japanese whisky price Nigeria', 'Japanese whisky delivery Nigeria',
    ],
  },
  usa: {
    title: 'American',
    description: 'Shop bourbon, Tennessee whiskey & American spirits delivered in Nigeria',
    keywords: [
      'buy American whiskey Nigeria', 'bourbon Nigeria', 'Tennessee whiskey Nigeria',
      'Jack Daniels Nigeria', 'Makers Mark Nigeria', 'American spirits Nigeria',
      'US spirits Nigeria', 'bourbon delivery Nigeria',
    ],
  },
  'united states': {
    title: 'American',
    description: 'Shop bourbon, Tennessee whiskey & American spirits delivered in Nigeria',
    keywords: [
      'buy American whiskey Nigeria', 'bourbon Nigeria', 'Tennessee whiskey Nigeria',
      'American spirits Nigeria', 'bourbon delivery Nigeria',
    ],
  },
  france: {
    title: 'French',
    description: 'Shop cognac, champagne, Bordeaux & fine French drinks delivered in Nigeria',
    keywords: [
      'buy French drinks Nigeria', 'French cognac Nigeria', 'French champagne Nigeria',
      'Bordeaux wine Nigeria', 'French wine Nigeria', 'Hennessy Nigeria',
      'Rémy Martin Nigeria', 'Moët Nigeria', 'Veuve Clicquot Nigeria',
      'French spirits delivery Nigeria', 'French wine delivery Nigeria',
    ],
  },
  italy: {
    title: 'Italian',
    description: 'Shop Prosecco, Chianti, Barolo & Italian drinks delivered in Nigeria',
    keywords: [
      'buy Italian wine Nigeria', 'Prosecco Nigeria', 'Chianti Nigeria',
      'Barolo Nigeria', 'Italian spirits Nigeria', 'Italian wine delivery Nigeria',
      'Amaretto Nigeria', 'Grappa Nigeria', 'Limoncello Nigeria',
    ],
  },
  spain: {
    title: 'Spanish',
    description: 'Shop Rioja, Cava, Sherry & Spanish drinks delivered in Nigeria',
    keywords: [
      'buy Spanish wine Nigeria', 'Rioja Nigeria', 'Cava Nigeria',
      'Spanish wine delivery Nigeria', 'Tempranillo Nigeria',
      'Sherry Nigeria', 'Spanish spirits Nigeria',
    ],
  },
  mexico: {
    title: 'Mexican',
    description: 'Shop tequila, mezcal & Mexican spirits delivered in Nigeria',
    keywords: [
      'buy Mexican spirits Nigeria', 'tequila Nigeria', 'mezcal Nigeria',
      'Patron Nigeria', 'Don Julio Nigeria', 'Jose Cuervo Nigeria',
      'Mexican spirits delivery Nigeria', 'tequila delivery Nigeria',
    ],
  },
  caribbean: {
    title: 'Caribbean',
    description: 'Shop authentic Caribbean rums & tropical spirits delivered in Nigeria',
    keywords: [
      'buy Caribbean rum Nigeria', 'Caribbean spirits Nigeria', 'island rum Nigeria',
      'tropical spirits Nigeria', 'Caribbean rum delivery Nigeria',
      'Appleton rum Nigeria', 'Mount Gay Nigeria',
    ],
  },
  jamaica: {
    title: 'Jamaican',
    description: 'Shop Appleton, Wray & Nephew & Jamaican rums delivered in Nigeria',
    keywords: [
      'buy Jamaican rum Nigeria', 'Appleton Estate Nigeria', 'Wray Nephew Nigeria',
      'Jamaican spirits Nigeria', 'rum delivery Nigeria', 'Jamaican rum price Nigeria',
    ],
  },
  cuba: {
    title: 'Cuban',
    description: 'Shop authentic Cuban rum & spirits delivered in Nigeria',
    keywords: [
      'buy Cuban rum Nigeria', 'Havana Club Nigeria', 'Cuban spirits Nigeria',
      'Havana Club delivery Nigeria', 'Cuban rum price Nigeria',
    ],
  },
  barbados: {
    title: 'Barbadian',
    description: 'Shop premium Barbadian rums delivered in Nigeria',
    keywords: [
      'buy Barbados rum Nigeria', 'Mount Gay Nigeria', 'Barbadian spirits Nigeria',
      'Barbados rum delivery Nigeria',
    ],
  },
  australia: {
    title: 'Australian',
    description: 'Shop Shiraz, Chardonnay & Australian wines delivered in Nigeria',
    keywords: [
      'buy Australian wine Nigeria', 'Shiraz Nigeria', 'Australian Chardonnay Nigeria',
      'Barossa Valley wine Nigeria', 'Australian wine delivery Nigeria',
      'Jacob\'s Creek Nigeria', 'Wolf Blass Nigeria',
    ],
  },
  'south africa': {
    title: 'South African',
    description: 'Shop Pinotage, Chenin Blanc & South African wines delivered in Nigeria',
    keywords: [
      'buy South African wine Nigeria', 'Pinotage Nigeria', 'Chenin Blanc Nigeria',
      'Stellenbosch wine Nigeria', 'SA wine delivery Nigeria',
      'KWV Nigeria', 'Cape wine Nigeria',
    ],
  },
  argentina: {
    title: 'Argentinian',
    description: 'Shop Malbec & fine Argentine wines delivered in Nigeria',
    keywords: [
      'buy Argentine wine Nigeria', 'Malbec Nigeria', 'Mendoza wine Nigeria',
      'Argentine wine delivery Nigeria', 'Catena Nigeria', 'Achaval Ferrer Nigeria',
    ],
  },
  chile: {
    title: 'Chilean',
    description: 'Shop Carménère, Malbec & Chilean wines delivered in Nigeria',
    keywords: [
      'buy Chilean wine Nigeria', 'Carménère Nigeria', 'Concha y Toro Nigeria',
      'Chilean wine delivery Nigeria', 'Santa Rita Nigeria', 'Chilean Malbec Nigeria',
    ],
  },
  portugal: {
    title: 'Portuguese',
    description: 'Shop Port, Vinho Verde & Portuguese wines delivered in Nigeria',
    keywords: [
      'buy Portuguese wine Nigeria', 'Port wine Nigeria', 'Vinho Verde Nigeria',
      'Taylor\'s port Nigeria', 'Portuguese wine delivery Nigeria',
    ],
  },
  germany: {
    title: 'German',
    description: 'Shop Riesling, Spätburgunder & German wines delivered in Nigeria',
    keywords: [
      'buy German wine Nigeria', 'Riesling Nigeria', 'German Pinot Noir Nigeria',
      'German wine delivery Nigeria', 'Mosel wine Nigeria',
    ],
  },
  netherlands: {
    title: 'Dutch',
    description: 'Shop Genever & Dutch spirits delivered in Nigeria',
    keywords: [
      'buy Dutch gin Nigeria', 'Genever Nigeria', 'Dutch spirits Nigeria',
      'Bols Nigeria', 'Dutch spirits delivery Nigeria',
    ],
  },
  nigeria: {
    title: 'Nigerian',
    description: 'Shop locally made Nigerian drinks & spirits',
    keywords: [
      'Nigerian drinks online', 'local Nigerian spirits', 'made in Nigeria drinks',
      'Nigerian beer online', 'local alcohol Nigeria', 'buy Nigerian drinks',
    ],
  },
};

const FLAVOR_LABELS: Record<string, LabelEntry> = {
  peaty: {
    title: 'Peaty & Smoky',
    description: 'Shop peaty, smoky Scotch whiskies & spirits — Ardbeg, Laphroaig, Lagavulin & more in Nigeria',
    keywords: [
      'buy peaty whisky Nigeria', 'smoky Scotch Nigeria', 'Islay whisky Nigeria',
      'Ardbeg Nigeria', 'Laphroaig Nigeria', 'Lagavulin Nigeria',
      'Bruichladdich Nigeria', 'peated whisky Nigeria', 'peat smoke whisky Nigeria',
      'smoky spirits Nigeria', 'peaty whisky delivery Nigeria',
    ],
  },
  smoky: {
    title: 'Smoky',
    description: 'Shop smoky spirits & whiskies delivered in Nigeria',
    keywords: [
      'buy smoky whisky Nigeria', 'smoky spirits Nigeria', 'Islay Scotch Nigeria',
      'smoky bourbon Nigeria', 'mezcal Nigeria', 'smoky drinks Nigeria',
      'smoke flavoured spirits Nigeria',
    ],
  },
  fruity: {
    title: 'Fruity',
    description: 'Shop fruity wines, spirits & cocktail-ready drinks in Nigeria',
    keywords: [
      'fruity spirits Nigeria', 'fruit-forward wine Nigeria', 'fruity gin Nigeria',
      'tropical spirits Nigeria', 'fruity rum Nigeria', 'fruity cocktails Nigeria',
      'fruity flavoured drinks Nigeria', 'fruity vodka Nigeria',
    ],
  },
  spicy: {
    title: 'Spicy',
    description: 'Shop bold, spicy spirits & whiskies online in Nigeria',
    keywords: [
      'spicy spirits Nigeria', 'spiced rum Nigeria', 'bold whisky Nigeria',
      'high rye bourbon Nigeria', 'spicy gin Nigeria', 'peppery spirits Nigeria',
    ],
  },
  sweet: {
    title: 'Sweet',
    description: 'Shop sweet wines, liqueurs & dessert drinks in Nigeria',
    keywords: [
      'sweet wine Nigeria', 'sweet liqueur Nigeria', 'dessert wine Nigeria',
      'sweet spirits Nigeria', 'sweet cocktail ingredients Nigeria',
      'sweet rum Nigeria', 'sweet bourbon Nigeria',
    ],
  },
  floral: {
    title: 'Floral',
    description: 'Shop delicate, floral gins, wines & spirits in Nigeria',
    keywords: [
      'floral gin Nigeria', 'floral whisky Nigeria', 'botanical gin Nigeria',
      'delicate spirits Nigeria', 'flower gin Nigeria', 'fragrant spirits Nigeria',
      'floral wine Nigeria',
    ],
  },
  vanilla: {
    title: 'Vanilla & Oak',
    description: 'Shop vanilla-forward, oak-aged spirits & whiskies in Nigeria',
    keywords: [
      'vanilla whisky Nigeria', 'oak aged spirits Nigeria', 'smooth bourbon Nigeria',
      'vanilla rum Nigeria', 'oaky wine Nigeria', 'wood aged whisky Nigeria',
      'vanilla cognac Nigeria',
    ],
  },
  citrus: {
    title: 'Citrus',
    description: 'Shop zesty citrus-flavoured spirits, gins & drinks in Nigeria',
    keywords: [
      'citrus gin Nigeria', 'lemon spirits Nigeria', 'citrus vodka Nigeria',
      'lime spirits Nigeria', 'zesty drinks Nigeria', 'citrus flavoured spirits Nigeria',
      'orange liqueur Nigeria',
    ],
  },
  tropical: {
    title: 'Tropical',
    description: 'Shop tropical-flavoured rums, gins & cocktail drinks in Nigeria',
    keywords: [
      'tropical rum Nigeria', 'tropical gin Nigeria', 'pineapple rum Nigeria',
      'coconut rum Nigeria', 'tropical cocktail spirits Nigeria',
      'tropical vodka Nigeria', 'summer drinks Nigeria',
    ],
  },
  herbal: {
    title: 'Herbal & Botanical',
    description: 'Shop herbaceous gins, bitters & botanical spirits in Nigeria',
    keywords: [
      'herbal gin Nigeria', 'botanical spirits Nigeria', 'herbal bitters Nigeria',
      'amaro Nigeria', 'Aperol Nigeria', 'Campari Nigeria',
      'botanical drinks Nigeria', 'herbal liqueur Nigeria',
    ],
  },
};

// Top-brand keyword overrides for known brands
const BRAND_KEYWORDS: Record<string, string[]> = {
  hennessy: [
    'buy Hennessy Nigeria', 'Hennessy VS Nigeria', 'Hennessy VSOP Nigeria',
    'Hennessy XO Nigeria', 'Hennessy Pure White Nigeria', 'Hennessy price Nigeria',
    'Hennessy delivery Nigeria', 'Hennessy Lagos', 'Hennessy Abuja',
    'cheapest Hennessy Nigeria', 'Hennessy cognac Nigeria',
  ],
  'johnnie-walker': [
    'buy Johnnie Walker Nigeria', 'Johnnie Walker Black Label Nigeria',
    'Johnnie Walker Blue Label Nigeria', 'Johnnie Walker Gold Label Nigeria',
    'Johnnie Walker Green Label Nigeria', 'Johnnie Walker price Nigeria',
    'JW Black Nigeria', 'JW Blue Nigeria', 'Johnnie Walker delivery Nigeria',
  ],
  'johnniewalker': [
    'buy Johnnie Walker Nigeria', 'Johnnie Walker Black Label Nigeria',
    'Johnnie Walker Blue Label Nigeria', 'Johnnie Walker price Nigeria',
  ],
  glenfiddich: [
    'buy Glenfiddich Nigeria', 'Glenfiddich 12 Nigeria', 'Glenfiddich 15 Nigeria',
    'Glenfiddich 18 Nigeria', 'Glenfiddich 21 Nigeria', 'Glenfiddich price Nigeria',
    'Glenfiddich delivery Nigeria', 'Glenfiddich single malt Nigeria',
  ],
  macallan: [
    'buy Macallan Nigeria', 'Macallan 12 Nigeria', 'Macallan 15 Nigeria',
    'Macallan 18 Nigeria', 'Macallan Double Cask Nigeria', 'Macallan price Nigeria',
    'Macallan delivery Nigeria', 'Macallan single malt Nigeria',
  ],
  'remy-martin': [
    'buy Rémy Martin Nigeria', 'Remy Martin VSOP Nigeria', 'Remy Martin XO Nigeria',
    'Remy Martin 1738 Nigeria', 'Remy Martin price Nigeria', 'Remy Martin delivery Nigeria',
  ],
  'remy martin': [
    'buy Rémy Martin Nigeria', 'Remy Martin VSOP Nigeria', 'Remy Martin XO Nigeria',
    'Remy Martin price Nigeria', 'Remy Martin delivery Nigeria',
  ],
  martell: [
    'buy Martell Nigeria', 'Martell VSOP Nigeria', 'Martell XO Nigeria',
    'Martell Blue Swift Nigeria', 'Martell Cordon Bleu Nigeria',
    'Martell price Nigeria', 'Martell delivery Nigeria',
  ],
  ciroc: [
    'buy Ciroc Nigeria', 'Ciroc price Nigeria', 'Ciroc delivery Nigeria',
    'Ciroc flavours Nigeria', 'Ciroc Red Berry Nigeria', 'Ciroc Peach Nigeria',
    'Ciroc Apple Nigeria', 'Ciroc vodka Nigeria', 'Ciroc Lagos', 'Ciroc Abuja',
  ],
  jameson: [
    'buy Jameson Nigeria', 'Jameson Irish whiskey Nigeria', 'Jameson price Nigeria',
    'Jameson Black Barrel Nigeria', 'Jameson Caskmates Nigeria',
    'Jameson delivery Nigeria', 'Jameson whiskey Lagos', 'Jameson Abuja',
  ],
  'jack-daniels': [
    'buy Jack Daniels Nigeria', 'Jack Daniel\'s Old No 7 Nigeria',
    'Jack Daniels Honey Nigeria', 'Jack Daniels Fire Nigeria',
    'Jack Daniels price Nigeria', 'Jack Daniels delivery Nigeria',
  ],
  'moet': [
    'buy Moët Nigeria', 'Moet Chandon Nigeria', 'Moet Brut Nigeria',
    'Moet Ice Imperial Nigeria', 'Moet price Nigeria', 'Moet delivery Nigeria',
    'champagne Nigeria delivery',
  ],
  'moet-chandon': [
    'buy Moët Chandon Nigeria', 'Moet Chandon Brut Nigeria',
    'Moet Imperial Nigeria', 'Moet price Nigeria', 'Moet delivery Nigeria',
  ],
  patron: [
    'buy Patron tequila Nigeria', 'Patron Silver Nigeria', 'Patron Reposado Nigeria',
    'Patron Anejo Nigeria', 'Patron XO Nigeria', 'Patron price Nigeria',
    'Patron delivery Nigeria', 'Patron tequila Lagos',
  ],
  'grey-goose': [
    'buy Grey Goose Nigeria', 'Grey Goose vodka Nigeria', 'Grey Goose price Nigeria',
    'Grey Goose delivery Nigeria', 'premium vodka Nigeria', 'Grey Goose Lagos',
  ],
  baileys: [
    'buy Baileys Nigeria', 'Baileys Irish Cream Nigeria', 'Baileys price Nigeria',
    'Baileys delivery Nigeria', 'Baileys flavours Nigeria', 'Baileys gift Nigeria',
  ],
  'captain-morgan': [
    'buy Captain Morgan Nigeria', 'Captain Morgan Spiced Nigeria',
    'Captain Morgan Black Nigeria', 'Captain Morgan price Nigeria', 'Captain Morgan delivery Nigeria',
  ],
  chivas: [
    'buy Chivas Regal Nigeria', 'Chivas 12 Nigeria', 'Chivas 18 Nigeria',
    'Chivas Extra Nigeria', 'Chivas price Nigeria', 'Chivas delivery Nigeria',
  ],
  'chivas-regal': [
    'buy Chivas Regal Nigeria', 'Chivas 12 Nigeria', 'Chivas 18 Nigeria',
    'Chivas price Nigeria', 'Chivas Regal delivery Nigeria',
  ],
  'don-julio': [
    'buy Don Julio Nigeria', 'Don Julio Blanco Nigeria', 'Don Julio Reposado Nigeria',
    'Don Julio 1942 Nigeria', 'Don Julio price Nigeria', 'Don Julio delivery Nigeria',
  ],
  'veuve-clicquot': [
    'buy Veuve Clicquot Nigeria', 'Veuve Clicquot Yellow Label Nigeria',
    'Veuve Clicquot price Nigeria', 'Veuve Clicquot delivery Nigeria',
    'champagne Nigeria', 'Veuve Clicquot Lagos',
  ],
  bacardi: [
    'buy Bacardi Nigeria', 'Bacardi White rum Nigeria', 'Bacardi price Nigeria',
    'Bacardi delivery Nigeria', 'Bacardi Coconut Nigeria', 'Bacardi Lagos',
  ],
  absolut: [
    'buy Absolut vodka Nigeria', 'Absolut price Nigeria', 'Absolut delivery Nigeria',
    'Absolut Citron Nigeria', 'Absolut Raspberri Nigeria', 'Absolut Lagos',
  ],
  hendricks: [
    'buy Hendricks gin Nigeria', 'Hendricks price Nigeria', 'Hendricks delivery Nigeria',
    'craft gin Nigeria', 'Hendricks Orbium Nigeria', 'Hendricks Midsummer Nigeria',
  ],
  tanqueray: [
    'buy Tanqueray gin Nigeria', 'Tanqueray No Ten Nigeria', 'Tanqueray Rangpur Nigeria',
    'Tanqueray price Nigeria', 'Tanqueray delivery Nigeria', 'London dry gin Nigeria',
  ],
  '19-crimes': [
    'buy 19 Crimes wine Nigeria', '19 Crimes Chardonnay Nigeria',
    '19 Crimes Cabernet Sauvignon Nigeria', '19 Crimes Shiraz Nigeria',
    '19 Crimes red wine Nigeria', '19 Crimes white wine Nigeria',
    '19 Crimes price Nigeria', '19 Crimes delivery Nigeria',
    'Australian wine Nigeria', '19 Crimes Lagos', '19 Crimes Abuja',
  ],
  '19 crimes': [
    'buy 19 Crimes wine Nigeria', '19 Crimes Chardonnay Nigeria',
    '19 Crimes Cabernet Sauvignon Nigeria', '19 Crimes Shiraz Nigeria',
    '19 Crimes price Nigeria', '19 Crimes delivery Nigeria',
    'Australian wine Nigeria',
  ],
};

function toTitleCase(s: string) {
  return s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function isNoIndexFilter(params: Record<string, string>): boolean {
  const noIndexKeys    = ['minPrice', 'maxPrice', 'minABV', 'maxABV', 'minRating', 'sort', 'volume', 'size', 'saleType'];
  const meaningfulKeys = ['category', 'subcategory', 'brand', 'origin', 'flavor', 'sale', 'search'];
  return noIndexKeys.some(k => params[k]) && !meaningfulKeys.some(k => params[k]);
}

function brandKeywords(brand: string, catLabel?: string): string[] {
  const lower  = brand.toLowerCase();
  const slug   = lower.replace(/\s+/g, '-');
  const known  = BRAND_KEYWORDS[slug] ?? BRAND_KEYWORDS[lower] ?? [];
  const label  = toTitleCase(brand);
  const dynamic = [
    `buy ${label} Nigeria`,
    `${label} price Nigeria`,
    `${label} online Nigeria`,
    `${label} delivery Nigeria`,
    ...(catLabel ? [`buy ${label} ${catLabel.toLowerCase()} Nigeria`, `${label} ${catLabel.toLowerCase()} price Nigeria`] : []),
  ];
  // Merge: known first (more specific), then any dynamic ones not already covered
  const set = new Set([...known, ...dynamic]);
  return [...set];
}

// ─── Hero seed (server-computed <h1>) ─────────────────────────────────────────

// The shop hero is a client component, so on the first (crawlable) render it has
// no DB categories loaded and falls back to a generic "All Drinks" heading for
// every filter it doesn't statically curate — origin, flavor, and any DB-only
// category/subcategory. That leaves the <h1> mismatched with the keyword-rich
// <title>. We compute a keyword-matching seed here from the SAME label maps the
// meta title uses, and pass it to the hero as the terminal fallback so the
// initial HTML <h1> stays in lockstep with the page title.
export interface HeroSeed { label: string; description?: string }

function deriveHeroSeed(params: Record<string, string>): HeroSeed | null {
  const category    = params.category    || '';
  const subcategory = params.subcategory || '';
  const brand       = params.brand       || '';
  const origin      = params.origin      || '';
  const flavor      = params.flavor      || '';
  const sale        = params.sale        === 'true';
  const search      = params.search      || '';

  // Search results and no-index filter pages render their own header, not the hero.
  if (search || isNoIndexFilter(params)) return null;

  const single = (v: string) => Boolean(v) && !v.includes(',');

  if (sale) {
    return { label: 'Deals & Discounts', description: 'Limited-time discounts on premium wines, spirits, beers and more — delivered across Nigeria.' };
  }

  // Brand hero — client swaps in DB brand copy after hydration; the seed keeps the
  // <h1> correct in the initial HTML.
  if (single(brand)) {
    return { label: toTitleCase(brand) };
  }

  if (single(subcategory)) {
    const info = SUBCATEGORY_LABELS[subcategory.toLowerCase()];
    return { label: info?.title ?? toTitleCase(subcategory), description: info?.description };
  }

  if (origin) {
    const catInfo    = CATEGORY_LABELS[category.toLowerCase()];
    const catLabel   = catInfo?.title ?? (single(category) ? toTitleCase(category) : '');
    const originInfo = ORIGIN_LABELS[origin.toLowerCase()];
    const originAdj  = originInfo?.title ?? toTitleCase(origin);
    return { label: catLabel ? `${originAdj} ${catLabel}` : `${originAdj} Drinks`, description: originInfo?.description };
  }

  if (flavor) {
    const catInfo     = CATEGORY_LABELS[category.toLowerCase()];
    const catLabel    = catInfo?.title ?? (single(category) ? toTitleCase(category) : '');
    const flavorInfo  = FLAVOR_LABELS[flavor.toLowerCase()];
    const flavorLabel = flavorInfo?.title ?? toTitleCase(flavor);
    return { label: catLabel ? `${flavorLabel} ${catLabel}` : `${flavorLabel} Drinks`, description: flavorInfo?.description };
  }

  if (single(category)) {
    const info = CATEGORY_LABELS[category.toLowerCase()];
    return { label: info?.title ?? toTitleCase(category), description: info?.description };
  }

  // Default shop — keyword-matching heading aligned with the default <title>.
  return {
    label: 'Premium Drinks in Nigeria',
    description: "Browse Nigeria's widest selection of wines, spirits, whiskies, beers & non-alcoholic drinks — fast delivery nationwide.",
  };
}

// ─── Dynamic metadata ─────────────────────────────────────────────────────────

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}): Promise<Metadata> {
  const params      = await searchParams;
  const category    = params.category    || '';
  const subcategory = params.subcategory || '';
  const brand       = params.brand       || '';
  const origin      = params.origin      || '';
  const flavor      = params.flavor      || '';
  const sale        = params.sale        === 'true';
  const search      = params.search      || '';

  const canonicalUrl = `${BASE_URL}/shop`;

  if (isNoIndexFilter(params)) {
    return { robots: { index: false, follow: true } };
  }

  // ── Sale ──────────────────────────────────────────────────────────────────
  if (sale) {
    const title       = 'Deals & Discounts on Premium Drinks';
    const description = 'Shop the best deals on wines, spirits, beers and more. Limited-time discounts on premium beverages delivered across Nigeria.';
    return {
      title: { absolute: `${title} | ${SITE_NAME}` },
      description,
      keywords: [
        'drinks deals Nigeria', 'wine deals Nigeria', 'whisky discount Nigeria',
        'alcohol sale Nigeria', 'cognac discount Nigeria', 'champagne sale Nigeria',
        'vodka deals Nigeria', 'rum deals Nigeria', 'spirit discounts Nigeria',
        'cheap alcohol Nigeria', 'discounted drinks Nigeria', 'best deals drinks Nigeria',
        'DrinksHarbour sale', 'online drinks sale Nigeria',
      ],
      alternates: { canonical: `${BASE_URL}/shop?sale=true` },
      openGraph: { type: 'website', url: `${BASE_URL}/shop?sale=true`, siteName: SITE_NAME, title: `${title} | ${SITE_NAME}`, description, images: [{ url: '/images/logo.png', width: 1200, height: 630 }] },
      twitter:   { card: 'summary_large_image', title: `${title} | ${SITE_NAME}`, description, images: ['/images/logo.png'] },
    };
  }

  // ── Search ────────────────────────────────────────────────────────────────
  if (search) {
    return {
      title: { absolute: `Search: "${search}" | ${SITE_NAME}` },
      description: `Browse search results for "${search}" on DrinksHarbour — Nigeria's premier online drinks store.`,
      robots: { index: false, follow: true },
    };
  }

  // ── Brand + Subcategory (no category param) ──────────────────────────────
  if (brand && subcategory && !category) {
    const brandLabel = toTitleCase(brand);
    const subInfo    = SUBCATEGORY_LABELS[subcategory.toLowerCase()];
    const subLabel   = subInfo?.title ?? toTitleCase(subcategory);
    const title      = `Buy ${brandLabel} ${subLabel} Online`;
    const description = `Shop authentic ${brandLabel} ${subLabel.toLowerCase()} in Nigeria. Competitive prices, fast delivery from Abuja to all 36 states on DrinksHarbour.`;
    const url        = `${BASE_URL}/shop?brand=${encodeURIComponent(brand)}&subcategory=${encodeURIComponent(subcategory)}`;
    const subKw      = subInfo?.keywords?.slice(0, 6) ?? [`buy ${subLabel.toLowerCase()} Nigeria`];
    return {
      title: { absolute: `${title} | ${SITE_NAME}` },
      description,
      keywords: [...new Set([...brandKeywords(brand, subLabel), ...subKw])],
      alternates: { canonical: url },
      openGraph: { type: 'website', url, siteName: SITE_NAME, title: `${title} | ${SITE_NAME}`, description, images: [{ url: '/images/logo.png', width: 1200, height: 630 }] },
      twitter:   { card: 'summary_large_image', title: `${title} | ${SITE_NAME}`, description, images: ['/images/logo.png'] },
    };
  }

  // ── Subcategory only (no category, no brand) ──────────────────────────────
  if (subcategory && !category && !brand) {
    const subInfo  = SUBCATEGORY_LABELS[subcategory.toLowerCase()];
    const subLabel = subInfo?.title ?? toTitleCase(subcategory);
    const title    = `Buy ${subLabel} Online Nigeria`;
    const description = subInfo?.description
      ? `${subInfo.description}. Fast delivery across all 36 states.`
      : `Shop premium ${subLabel.toLowerCase()} online in Nigeria. Authentic products with fast delivery from Abuja.`;
    const url = `${BASE_URL}/shop?subcategory=${encodeURIComponent(subcategory)}`;
    return {
      title: { absolute: `${title} | ${SITE_NAME}` },
      description,
      keywords: [...(subInfo?.keywords ?? [`buy ${subLabel.toLowerCase()} Nigeria`, `${subLabel.toLowerCase()} online Nigeria`, `${subLabel.toLowerCase()} delivery Nigeria`]), SITE_NAME],
      alternates: { canonical: url },
      openGraph: { type: 'website', url, siteName: SITE_NAME, title: `${title} | ${SITE_NAME}`, description, images: [{ url: '/images/logo.png', width: 1200, height: 630, alt: `${subLabel} — ${SITE_NAME}` }] },
      twitter:   { card: 'summary_large_image', title: `${title} | ${SITE_NAME}`, description, images: ['/images/logo.png'] },
    };
  }

  // ── Brand + Category combo ────────────────────────────────────────────────
  if (brand && category) {
    const brandLabel = toTitleCase(brand);
    const catInfo    = CATEGORY_LABELS[category.toLowerCase()];
    const catLabel   = catInfo?.title ?? toTitleCase(category);
    const title      = `Buy ${brandLabel} ${catLabel} Online`;
    const description = `Shop authentic ${brandLabel} ${catLabel.toLowerCase()} in Nigeria. Fast delivery from Abuja to all 36 states on DrinksHarbour.`;
    const url = `${BASE_URL}/shop?brand=${encodeURIComponent(brand)}&category=${encodeURIComponent(category)}`;
    return {
      title: { absolute: `${title} | ${SITE_NAME}` },
      description,
      keywords: brandKeywords(brand, catLabel),
      alternates: { canonical: url },
      openGraph: { type: 'website', url, siteName: SITE_NAME, title: `${title} | ${SITE_NAME}`, description, images: [{ url: '/images/logo.png', width: 1200, height: 630 }] },
      twitter:   { card: 'summary_large_image', title: `${title} | ${SITE_NAME}`, description, images: ['/images/logo.png'] },
    };
  }

  // ── Brand only ────────────────────────────────────────────────────────────
  if (brand) {
    const brandLabel  = toTitleCase(brand);
    const title       = `Buy ${brandLabel} Online in Nigeria`;
    const description = `Shop authentic ${brandLabel} products in Nigeria. Competitive prices, fast delivery from Abuja to all 36 states on DrinksHarbour.`;
    const brandUrl    = `${BASE_URL}/shop?brand=${encodeURIComponent(brand)}`;
    return {
      title: { absolute: `${title} | ${SITE_NAME}` },
      description,
      keywords: brandKeywords(brand),
      alternates: { canonical: brandUrl },
      openGraph: { type: 'website', url: brandUrl, siteName: SITE_NAME, title: `${title} | ${SITE_NAME}`, description, images: [{ url: '/images/logo.png', width: 1200, height: 630 }] },
      twitter:   { card: 'summary_large_image', title: `${title} | ${SITE_NAME}`, description, images: ['/images/logo.png'] },
    };
  }

  // ── Origin ────────────────────────────────────────────────────────────────
  if (origin) {
    const catInfo    = CATEGORY_LABELS[category.toLowerCase()];
    const catLabel   = catInfo?.title ?? (category ? toTitleCase(category) : '');
    const originInfo = ORIGIN_LABELS[origin.toLowerCase()];
    const originAdj  = originInfo?.title ?? toTitleCase(origin);
    const pageTitle  = catLabel ? `Buy ${originAdj} ${catLabel} Online` : `Buy ${originAdj} Drinks Online`;
    const description = originInfo?.description
      ? `${originInfo.description}. Fast delivery from Abuja to all 36 states.`
      : `Shop premium ${toTitleCase(origin)} drinks in Nigeria with fast nationwide delivery.`;
    const originUrl  = `${BASE_URL}/shop?origin=${encodeURIComponent(origin)}${category ? `&category=${encodeURIComponent(category)}` : ''}`;
    const baseKw     = originInfo?.keywords ?? [`buy ${originAdj.toLowerCase()} drinks Nigeria`, `${originAdj.toLowerCase()} spirits Nigeria`];
    return {
      title: { absolute: `${pageTitle} | ${SITE_NAME}` },
      description,
      keywords: [
        ...baseKw,
        ...(catLabel ? [`buy ${originAdj.toLowerCase()} ${catLabel.toLowerCase()} Nigeria`, `${originAdj.toLowerCase()} ${catLabel.toLowerCase()} delivery Nigeria`] : []),
        SITE_NAME,
      ],
      alternates: { canonical: originUrl },
      openGraph: { type: 'website', url: originUrl, siteName: SITE_NAME, title: `${pageTitle} | ${SITE_NAME}`, description, images: [{ url: '/images/logo.png', width: 1200, height: 630, alt: `${originAdj} Drinks — ${SITE_NAME}` }] },
      twitter:   { card: 'summary_large_image', title: `${pageTitle} | ${SITE_NAME}`, description, images: ['/images/logo.png'] },
    };
  }

  // ── Flavor ────────────────────────────────────────────────────────────────
  if (flavor) {
    const catInfo    = CATEGORY_LABELS[category.toLowerCase()];
    const catLabel   = catInfo?.title ?? (category ? toTitleCase(category) : '');
    const flavorInfo = FLAVOR_LABELS[flavor.toLowerCase()];
    const flavorLabel = flavorInfo?.title ?? toTitleCase(flavor);
    const pageTitle   = catLabel ? `${flavorLabel} ${catLabel}` : `${flavorLabel} Drinks`;
    const description = flavorInfo?.description
      ? `${flavorInfo.description}. Fast delivery from Abuja nationwide.`
      : `Shop ${toTitleCase(flavor)}-flavoured drinks in Nigeria with fast delivery.`;
    const flavorUrl  = `${BASE_URL}/shop?flavor=${encodeURIComponent(flavor)}${category ? `&category=${encodeURIComponent(category)}` : ''}`;
    const baseKw     = flavorInfo?.keywords ?? [`${flavorLabel.toLowerCase()} drinks Nigeria`, `shop ${flavorLabel.toLowerCase()} spirits Nigeria`];
    return {
      title: { absolute: `${pageTitle} | ${SITE_NAME}` },
      description,
      keywords: [
        ...baseKw,
        ...(catLabel ? [`${flavorLabel.toLowerCase()} ${catLabel.toLowerCase()} Nigeria`, `${flavorLabel.toLowerCase()} ${catLabel.toLowerCase()} delivery Nigeria`] : []),
        SITE_NAME,
      ],
      alternates: { canonical: flavorUrl },
      openGraph: { type: 'website', url: flavorUrl, siteName: SITE_NAME, title: `${pageTitle} | ${SITE_NAME}`, description, images: [{ url: '/images/logo.png', width: 1200, height: 630 }] },
      twitter:   { card: 'summary_large_image', title: `${pageTitle} | ${SITE_NAME}`, description, images: ['/images/logo.png'] },
    };
  }

  // ── Category + subcategory ────────────────────────────────────────────────
  if (category) {
    const catInfo  = CATEGORY_LABELS[category.toLowerCase()];
    const catLabel = catInfo?.title ?? toTitleCase(category);
    const subInfo  = SUBCATEGORY_LABELS[subcategory.toLowerCase()];
    const subLabel = subInfo?.title ?? (subcategory ? toTitleCase(subcategory) : '');

    const pageTitle   = subLabel ? `Buy ${subLabel} Online Nigeria` : `Buy ${catLabel} Online Nigeria`;
    const description = subInfo?.description
      ? `${subInfo.description}. Fast delivery across all 36 states.`
      : catInfo?.description
        ? `${catInfo.description}. Fast delivery across all 36 states.`
        : `Shop premium ${catLabel.toLowerCase()} online in Nigeria. Authentic products with fast delivery from Abuja.`;
    // Consolidate duplicate category slugs onto the real catalog slug so the two
    // near-identical pages don't cannibalize each other (e.g. scotch-whisky is a
    // phantom slug with no products — canonicalize it to `scotch`).
    const canonicalCategory = CATEGORY_CANONICAL_ALIASES[category.toLowerCase()] ?? category;
    const catUrl    = `${BASE_URL}/shop?category=${encodeURIComponent(canonicalCategory)}${subcategory ? `&subcategory=${encodeURIComponent(subcategory)}` : ''}`;
    const baseKw    = subInfo?.keywords ?? catInfo?.keywords ?? [];

    return {
      title: { absolute: `${pageTitle} | ${SITE_NAME}` },
      description,
      keywords: [
        ...baseKw,
        ...(subLabel && catInfo?.keywords ? catInfo.keywords.slice(0, 4) : []),
        SITE_NAME,
      ],
      alternates: { canonical: catUrl },
      openGraph: { type: 'website', url: catUrl, siteName: SITE_NAME, title: `${pageTitle} | ${SITE_NAME}`, description, images: [{ url: '/images/logo.png', width: 1200, height: 630, alt: `${subLabel || catLabel} — ${SITE_NAME}` }] },
      twitter:   { card: 'summary_large_image', title: `${pageTitle} | ${SITE_NAME}`, description, images: ['/images/logo.png'] },
    };
  }

  // ── Default shop ──────────────────────────────────────────────────────────
  const title       = 'Shop Premium Drinks Online in Nigeria';
  const description = "Browse Nigeria's widest selection of wines, spirits, whiskies, beers & non-alcoholic drinks. Filter by brand, type, price and more. Fast delivery nationwide.";

  return {
    title: { absolute: `${title} | ${SITE_NAME}` },
    description,
    keywords: [
      'buy wine Nigeria', 'buy whisky Nigeria', 'buy cognac Nigeria',
      'buy spirits Nigeria', 'buy beer Nigeria', 'buy vodka Nigeria',
      'buy gin Nigeria', 'buy rum Nigeria', 'buy tequila Nigeria',
      'buy champagne Nigeria', 'online liquor store Nigeria',
      'alcohol delivery Nigeria', 'drinks delivery Nigeria',
      'buy drinks online Abuja', 'buy drinks online Lagos',
      'buy drinks online Port Harcourt', 'premium beverages Nigeria',
      'alcohol online Nigeria', 'order drinks Nigeria', SITE_NAME,
    ],
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'website', url: canonicalUrl, siteName: SITE_NAME,
      title: `${title} | ${SITE_NAME}`, description,
      images: [{ url: '/images/logo.png', width: 1200, height: 630, alt: `${SITE_NAME} Shop` }],
    },
    twitter: { card: 'summary_large_image', title: `${title} | ${SITE_NAME}`, description, images: ['/images/logo.png'] },
  };
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────

async function buildJsonLd(params: Record<string, string>) {
  const category    = params.category    || '';
  const subcategory = params.subcategory || '';
  const brand       = params.brand       || '';
  const origin      = params.origin      || '';
  const flavor      = params.flavor      || '';
  const sale        = params.sale        === 'true';

  const breadcrumbs: { '@type': string; position: number; name: string; item: string }[] = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
    { '@type': 'ListItem', position: 2, name: 'Shop', item: `${BASE_URL}/shop` },
  ];

  let collectionName = 'Shop Premium Beverages — DrinksHarbour';
  let collectionUrl  = `${BASE_URL}/shop`;

  if (sale) {
    collectionName = 'Deals & Discounts — DrinksHarbour';
    collectionUrl  = `${BASE_URL}/shop?sale=true`;
    breadcrumbs.push({ '@type': 'ListItem', position: 3, name: 'Deals & Discounts', item: collectionUrl });
  } else if (brand && subcategory && !category) {
    const brandLabel = toTitleCase(brand);
    const subLabel   = SUBCATEGORY_LABELS[subcategory.toLowerCase()]?.title ?? toTitleCase(subcategory);
    collectionUrl  = `${BASE_URL}/shop?brand=${encodeURIComponent(brand)}&subcategory=${encodeURIComponent(subcategory)}`;
    collectionName = `${brandLabel} ${subLabel} — DrinksHarbour`;
    breadcrumbs.push({ '@type': 'ListItem', position: 3, name: brandLabel,                  item: `${BASE_URL}/shop?brand=${encodeURIComponent(brand)}` });
    breadcrumbs.push({ '@type': 'ListItem', position: 4, name: `${brandLabel} ${subLabel}`, item: collectionUrl });
  } else if (subcategory && !category && !brand) {
    const subLabel = SUBCATEGORY_LABELS[subcategory.toLowerCase()]?.title ?? toTitleCase(subcategory);
    collectionUrl  = `${BASE_URL}/shop?subcategory=${encodeURIComponent(subcategory)}`;
    collectionName = `Buy ${subLabel} Online — DrinksHarbour`;
    breadcrumbs.push({ '@type': 'ListItem', position: 3, name: subLabel, item: collectionUrl });
  } else if (brand && category) {
    const catLabel   = CATEGORY_LABELS[category.toLowerCase()]?.title ?? toTitleCase(category);
    const brandLabel = toTitleCase(brand);
    collectionUrl  = `${BASE_URL}/shop?brand=${encodeURIComponent(brand)}&category=${encodeURIComponent(category)}`;
    collectionName = `${brandLabel} ${catLabel} — DrinksHarbour`;
    breadcrumbs.push({ '@type': 'ListItem', position: 3, name: brandLabel,                  item: `${BASE_URL}/shop?brand=${encodeURIComponent(brand)}` });
    breadcrumbs.push({ '@type': 'ListItem', position: 4, name: `${brandLabel} ${catLabel}`, item: collectionUrl });
  } else if (brand) {
    const brandLabel = toTitleCase(brand);
    collectionUrl  = `${BASE_URL}/shop?brand=${encodeURIComponent(brand)}`;
    collectionName = `${brandLabel} — DrinksHarbour`;
    breadcrumbs.push({ '@type': 'ListItem', position: 3, name: brandLabel, item: collectionUrl });
  } else if (origin) {
    const originLabel = ORIGIN_LABELS[origin.toLowerCase()]?.title ?? toTitleCase(origin);
    const catLabel    = category ? (CATEGORY_LABELS[category.toLowerCase()]?.title ?? toTitleCase(category)) : '';
    collectionUrl   = `${BASE_URL}/shop?origin=${encodeURIComponent(origin)}${category ? `&category=${encodeURIComponent(category)}` : ''}`;
    collectionName  = catLabel ? `${originLabel} ${catLabel} — DrinksHarbour` : `${originLabel} Drinks — DrinksHarbour`;
    breadcrumbs.push({ '@type': 'ListItem', position: 3, name: `${originLabel} Drinks`, item: collectionUrl });
  } else if (flavor) {
    const flavorLabel = FLAVOR_LABELS[flavor.toLowerCase()]?.title ?? toTitleCase(flavor);
    collectionUrl   = `${BASE_URL}/shop?flavor=${encodeURIComponent(flavor)}`;
    collectionName  = `${flavorLabel} Drinks — DrinksHarbour`;
    breadcrumbs.push({ '@type': 'ListItem', position: 3, name: flavorLabel, item: collectionUrl });
  } else if (category) {
    const catLabel = CATEGORY_LABELS[category.toLowerCase()]?.title ?? toTitleCase(category);
    collectionUrl  = `${BASE_URL}/shop?category=${encodeURIComponent(category)}`;
    collectionName = `Buy ${catLabel} Online — DrinksHarbour`;
    breadcrumbs.push({ '@type': 'ListItem', position: 3, name: catLabel, item: collectionUrl });
    if (subcategory) {
      const subLabel = SUBCATEGORY_LABELS[subcategory.toLowerCase()]?.title ?? toTitleCase(subcategory);
      collectionUrl  = `${BASE_URL}/shop?category=${encodeURIComponent(category)}&subcategory=${encodeURIComponent(subcategory)}`;
      collectionName = `Buy ${subLabel} Online — DrinksHarbour`;
      breadcrumbs.push({ '@type': 'ListItem', position: 4, name: subLabel, item: collectionUrl });
    }
  }

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: collectionName,
      description: "Nigeria's widest selection of premium wines, spirits, beers and non-alcoholic drinks.",
      url: collectionUrl,
      provider: { '@type': 'Organization', name: SITE_NAME, url: BASE_URL },
      inLanguage: 'en-NG',
    },
  ];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params  = await searchParams;
  const heroSeed = deriveHeroSeed(params);
  const [schemas, initial, initialRecommended] = await Promise.all([
    buildJsonLd(params),
    fetchInitialProducts(params),
    fetchInitialRecommendations(12),
  ]);

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <ShopClient
        initialProducts={initial.products}
        initialTotal={initial.total}
        initialRecommended={initialRecommended}
        heroSeed={heroSeed}
      />
    </>
  );
}
