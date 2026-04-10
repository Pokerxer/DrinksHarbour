const SCRAPE_CREATORS_API_URL = 'https://api.scrapecreators.com/v1/pinterest/search';
const RAPIDAPI_PINTEREST_SEARCH_URL = 'https://pinterest-pin-search.p.rapidapi.com/search';

const fetchFromScrapeCreators = async (query, limit = 20) => {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;
  if (!apiKey) {
    throw new Error('SCRAPECREATORS_API_KEY not configured');
  }

  const response = await fetch(`${SCRAPE_CREATORS_API_URL}?query=${encodeURIComponent(query)}&limit=${limit}`, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ScrapeCreators API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.pins || [];
};

const fetchFromRapidAPI = async (query, limit = 20) => {
  const apiKey = process.env.RAPIDAPI_PINTEREST_KEY;
  const apiHost = process.env.RAPIDAPI_PINTEREST_HOST || 'pinterest-pin-search.p.rapidapi.com';

  if (!apiKey) {
    throw new Error('RAPIDAPI_PINTEREST_KEY not configured');
  }

  const response = await fetch(`${RAPIDAPI_PINTEREST_SEARCH_URL}?query=${encodeURIComponent(query)}&limit=${limit}`, {
    method: 'GET',
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': apiHost,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`RapidAPI Pinterest error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.results || [];
};

const searchPinterestImages = async (query, limit = 20) => {
  if (!query || query.trim().length === 0) {
    throw new Error('Search query is required');
  }

  const normalizedQuery = query.trim();

  try {
    return await fetchFromScrapeCreators(normalizedQuery, limit);
  } catch (scrapeError) {
    console.warn('ScrapeCreators failed, trying RapidAPI:', scrapeError.message);
    try {
      return await fetchFromRapidAPI(normalizedQuery, limit);
    } catch (rapidError) {
      console.error('Both Pinterest APIs failed:', rapidError.message);
      throw new Error('Pinterest search service unavailable. Please try again later.');
    }
  }
};

const downloadImageToBase64 = async (imageUrl) => {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString('base64');
  } catch (error) {
    console.error('Error downloading image:', error.message);
    throw new Error(`Failed to download image: ${error.message}`);
  }
};

module.exports = {
  searchPinterestImages,
  downloadImageToBase64,
};