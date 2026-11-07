export type DrinkCategoryPreference = 'toast' | 'wine' | 'beer' | 'spirits' | 'alcohol-free';
export type OccasionGeneration = { categories: DrinkCategoryPreference[]; budget: number; guests: number; selections?: { productId: string; quantity: number }[] };
