const PINTEREST_API_BASE = 'https://api.pinterest.com/v5';

const getAccessToken = () => process.env.PINTEREST_ACCESS_TOKEN;

const searchImages = async (query, limit = 30) => {
  const token = getAccessToken();

  if (!token) {
    throw new Error('PINTEREST_ACCESS_TOKEN not configured');
  }

  const response = await fetch(
    `${PINTEREST_API_BASE}/pins/search?query=${encodeURIComponent(query)}&page_size=${Math.min(limit, 50)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 401) {
      throw new Error('Pinterest access token expired or invalid. Generate a new one at developers.pinterest.com.');
    }
    throw new Error(`Pinterest API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  return (data.items || [])
    .map((pin) => {
      const images = pin.media?.images || {};
      const imageUrl =
        images['1200x']?.url ||
        images.original?.url ||
        images['736x']?.url ||
        images['474x']?.url ||
        null;
      const thumbUrl =
        images['236x']?.url ||
        images['474x']?.url ||
        imageUrl;

      return {
        id: pin.id,
        title: pin.title || '',
        description: pin.description || '',
        imageUrl,
        thumbUrl,
        link: `https://www.pinterest.com/pin/${pin.id}/`,
        credit: '',
        creditUrl: '',
      };
    })
    .filter((img) => img.imageUrl);
};

const checkStatus = () => {
  const hasToken = !!getAccessToken();
  return {
    configured: hasToken,
    message: hasToken
      ? 'Pinterest is connected'
      : 'Add PINTEREST_ACCESS_TOKEN to .env — get it free at developers.pinterest.com (create app → Generate access token)',
  };
};

module.exports = { searchImages, checkStatus };
