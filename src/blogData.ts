export interface ArticleRelatedProduct {
  id?: string;
  name: string;
  brand?: string;
  price?: number;
  mrp?: number;
  ret?: string;
  retUrl?: string;
  affUrl?: string;
  imgUrl?: string;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  metaTitle: string;
  metaDesc: string;
  excerpt: string;
  content: string;
  authorName: string;
  authorUrl?: string;
  coverImage: string;
  coverImageAlt: string;
  category: string;
  tags: string[];
  published: boolean;
  publishedAt: string;
  updatedAt: string;
  createdAt?: string;
  hasAffiliateLinks: boolean;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDesc?: string;
  ogImage?: string;
  twitterCard?: 'summary_large_image' | 'summary';
  noindex?: boolean;
  relatedProducts?: ArticleRelatedProduct[];
  readTimeMinutes?: number;
  // Aliases for editor & API ergonomics
  seoTitle?: string;
  coverAlt?: string;
  canonicalOverride?: string;
  ogDescription?: string;
  affiliateDisclosure?: boolean;
  noIndex?: boolean;
}

export const SEED_ARTICLES: Article[] = [];

export function calculateReadTime(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

export function formatBlogDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Recently Published';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return 'Recently Published';
  }
}
