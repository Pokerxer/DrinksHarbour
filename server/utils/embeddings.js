// utils/embeddings.js

/**
 * Embeddings Utility for DrinksHarbour
 * 
 * Handles text-to-vector embeddings for semantic search, product recommendations,
 * and similarity calculations.
 * 
 * Supported Embedding Providers:
 * - Local (transformers.js) - DEFAULT - No API costs, runs locally
 * - Hugging Face Inference API (deprecated)
 * - OpenAI Embeddings API
 * - Cohere Embeddings API
 * 
 * Features:
 * - Product description embeddings
 * - Semantic search
 * - Similarity calculations
 * - Batch processing
 * - Caching
 */

const axios = require('axios');
const crypto = require('crypto');

// ============================================================
// Configuration
// ============================================================

const EMBEDDING_CONFIG = {
  provider: process.env.EMBEDDING_PROVIDER || 'local', // 'local' (default), 'huggingface', 'openai', 'cohere'
  
  local: {
    model: 'Xenova/all-MiniLM-L6-v2',
    dimensions: 384,
    maxLength: 512,
  },
  
  huggingface: {
    apiKey: process.env.HUGGINGFACE_API_KEY,
    model: process.env.HUGGINGFACE_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
    apiUrl: 'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
    dimensions: 384,
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    apiUrl: 'https://api.openai.com/v1/embeddings',
    dimensions: 1536,
  },
  
  cohere: {
    apiKey: process.env.COHERE_API_KEY,
    model: process.env.COHERE_MODEL || 'embed-english-v3.0',
    apiUrl: 'https://api.cohere.ai/v1/embed',
    dimensions: 1024,
  },
  
  // General settings
  maxTextLength: 512,
  batchSize: 10,
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
};

// In-memory cache for embeddings (use Redis in production)
const embeddingCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================
// Local Embeddings (transformers.js)
// ============================================================

let localPipeline = null;
let localModelLoading = false;
let localModelPromise = null;

async function getLocalPipeline() {
  // If already loaded, return it
  if (localPipeline) {
    return localPipeline;
  }
  
  // If already loading, wait for it
  if (localModelPromise) {
    return localModelPromise;
  }
  
  // Start loading
  localModelLoading = true;
  
  localModelPromise = (async () => {
    try {
      console.log('🔄 Loading local embedding model (first request - may take a moment)...');
      
      const { pipeline, env } = require('@xenova/transformers');
      
      // Configure for server-side usage
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      
      // Load the model
      const extractor = await pipeline(
        'feature-extraction',
        EMBEDDING_CONFIG.local.model,
        {
          quantized: true, // Use quantized model for faster loading
        }
      );
      
      localPipeline = extractor;
      console.log('✅ Local embedding model loaded successfully');
      
      return extractor;
    } catch (error) {
      console.error('❌ Failed to load local embedding model:', error.message);
      localPipeline = null;
      localModelPromise = null;
      throw error;
    }
  })();
  
  return localModelPromise;
}

/**
 * Generate embedding using local transformers.js model
 */
async function generateLocalEmbedding(text, options = {}) {
  const config = EMBEDDING_CONFIG.local;
  
  // Check cache first
  const cacheKey = getCacheKey(text, 'local');
  const cached = embeddingCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.embedding;
  }
  
  try {
    const pipeline = await getLocalPipeline();
    
    // Truncate text to max length
    const truncated = text.slice(0, config.maxLength);
    
    // Generate embedding
    const output = pipeline(truncated, {
      pooling: 'mean',
      normalize: true
    });
    
    // Convert Float32Array to regular array
    let embedding = Array.from(output.data);
    
    // Cache the result
    embeddingCache.set(cacheKey, {
      embedding,
      timestamp: Date.now()
    });
    
    return embedding;
  } catch (error) {
    console.error('Local embedding error:', error.message);
    throw new Error(`Failed to generate local embedding: ${error.message}`);
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Generate cache key for text
 */
const getCacheKey = (text, provider = EMBEDDING_CONFIG.provider) => {
  const normalized = text.trim().toLowerCase();
  return crypto
    .createHash('sha256')
    .update(`${provider}:${normalized}`)
    .digest('hex');
};

/**
 * Check if embeddings are enabled
 */
const isEmbeddingsEnabled = () => {
  const provider = EMBEDDING_CONFIG.provider;
  const config = EMBEDDING_CONFIG[provider];
  
  // Local provider doesn't need an API key
  if (provider === 'local') {
    return true;
  }
  
  if (!config || !config.apiKey) {
    console.warn(`Embeddings disabled: ${provider} API key not configured`);
    return false;
  }
  
  return true;
};

/**
 * Truncate text to maximum length
 */
const truncateText = (text, maxLength = EMBEDDING_CONFIG.maxTextLength) => {
  if (!text) return '';
  
  const cleaned = text.trim();
  if (cleaned.length <= maxLength) return cleaned;
  
  // Try to truncate at word boundary
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  return lastSpace > maxLength * 0.8 
    ? truncated.substring(0, lastSpace) 
    : truncated;
};

/**
 * Normalize embedding vector
 */
const normalizeVector = (vector) => {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
};

/**
 * Sleep utility for retries
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================
// Embedding Generators
// ============================================================

/**
 * Generate embedding using Hugging Face
 */
async function generateHuggingFaceEmbedding(text, options = {}) {
  const config = EMBEDDING_CONFIG.huggingface;
  
  if (!config.apiKey) {
    throw new Error('Hugging Face API key not configured');
  }
  
  const truncated = truncateText(text);
  
  try {
    const response = await axios.post(
      config.apiUrl,
      {
        inputs: truncated,
        options: {
          wait_for_model: true,
          use_cache: options.useCache !== false,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: EMBEDDING_CONFIG.timeout,
      }
    );
    
    // Hugging Face returns array of embeddings
    let embedding = response.data;
    
    // Handle different response formats from various Hugging Face endpoints
    // Format 1: Direct array [0.123, -0.456, ...]
    if (Array.isArray(embedding) && typeof embedding[0] === 'number') {
      // Already in correct format
    }
    // Format 2: Nested array [[0.123, -0.456, ...]]
    else if (Array.isArray(embedding) && Array.isArray(embedding[0]) && typeof embedding[0][0] === 'number') {
      embedding = embedding[0];
    }
    // Format 3: Object with embedding property
    else if (embedding && typeof embedding === 'object' && Array.isArray(embedding.embedding)) {
      embedding = embedding.embedding;
    }
    // Format 4: Object with embeddings array
    else if (embedding && typeof embedding === 'object' && Array.isArray(embedding.embeddings)) {
      embedding = embedding.embeddings[0];
    }
    
    // Normalize if requested
    if (options.normalize !== false) {
      embedding = normalizeVector(embedding);
    }
    
    return embedding;
  } catch (error) {
    console.error('Hugging Face embedding error:', error.message);
    
    if (error.response?.status === 503) {
      throw new Error('Hugging Face model is loading, please try again in a moment');
    }
    
    throw new Error(`Failed to generate Hugging Face embedding: ${error.message}`);
  }
}

/**
 * Generate embedding using OpenAI
 */
async function generateOpenAIEmbedding(text, options = {}) {
  const config = EMBEDDING_CONFIG.openai;
  
  if (!config.apiKey) {
    throw new Error('OpenAI API key not configured');
  }
  
  const truncated = truncateText(text);
  
  try {
    const response = await axios.post(
      config.apiUrl,
      {
        input: truncated,
        model: config.model,
        encoding_format: 'float',
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: EMBEDDING_CONFIG.timeout,
      }
    );
    
    let embedding = response.data.data[0].embedding;
    
    // Normalize if requested
    if (options.normalize !== false) {
      embedding = normalizeVector(embedding);
    }
    
    return embedding;
  } catch (error) {
    console.error('OpenAI embedding error:', error.message);
    throw new Error(`Failed to generate OpenAI embedding: ${error.message}`);
  }
}

/**
 * Generate embedding using Cohere
 */
async function generateCohereEmbedding(text, options = {}) {
  const config = EMBEDDING_CONFIG.cohere;
  
  if (!config.apiKey) {
    throw new Error('Cohere API key not configured');
  }
  
  const truncated = truncateText(text);
  
  try {
    const response = await axios.post(
      config.apiUrl,
      {
        texts: [truncated],
        model: config.model,
        input_type: 'search_document',
        truncate: 'END',
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: EMBEDDING_CONFIG.timeout,
      }
    );
    
    let embedding = response.data.embeddings[0];
    
    // Normalize if requested
    if (options.normalize !== false) {
      embedding = normalizeVector(embedding);
    }
    
    return embedding;
  } catch (error) {
    console.error('Cohere embedding error:', error.message);
    throw new Error(`Failed to generate Cohere embedding: ${error.message}`);
  }
}

/**
 * Generate embedding with retry logic
 */
async function generateEmbeddingWithRetry(text, options = {}) {
  const provider = options.provider || EMBEDDING_CONFIG.provider;
  const maxRetries = options.retries || EMBEDDING_CONFIG.retries;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let embedding;
      
      switch (provider) {
        case 'local':
          embedding = await generateLocalEmbedding(text, options);
          break;
        case 'huggingface':
          embedding = await generateHuggingFaceEmbedding(text, options);
          break;
        case 'openai':
          embedding = await generateOpenAIEmbedding(text, options);
          break;
        case 'cohere':
          embedding = await generateCohereEmbedding(text, options);
          break;
        default:
          // Fallback to local if unknown provider
          console.warn(`Unknown provider '${provider}', falling back to local`);
          embedding = await generateLocalEmbedding(text, options);
      }
      
      return embedding;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      console.warn(`Embedding attempt ${attempt} failed, retrying...`);
      await sleep(EMBEDDING_CONFIG.retryDelay * attempt);
    }
  }
}

// ============================================================
// Main Embedding Functions
// ============================================================

/**
 * Generate embedding for text
 * @param {string} text - Text to generate embedding for
 * @param {object} options - Options
 * @returns {Promise<number[]>} - Embedding vector
 */
async function generateEmbedding(text, options = {}) {
  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string');
  }
  
  if (!isEmbeddingsEnabled()) {
    console.warn('Embeddings disabled, returning null');
    return null;
  }
  
  // Check cache
  const cacheKey = getCacheKey(text);
  if (options.useCache !== false && embeddingCache.has(cacheKey)) {
    const cached = embeddingCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.embedding;
    }
    embeddingCache.delete(cacheKey);
  }
  
  // Generate embedding
  const embedding = await generateEmbeddingWithRetry(text, options);
  
  // Cache result
  if (options.useCache !== false) {
    embeddingCache.set(cacheKey, {
      embedding,
      timestamp: Date.now(),
    });
  }
  
  return embedding;
}

/**
 * Generate embeddings for multiple texts (batch)
 * @param {string[]} texts - Array of texts
 * @param {object} options - Options
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
async function generateEmbeddings(texts, options = {}) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('Texts must be a non-empty array');
  }
  
  if (!isEmbeddingsEnabled()) {
    console.warn('Embeddings disabled, returning nulls');
    return texts.map(() => null);
  }
  
  const embeddings = [];
  const batchSize = options.batchSize || EMBEDDING_CONFIG.batchSize;
  
  // Process in batches
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
    // Generate embeddings for batch in parallel
    const batchEmbeddings = await Promise.all(
      batch.map(text => generateEmbedding(text, options))
    );
    
    embeddings.push(...batchEmbeddings);
    
    // Small delay between batches to avoid rate limits
    if (i + batchSize < texts.length) {
      await sleep(100);
    }
  }
  
  return embeddings;
}

/**
 * Generate embedding for product
 * Combines multiple product fields into a rich text representation
 */
async function generateProductEmbedding(product, options = {}) {
  // Build comprehensive text representation
  const parts = [];
  
  // Name (highest weight)
  if (product.name) {
    parts.push(product.name);
    parts.push(product.name); // Duplicate for emphasis
  }
  
  // Brand
  if (product.brand?.name) {
    parts.push(product.brand.name);
  }
  
  // Category and type
  if (product.category?.name) {
    parts.push(product.category.name);
  }
  if (product.type) {
    parts.push(product.type.replace(/_/g, ' '));
  }
  
  // Description
  if (product.shortDescription) {
    parts.push(product.shortDescription);
  } else if (product.description) {
    parts.push(truncateText(product.description, 200));
  }
  
  // Tasting notes
  if (product.tastingNotes) {
    if (product.tastingNotes.aroma) {
      parts.push(product.tastingNotes.aroma.join(' '));
    }
    if (product.tastingNotes.palate) {
      parts.push(product.tastingNotes.palate.join(' '));
    }
    if (product.tastingNotes.finish) {
      parts.push(product.tastingNotes.finish.join(' '));
    }
  }
  
  // Flavor profile
  if (product.flavorProfile && Array.isArray(product.flavorProfile)) {
    parts.push(product.flavorProfile.join(' '));
  }
  
  // Tags
  if (product.tags && Array.isArray(product.tags)) {
    const tagNames = product.tags
      .map(tag => typeof tag === 'string' ? tag : tag.name)
      .filter(Boolean);
    parts.push(tagNames.join(' '));
  }
  
  // Origin
  if (product.originCountry) {
    parts.push(product.originCountry);
  }
  if (product.region) {
    parts.push(product.region);
  }
  
  // ABV for context
  if (product.isAlcoholic && product.abv) {
    parts.push(`${product.abv}% alcohol`);
  }
  
  const text = parts.filter(Boolean).join('. ');
  
  if (!text) {
    throw new Error('Product has insufficient data for embedding generation');
  }
  
  return generateEmbedding(text, options);
}

// ============================================================
// Similarity Calculations
// ============================================================

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vectorA - First vector
 * @param {number[]} vectorB - Second vector
 * @returns {number} - Similarity score (0 to 1)
 */
function cosineSimilarity(vectorA, vectorB) {
  if (!vectorA || !vectorB) {
    return 0;
  }
  
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same dimensions');
  }
  
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  
  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }
  
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Calculate Euclidean distance between two vectors
 * @param {number[]} vectorA - First vector
 * @param {number[]} vectorB - Second vector
 * @returns {number} - Distance (lower is more similar)
 */
function euclideanDistance(vectorA, vectorB) {
  if (!vectorA || !vectorB) {
    return Infinity;
  }
  
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same dimensions');
  }
  
  let sum = 0;
  for (let i = 0; i < vectorA.length; i++) {
    const diff = vectorA[i] - vectorB[i];
    sum += diff * diff;
  }
  
  return Math.sqrt(sum);
}

/**
 * Find most similar items from a list
 * @param {number[]} queryVector - Query embedding
 * @param {Array} items - Array of items with embeddings
 * @param {object} options - Options
 * @returns {Array} - Sorted array of items with similarity scores
 */
function findMostSimilar(queryVector, items, options = {}) {
  const {
    embeddingField = 'embedding',
    limit = 10,
    threshold = 0,
    metric = 'cosine', // 'cosine' or 'euclidean'
  } = options;
  
  if (!queryVector || !Array.isArray(items)) {
    return [];
  }
  
  // Calculate similarities
  const withScores = items
    .map(item => {
      const embedding = item[embeddingField];
      if (!embedding) return null;
      
      let score;
      if (metric === 'euclidean') {
        const distance = euclideanDistance(queryVector, embedding);
        score = 1 / (1 + distance); // Convert distance to similarity
      } else {
        score = cosineSimilarity(queryVector, embedding);
      }
      
      return {
        ...item,
        similarityScore: score,
      };
    })
    .filter(item => item !== null && item.similarityScore >= threshold);
  
  // Sort by similarity (descending)
  withScores.sort((a, b) => b.similarityScore - a.similarityScore);
  
  // Return top N
  return limit ? withScores.slice(0, limit) : withScores;
}

// ============================================================
// Search Functions
// ============================================================

/**
 * Search products by semantic similarity
 * @param {string} query - Search query
 * @param {Array} products - Array of products with embeddings
 * @param {object} options - Options
 * @returns {Promise<Array>} - Sorted products with scores
 */
async function semanticSearch(query, products, options = {}) {
  if (!query || !products || products.length === 0) {
    return [];
  }
  
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query, options);
  
  if (!queryEmbedding) {
    console.warn('Failed to generate query embedding');
    return [];
  }
  
  // Find similar products
  return findMostSimilar(queryEmbedding, products, {
    ...options,
    embeddingField: 'embedding',
  });
}

/**
 * Get product recommendations based on a product
 * @param {object} product - Source product with embedding
 * @param {Array} candidateProducts - Products to compare against
 * @param {object} options - Options
 * @returns {Array} - Recommended products with scores
 */
function getProductRecommendations(product, candidateProducts, options = {}) {
  if (!product?.embedding || !candidateProducts) {
    return [];
  }
  
  // Filter out the source product
  const candidates = candidateProducts.filter(
    p => p._id?.toString() !== product._id?.toString()
  );
  
  return findMostSimilar(product.embedding, candidates, {
    ...options,
    embeddingField: 'embedding',
    limit: options.limit || 5,
    threshold: options.threshold || 0.7,
  });
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get embedding dimensions for current provider
 */
function getEmbeddingDimensions(provider = EMBEDDING_CONFIG.provider) {
  const config = EMBEDDING_CONFIG[provider];
  return config ? config.dimensions : null;
}

/**
 * Clear embedding cache
 */
function clearEmbeddingCache() {
  const size = embeddingCache.size;
  embeddingCache.clear();
  return size;
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  let validEntries = 0;
  let expiredEntries = 0;
  
  const now = Date.now();
  for (const [key, value] of embeddingCache.entries()) {
    if (now - value.timestamp < CACHE_TTL) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  }
  
  return {
    total: embeddingCache.size,
    valid: validEntries,
    expired: expiredEntries,
    ttl: CACHE_TTL,
  };
}

/**
 * Validate embedding vector
 */
function validateEmbedding(embedding, expectedDimensions = null) {
  if (!Array.isArray(embedding)) {
    return { valid: false, error: 'Embedding must be an array' };
  }
  
  if (embedding.length === 0) {
    return { valid: false, error: 'Embedding cannot be empty' };
  }
  
  if (expectedDimensions && embedding.length !== expectedDimensions) {
    return {
      valid: false,
      error: `Embedding has ${embedding.length} dimensions, expected ${expectedDimensions}`,
    };
  }
  
  if (!embedding.every(val => typeof val === 'number' && !isNaN(val))) {
    return { valid: false, error: 'Embedding must contain only valid numbers' };
  }
  
  return { valid: true };
}

/**
 * Average multiple embeddings
 */
function averageEmbeddings(embeddings) {
  if (!Array.isArray(embeddings) || embeddings.length === 0) {
    return null;
  }
  
  const dimensions = embeddings[0].length;
  const averaged = new Array(dimensions).fill(0);
  
  for (const embedding of embeddings) {
    if (embedding.length !== dimensions) {
      throw new Error('All embeddings must have the same dimensions');
    }
    for (let i = 0; i < dimensions; i++) {
      averaged[i] += embedding[i];
    }
  }
  
  for (let i = 0; i < dimensions; i++) {
    averaged[i] /= embeddings.length;
  }
  
  return normalizeVector(averaged);
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  // Main functions
  generateEmbedding,
  generateEmbeddings,
  generateProductEmbedding,
  
  // Similarity
  cosineSimilarity,
  euclideanDistance,
  findMostSimilar,
  
  // Search
  semanticSearch,
  getProductRecommendations,
  
  // Utilities
  getEmbeddingDimensions,
  clearEmbeddingCache,
  getCacheStats,
  validateEmbedding,
  normalizeVector,
  averageEmbeddings,
  truncateText,
  isEmbeddingsEnabled,
  
  // Config
  EMBEDDING_CONFIG,
};