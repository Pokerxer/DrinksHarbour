export const getApiUrl = (): string => {
  // Priority: explicit env var > vercel env > localhost
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // Vercel provides this automatically in production
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Fallback to localhost for development
  return 'http://localhost:5001';
};

export const API_URL = getApiUrl();