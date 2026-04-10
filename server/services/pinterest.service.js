const PINTEREST_API_BASE = 'https://api.pinterest.com/v5';

const getAccessToken = () => {
  return process.env.PINTEREST_ACCESS_TOKEN;
};

const getAppId = () => {
  return process.env.PINTEREST_APP_ID;
};

const getAppSecret = () => {
  return process.env.PINTEREST_APP_SECRET;
};

const getRedirectUri = () => {
  return process.env.PINTEREST_REDIRECT_URI || `${process.env.BACKEND_URL}/api/pinterest/callback`;
};

const searchPinterestPins = async (query, limit = 20) => {
  const accessToken = getAccessToken();
  
  if (!accessToken) {
    throw new Error('PINTEREST_ACCESS_TOKEN not configured. Please authenticate with Pinterest first.');
  }

  const response = await fetch(
    `${PINTEREST_API_BASE}/pins/search?query=${encodeURIComponent(query)}&page_size=${limit}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 401) {
      throw new Error('Pinterest access token expired. Please re-authenticate.');
    }
    throw new Error(`Pinterest API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.items || [];
};

const getUserPins = async (limit = 50) => {
  const accessToken = getAccessToken();
  
  if (!accessToken) {
    throw new Error('PINTEREST_ACCESS_TOKEN not configured');
  }

  const response = await fetch(
    `${PINTEREST_API_BASE}/pins?page_size=${limit}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Pinterest API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.items || [];
};

const getUserBoards = async () => {
  const accessToken = getAccessToken();
  
  if (!accessToken) {
    throw new Error('PINTEREST_ACCESS_TOKEN not configured');
  }

  const response = await fetch(
    `${PINTEREST_API_BASE}/boards`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Pinterest API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.items || [];
};

const searchPinterestImages = async (query, limit = 20) => {
  if (!query || query.trim().length === 0) {
    throw new Error('Search query is required');
  }

  const normalizedQuery = query.trim();
  const pins = await searchPinterestPins(normalizedQuery, limit);

  return pins.map((pin) => ({
    id: pin.id,
    title: pin.title || '',
    description: pin.description || '',
    imageUrl: pin.media?.images?.original?.url || pin.media?.images?.['236x']?.url || '',
    link: pin.link || '',
    pinUrl: `https://www.pinterest.com/pin/${pin.id}/`,
    boardId: pin.board_id || null,
  }));
};

const getOauthUrl = () => {
  const appId = getAppId();
  const redirectUri = getRedirectUri();
  
  if (!appId) {
    throw new Error('PINTEREST_APP_ID not configured');
  }

  const scopes = 'pins:read pins:write boards:read user:read';
  const state = Math.random().toString(36).substring(7);
  
  return {
    url: `https://www.pinterest.com/oauth/?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${state}`,
    state,
  };
};

const exchangeCodeForToken = async (code) => {
  const appId = getAppId();
  const appSecret = getAppSecret();
  const redirectUri = getRedirectUri();

  if (!appId || !appSecret) {
    throw new Error('PINTEREST_APP_ID or PINTEREST_APP_SECRET not configured');
  }

  const response = await fetch('https://api.pinterest.com/v5/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: appId,
      client_secret: appSecret,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Pinterest token exchange error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
};

module.exports = {
  searchPinterestImages,
  searchPinterestPins,
  getUserPins,
  getUserBoards,
  getOauthUrl,
  exchangeCodeForToken,
};