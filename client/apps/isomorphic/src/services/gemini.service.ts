// Services for Gemini AI API calls

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

interface ProductDetailsResponse {
  success: boolean;
  data: {
    name: string;
    slug: string;
    type: string;
    subType: string;
    isAlcoholic: boolean;
    abv: number;
    volumeMl: number;
    originCountry: string;
    region: string;
    brand: string;
    producer: string;
    vintage?: number;
    age?: number;
    ageStatement: string;
    productionMethod: string;
    shortDescription: string;
    description: string;
    tastingNotes: {
      nose: string[];
      palate: string[];
      finish: string[];
      color: string;
    };
    flavorProfile: string[];
    foodPairings: string[];
    servingSuggestions: {
      temperature: string;
      glassware: string;
      garnish: string[];
      mixers: string[];
    };
    isDietary: {
      vegan: boolean;
      vegetarian: boolean;
      glutenFree: boolean;
      organic: boolean;
    };
    allergens: string[];
    ingredients: string;
    metaTitle: string;
    metaDescription: string;
    keywords: string[];
  };
}

interface DescriptionResponse {
  success: boolean;
  data: {
    shortDescription: string;
    description: string;
    flavorProfile: string[];
    foodPairings: string[];
  };
}

interface OriginResponse {
  success: boolean;
  data: {
    originCountry: string;
    region: string;
    appellation: string;
    producer: string;
    brand: string;
    vintage: number | null;
    age: number | null;
    ageStatement: string;
    distilleryName: string;
    breweryName: string;
    wineryName: string;
    productionMethod: string;
    caskType: string;
    finish: string;
  };
}

interface BeverageInfoResponse {
  success: boolean;
  data: {
    isAlcoholic: boolean;
    abv: number;
    proof: number | null;
    volumeMl: number;
    standardSizes: string[];
    servingSize: string;
    servingsPerContainer: number;
  };
}

interface SeoResponse {
  success: boolean;
  data: {
    metaTitle: string;
    metaDescription: string;
    keywords: string[];
  };
}

interface TagsResponse {
  success: boolean;
  data: {
    tags: string[];
  };
}

interface PricingResponse {
  success: boolean;
  data: {
    suggestedRetailPrice: {
      USD: number;
      EUR: number;
      GBP: number;
      NGN: number;
    };
    wholesalePrice: {
      USD: number;
      EUR: number;
      GBP: number;
      NGN: number;
    };
    costPrice: {
      USD: number;
      EUR: number;
      GBP: number;
      NGN: number;
    };
    profitMargin: number;
    pricingTier: string;
    reasoning: string;
  };
}

interface ShortDescriptionResponse {
  success: boolean;
  data: {
    shortDescription: string;
  };
}

interface FullDescriptionResponse {
  success: boolean;
  data: {
    description: string;
  };
}

interface FlavorProfileResponse {
  success: boolean;
  data: {
    flavorProfile: string[];
  };
}

interface FoodPairingsResponse {
  success: boolean;
  data: {
    foodPairings: string[];
  };
}

interface TastingNotesResponse {
  success: boolean;
  data: {
    nose?: string[];
    palate?: string[];
    finish?: string[];
    color?: string;
  };
}

interface OriginCountryResponse {
  success: boolean;
  data: {
    originCountry: string;
  };
}

interface RegionResponse {
  success: boolean;
  data: {
    region: string;
  };
}

interface AppellationResponse {
  success: boolean;
  data: {
    appellation: string;
  };
}

interface ProducerResponse {
  success: boolean;
  data: {
    producer: string;
  };
}

interface VintageResponse {
  success: boolean;
  data: {
    vintage: number | null;
  };
}

interface AgeStatementResponse {
  success: boolean;
  data: {
    ageStatement: string;
  };
}

interface ProductionMethodResponse {
  success: boolean;
  data: {
    productionMethod: string;
  };
}

interface CaskTypeResponse {
  success: boolean;
  data: {
    caskType: string;
  };
}

interface ServingTemperatureResponse {
  success: boolean;
  data: {
    temperature: string;
  };
}

interface GlasswareResponse {
  success: boolean;
  data: {
    glassware: string;
  };
}

interface GarnishResponse {
  success: boolean;
  data: {
    garnish: string[];
  };
}

interface MixersResponse {
  success: boolean;
  data: {
    mixers: string[];
  };
}

interface AllergensResponse {
  success: boolean;
  data: {
    allergens: string[];
  };
}

interface IngredientsResponse {
  success: boolean;
  data: {
    ingredients: string[];
  };
}

interface MetaTitleResponse {
  success: boolean;
  data: {
    metaTitle: string;
  };
}

interface MetaDescriptionResponse {
  success: boolean;
  data: {
    metaDescription: string;
  };
}

interface KeywordsResponse {
  success: boolean;
  data: {
    keywords: string[];
  };
}

interface DietaryResponse {
  success: boolean;
  data: {
    isDietary: {
      vegan: boolean;
      vegetarian: boolean;
      glutenFree: boolean;
      organic: boolean;
    };
  };
}

interface NutritionalInfoResponse {
  success: boolean;
  data: {
    nutritionalInfo: {
      calories: number;
      carbohydrates: number;
      sugar: number;
      protein: number;
      fat: number;
    };
  };
}

interface VolumeAbvResponse {
  success: boolean;
  data: {
    abv: number;
    volumeMl: number;
    isAlcoholic: boolean;
  };
}

interface StandardSizesResponse {
  success: boolean;
  data: {
    standardSizes: string[];
  };
}

interface SlugResponse {
  success: boolean;
  data: {
    slug: string;
  };
}

interface BrandDescriptionResponse {
  success: boolean;
  data: {
    description: string;
  };
}

interface BrandCountryResponse {
  success: boolean;
  data: {
    countryOfOrigin: string;
  };
}

interface BrandFoundedResponse {
  success: boolean;
  data: {
    founded: number | null;
  };
}

interface BrandCategoryResponse {
  success: boolean;
  data: {
    primaryCategory: string;
  };
}

// Helper function to handle fetch errors
const handleFetchError = async (response: Response): Promise<never> => {
  let errorMessage = 'Failed to connect to server';
  try {
    const errorData = await response.json();
    errorMessage = errorData.message || `Server error: ${response.status}`;
  } catch {
    errorMessage = `Server error: ${response.status} ${response.statusText}`;
  }
  throw new Error(errorMessage);
};

export const geminiService = {
  /**
   * Generate complete product details from product name
   */
  async generateProductDetails(
    name: string,
    token: string,
    category?: string
  ): Promise<ProductDetailsResponse> {
    const url = `${API_URL}/api/gemini/generate-product`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, category }),
      });

      if (!response.ok) {
        await handleFetchError(response);
      }

      return response.json();
    } catch (error: any) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error('Cannot connect to server. Please check if the backend is running.');
      }
      throw error;
    }
  },

  /**
   * Generate product description only
   */
  async generateDescription(
    name: string,
    token: string,
    type?: string,
    brand?: string
  ): Promise<DescriptionResponse> {
    const url = `${API_URL}/api/gemini/generate-description`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, type, brand }),
      });

      if (!response.ok) {
        await handleFetchError(response);
      }

      return response.json();
    } catch (error: any) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error('Cannot connect to server. Please check if the backend is running.');
      }
      throw error;
    }
  },

  /**
   * Generate origin and production details
   */
  async generateOrigin(
    name: string,
    token: string,
    type?: string
  ): Promise<OriginResponse> {
    const url = `${API_URL}/api/gemini/generate-origin`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, type }),
      });

      if (!response.ok) {
        await handleFetchError(response);
      }

      return response.json();
    } catch (error: any) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error('Cannot connect to server. Please check if the backend is running.');
      }
      throw error;
    }
  },

  /**
   * Generate beverage information (ABV, volume, etc.)
   */
  async generateBeverageInfo(
    name: string,
    token: string,
    type?: string
  ): Promise<BeverageInfoResponse> {
    const url = `${API_URL}/api/gemini/generate-beverage-info`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, type }),
      });

      if (!response.ok) {
        await handleFetchError(response);
      }

      return response.json();
    } catch (error: any) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error('Cannot connect to server. Please check if the backend is running.');
      }
      throw error;
    }
  },

  /**
   * Generate SEO content
   */
  async generateSeo(
    name: string,
    token: string,
    shortDescription?: string,
    type?: string,
    brand?: string
  ): Promise<SeoResponse> {
    const url = `${API_URL}/api/gemini/generate-seo`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, shortDescription, type, brand }),
      });

      if (!response.ok) {
        await handleFetchError(response);
      }

      return response.json();
    } catch (error: any) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error('Cannot connect to server. Please check if the backend is running.');
      }
      throw error;
    }
  },

  /**
   * Generate product tags
   */
  async generateTags(
    name: string,
    token: string,
    type?: string,
    category?: string
  ): Promise<TagsResponse> {
    const url = `${API_URL}/api/gemini/generate-tags`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, type, category }),
      });

      if (!response.ok) {
        await handleFetchError(response);
      }

      return response.json();
    } catch (error: any) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error('Cannot connect to server. Please check if the backend is running.');
      }
      throw error;
    }
  },

  /**
   * Generate pricing suggestions
   */
  async generatePricing(
    name: string,
    token: string,
    type?: string,
    abv?: number,
    volumeMl?: number,
    originCountry?: string
  ): Promise<PricingResponse> {
    const url = `${API_URL}/api/gemini/generate-pricing`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, type, abv, volumeMl, originCountry }),
      });

      if (!response.ok) {
        await handleFetchError(response);
      }

      return response.json();
    } catch (error: any) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error('Cannot connect to server. Please check if the backend is running.');
      }
      throw error;
    }
  },

  /**
   * Generate short description
   */
  async generateShortDescription(
    name: string,
    token: string,
    type?: string,
    brand?: string
  ): Promise<ShortDescriptionResponse> {
    const url = `${API_URL}/api/gemini/short-description`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type, brand }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate short description');
    }
  },

  /**
   * Generate full description
   */
  async generateFullDescription(
    name: string,
    token: string,
    type?: string,
    brand?: string,
    originCountry?: string
  ): Promise<FullDescriptionResponse> {
    const url = `${API_URL}/api/gemini/full-description`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type, brand, originCountry }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate full description');
    }
  },

  /**
   * Generate flavor profile
   */
  async generateFlavorProfile(
    name: string,
    token: string,
    type?: string
  ): Promise<FlavorProfileResponse> {
    const url = `${API_URL}/api/gemini/flavor-profile`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate flavor profile');
    }
  },

  /**
   * Generate food pairings
   */
  async generateFoodPairings(
    name: string,
    token: string,
    type?: string,
    flavorProfile?: string[]
  ): Promise<FoodPairingsResponse> {
    const url = `${API_URL}/api/gemini/food-pairings`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type, flavorProfile }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate food pairings');
    }
  },

  /**
   * Generate tasting notes - nose
   */
  async generateTastingNose(
    name: string,
    token: string,
    type?: string,
    flavorProfile?: string[]
  ): Promise<TastingNotesResponse> {
    const url = `${API_URL}/api/gemini/tasting-nose`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type, flavorProfile }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate nose notes');
    }
  },

  /**
   * Generate tasting notes - palate
   */
  async generateTastingPalate(
    name: string,
    token: string,
    type?: string,
    flavorProfile?: string[]
  ): Promise<TastingNotesResponse> {
    const url = `${API_URL}/api/gemini/tasting-palate`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type, flavorProfile }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate palate notes');
    }
  },

  /**
   * Generate tasting notes - finish
   */
  async generateTastingFinish(
    name: string,
    token: string,
    type?: string
  ): Promise<TastingNotesResponse> {
    const url = `${API_URL}/api/gemini/tasting-finish`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate finish notes');
    }
  },

  /**
   * Generate tasting notes - color
   */
  async generateTastingColor(
    name: string,
    token: string,
    type?: string,
    age?: number
  ): Promise<TastingNotesResponse> {
    const url = `${API_URL}/api/gemini/tasting-color`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type, age }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate color description');
    }
  },

  /**
   * Generate origin country
   */
  async generateOriginCountry(
    name: string,
    token: string,
    type?: string,
    brand?: string
  ): Promise<OriginCountryResponse> {
    const url = `${API_URL}/api/gemini/origin-country`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type, brand }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate origin country');
    }
  },

  /**
   * Generate region
   */
  async generateRegion(
    name: string,
    token: string,
    type?: string,
    originCountry?: string
  ): Promise<RegionResponse> {
    const url = `${API_URL}/api/gemini/region`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type, originCountry }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate region');
    }
  },

  /**
   * Generate appellation
   */
  async generateAppellation(
    name: string,
    token: string,
    type?: string,
    originCountry?: string,
    region?: string
  ): Promise<AppellationResponse> {
    const url = `${API_URL}/api/gemini/appellation`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type, originCountry, region }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate appellation');
    }
  },

  /**
   * Generate producer
   */
  async generateProducer(
    name: string,
    token: string,
    brand?: string,
    type?: string
  ): Promise<ProducerResponse> {
    const url = `${API_URL}/api/gemini/producer`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, brand, type }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate producer');
    }
  },

  /**
   * Generate vintage
   */
  async generateVintage(
    name: string,
    token: string,
    type?: string
  ): Promise<VintageResponse> {
    const url = `${API_URL}/api/gemini/vintage`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate vintage');
    }
  },

  /**
   * Generate age statement
   */
  async generateAgeStatement(
    name: string,
    token: string,
    type?: string,
    age?: number
  ): Promise<AgeStatementResponse> {
    const url = `${API_URL}/api/gemini/age-statement`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type, age }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate age statement');
    }
  },

  /**
   * Generate production method
   */
  async generateProductionMethod(
    name: string,
    token: string,
    type?: string
  ): Promise<ProductionMethodResponse> {
    const url = `${API_URL}/api/gemini/production-method`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate production method');
    }
  },

  /**
   * Generate cask type
   */
  async generateCaskType(
    name: string,
    token: string,
    type?: string,
    productionMethod?: string
  ): Promise<CaskTypeResponse> {
    const url = `${API_URL}/api/gemini/cask-type`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type, productionMethod }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate cask type');
    }
  },

  /**
   * Generate serving temperature
   */
  async generateServingTemperature(
    name: string,
    token: string,
    type?: string
  ): Promise<ServingTemperatureResponse> {
    const url = `${API_URL}/api/gemini/serving-temperature`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate serving temperature');
    }
  },

  /**
   * Generate glassware
   */
  async generateGlassware(
    name: string,
    token: string,
    type?: string
  ): Promise<GlasswareResponse> {
    const url = `${API_URL}/api/gemini/glassware`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate glassware');
    }
  },

  /**
   * Generate garnish
   */
  async generateGarnish(
    name: string,
    token: string,
    type?: string
  ): Promise<GarnishResponse> {
    const url = `${API_URL}/api/gemini/garnish`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate garnish');
    }
  },

  /**
   * Generate mixers
   */
  async generateMixers(
    name: string,
    token: string,
    type?: string
  ): Promise<MixersResponse> {
    const url = `${API_URL}/api/gemini/mixers`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate mixers');
    }
  },

  /**
   * Generate allergens
   */
  async generateAllergens(
    name: string,
    token: string,
    type?: string
  ): Promise<AllergensResponse> {
    const url = `${API_URL}/api/gemini/allergens`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate allergens');
    }
  },

  /**
   * Generate ingredients
   */
  async generateIngredients(
    name: string,
    token: string,
    type?: string
  ): Promise<IngredientsResponse> {
    const url = `${API_URL}/api/gemini/ingredients`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate ingredients');
    }
  },

  /**
   * Generate meta title
   */
  async generateMetaTitle(
    name: string,
    token: string,
    brand?: string,
    type?: string
  ): Promise<MetaTitleResponse> {
    const url = `${API_URL}/api/gemini/meta-title`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, brand, type }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate meta title');
    }
  },

  /**
   * Generate meta description
   */
  async generateMetaDescription(
    name: string,
    token: string,
    brand?: string,
    type?: string,
    shortDescription?: string
  ): Promise<MetaDescriptionResponse> {
    const url = `${API_URL}/api/gemini/meta-description`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, brand, type, shortDescription }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate meta description');
    }
  },

  /**
   * Generate keywords
   */
  async generateKeywords(
    name: string,
    token: string,
    brand?: string,
    type?: string,
    category?: string
  ): Promise<KeywordsResponse> {
    const url = `${API_URL}/api/gemini/keywords`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, brand, type, category }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate keywords');
    }
  },

  /**
   * Generate dietary info
   */
  async generateDietary(
    name: string,
    token: string,
    type?: string
  ): Promise<DietaryResponse> {
    const url = `${API_URL}/api/gemini/dietary`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate dietary info');
    }
  },

  /**
   * Generate nutritional info
   */
  async generateNutritionalInfo(
    name: string,
    token: string,
    type?: string,
    abv?: number,
    volumeMl?: number
  ): Promise<NutritionalInfoResponse> {
    const url = `${API_URL}/api/gemini/nutritional-info`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type, abv, volumeMl }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate nutritional info');
    }
  },

  /**
   * Generate volume and ABV
   */
  async generateVolumeAbv(
    name: string,
    token: string,
    type?: string
  ): Promise<VolumeAbvResponse> {
    const url = `${API_URL}/api/gemini/volume-abv`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate volume and ABV');
    }
  },

  /**
   * Generate standard sizes
   */
  async generateStandardSizes(
    name: string,
    token: string,
    type?: string,
    volumeMl?: number
  ): Promise<StandardSizesResponse> {
    const url = `${API_URL}/api/gemini/standard-sizes`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type, volumeMl }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate standard sizes');
    }
  },

  /**
   * Generate slug
   */
  async generateSlug(
    name: string,
    token: string
  ): Promise<SlugResponse> {
    const url = `${API_URL}/api/gemini/slug`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return { success: true, data: { slug } };
    }
  },

  /**
   * Get beverage recommendations
   */
  async getRecommendations(
    query: string,
    token: string,
    category?: string
  ): Promise<{ success: boolean; data: any[] }> {
    const url = `${API_URL}/api/gemini/recommendations`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, category }),
      });

      if (!response.ok) {
        await handleFetchError(response);
      }

      return response.json();
    } catch (error: any) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error('Cannot connect to server. Please check if the backend is running.');
      }
      throw error;
    }
  },

  /**
   * Generate brand description
   */
  async generateBrandDescription(
    name: string,
    token: string,
    productName?: string
  ): Promise<BrandDescriptionResponse> {
    const url = `${API_URL}/api/gemini/brand-description`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, productName }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate brand description');
    }
  },

  /**
   * Generate brand country of origin
   */
  async generateBrandCountry(
    name: string,
    token: string,
    productName?: string
  ): Promise<BrandCountryResponse> {
    const url = `${API_URL}/api/gemini/brand-country`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, productName }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate brand country');
    }
  },

  /**
   * Generate brand founded year
   */
  async generateBrandFounded(
    name: string,
    token: string,
    context?: string
  ): Promise<BrandFoundedResponse> {
    const url = `${API_URL}/api/gemini/brand-founded`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, countryOfOrigin: context }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate brand founded year');
    }
  },

  /**
   * Generate brand primary category
   */
  async generateBrandCategory(
    name: string,
    token: string,
    productName?: string
  ): Promise<BrandCategoryResponse> {
    const url = `${API_URL}/api/gemini/brand-category`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, productName }),
      });
      if (!response.ok) await handleFetchError(response);
      return response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate brand category');
    }
  },
};
