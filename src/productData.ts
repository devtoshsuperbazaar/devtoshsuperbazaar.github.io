/**
 * Product Data & Category Definitions for Devtosh SuperBazaar
 * Clean TypeScript module with zero browser DOM dependencies, safe for both
 * client-side React/SPA execution and Node.js Static Site Generation (SSG).
 */

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  cat: string;
  subcat?: string;
  price: number;
  mrp?: number;
  currency?: string;
  col: string;
  sizes: string[];
  ret: string;
  // Shopping link & URL fields (affUrl is primary; others ensure 100% legacy compatibility)
  affUrl?: string; // Primary shopping link (Affiliate URL)
  retUrl?: string; // Legacy retailer product URL
  affiliateUrl?: string; // Legacy alias
  retailerProductUrl?: string; // Legacy alias
  imgUrl?: string;
  videoUrl?: string;
  categories?: string[]; // Storefront category collection assignments (e.g. ['all', 'women', 'accessories'])
  desc: string;
  published: boolean;
  featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Demo styling properties
  sh?: string;
  tint?: string;
  g?: string;
  added?: number;
  isDemo?: boolean;
}

/**
 * Resolves the customer shopping URL from a product document,
 * checking the primary affiliate link first, then legacy fields.
 */
export function getProductShoppingUrl(p: Partial<Product> | null | undefined): string {
  if (!p) return '';
  return p.affUrl || p.affiliateUrl || p.retUrl || p.retailerProductUrl || '';
}

export interface CategoryMeta {
  key: string;
  slug: string;
  name: string;
  h1: string;
  title: string;
  description: string;
  badge: string;
}

export const SITE_CATEGORIES: CategoryMeta[] = [
  {
    key: 'women',
    slug: 'women',
    name: 'Women’s Collection',
    h1: 'Women’s Ethnic & Western Wear',
    title: "Devtosh Superbazaar - Women's Fashion & Clothing",
    description: "Discover sarees, kurtis, dresses, handbags and more at Devtosh Superbazaar. Explore women's fashion and find products from online retailers.",
    badge: 'Ethnic & Western'
  },
  {
    key: 'men',
    slug: 'men',
    name: 'Men’s Collection',
    h1: 'Men’s Casuals & Tailored Essentials',
    title: "Devtosh Superbazaar - Men's Fashion & Clothing",
    description: "Explore men's shirts, jeans, trousers, footwear and everyday fashion at Devtosh Superbazaar. Discover styles from online retail partners.",
    badge: 'Menswear'
  },
  {
    key: 'kids',
    slug: 'kids',
    name: 'Kids & Baby',
    h1: 'Kids & Baby Clothing & Essentials',
    title: "Devtosh Superbazaar - Kids' Clothing & Baby Products",
    description: "Browse kids' clothing, baby products, footwear and everyday essentials at Devtosh Superbazaar. Explore collections from online retailers.",
    badge: 'Kids & Baby'
  },
  {
    key: 'footwear',
    slug: 'footwear',
    name: 'Footwear Collection',
    h1: 'Footwear — Sneakers, Loafers & Sandals',
    title: 'Devtosh Superbazaar - Shoes, Sneakers & Footwear',
    description: 'Discover sneakers, shoes, sandals and everyday footwear at Devtosh Superbazaar. Browse styles for different occasions and preferences.',
    badge: 'Footwear'
  },
  {
    key: 'mobiles',
    slug: 'mobiles',
    name: 'Electronics & Mobiles',
    h1: 'Electronics, Smartphones & Mobile Holders',
    title: 'Devtosh Superbazaar - Mobiles & Electronics',
    description: 'Explore smartphones, earphones, mobile accessories and electronics at Devtosh Superbazaar. Discover products from online retail partners.',
    badge: 'Mobiles & Tech'
  },
  {
    key: 'electronics',
    slug: 'electronics',
    name: 'Electronics & Gadgets',
    h1: 'Electronics, Gadgets & Audio Accessories',
    title: 'Devtosh Superbazaar - Mobiles & Electronics',
    description: 'Explore smartphones, earphones, mobile accessories and electronics at Devtosh Superbazaar. Discover products from online retail partners.',
    badge: 'Tech & Gadgets'
  },
  {
    key: 'accessories',
    slug: 'accessories',
    name: 'Accessories & Lifestyle',
    h1: 'Accessories & Lifestyle Essentials',
    title: 'Devtosh Superbazaar - Fashion Accessories & Lifestyle',
    description: 'Browse handbags, watches, wallets, jewellery and lifestyle accessories at Devtosh Superbazaar. Discover products across online retailers.',
    badge: 'Accessories'
  },
  {
    key: 'home-living',
    slug: 'home-living',
    name: 'Home & Living',
    h1: 'Home & Living Essentials',
    title: 'Devtosh Superbazaar - Home & Living Products',
    description: 'Discover kitchen utilities, insulated water bottles, home decor, and organizers at Devtosh Superbazaar. Curated essentials from verified retailers.',
    badge: 'Home & Living'
  },
  {
    key: 'new',
    slug: 'new',
    name: 'New Arrivals',
    h1: 'New In: Latest Drops & Fresh Finds',
    title: 'Devtosh Superbazaar - Latest Fashion & New Arrivals',
    description: 'Browse the latest curated fashion, footwear, electronics, and trending lifestyle additions at Devtosh Superbazaar from verified retailers.',
    badge: 'Fresh Drops'
  }
];

export const MAX_PRODUCT_SLUG_LENGTH = 65;

/**
 * Generates a URL-safe, clean product slug capped at exactly 65 characters,
 * with deterministic collision avoidance. Never uses raw product IDs or arbitrary fragments.
 */
export function generateSafeProductSlug(name: string, uniqueId?: string): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (!trimmed) return '';

  // 1. Normalize: lowercase, remove accents, replace non-alphanumeric with hyphens
  let base = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!base) return '';

  // If base already fits within 65 characters and no uniqueId suffix is requested
  if (base.length <= MAX_PRODUCT_SLUG_LENGTH && !uniqueId) {
    return base;
  }

  // 2. Deterministic suffix if needed
  let suffix = '';
  if (uniqueId) {
    const cleanId = uniqueId.replace(/[^a-z0-9]/gi, '').toLowerCase();
    suffix = cleanId.slice(-6).padStart(6, '0');
  } else {
    let hash = 0;
    for (let i = 0; i < trimmed.length; i++) {
      hash = ((hash << 5) - hash) + trimmed.charCodeAt(i);
      hash |= 0;
    }
    suffix = Math.abs(hash).toString(36).padStart(6, '0').slice(0, 6);
  }

  // If base length exceeds 65 or uniqueId provided
  if (base.length > MAX_PRODUCT_SLUG_LENGTH || uniqueId) {
    const maxBaseLen = MAX_PRODUCT_SLUG_LENGTH - (suffix.length + 1); // 65 - 7 = 58
    let truncated = base.slice(0, maxBaseLen);
    if (base.length > maxBaseLen) {
      const lastHyphen = truncated.lastIndexOf('-');
      if (lastHyphen > 20) {
        truncated = truncated.slice(0, lastHyphen);
      }
    }
    truncated = truncated.replace(/-+$/, '');
    base = `${truncated}-${suffix}`;
  }

  if (base.length > MAX_PRODUCT_SLUG_LENGTH) {
    base = base.slice(0, MAX_PRODUCT_SLUG_LENGTH).replace(/-+$/, '');
  }

  return base;
}

/**
 * Returns a backward-compatible, filesystem-safe slug for any product.
 * Preserves existing short, valid published slugs (<= 65 chars) without alteration.
 * If an existing slug exceeds 65 characters, it safely normalizes it within 65 characters.
 */
export function getSafeProductSlug(slug?: string, uniqueId?: string, name?: string): string {
  if (!slug || typeof slug !== 'string') {
    return name ? generateSafeProductSlug(name, uniqueId) : '';
  }
  const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  if (clean.length > 0 && clean.length <= MAX_PRODUCT_SLUG_LENGTH) {
    return clean;
  }
  return generateSafeProductSlug(clean || name || 'product', uniqueId);
}

export const DEMO_PRODUCTS: Product[] = [];

// ============================================================================
// Department and Category matchers (Strict taxonomy, zero broad keyword leaks)
// ============================================================================

export function isElectronicsProduct(p: Product): boolean {
  const cat = (p.cat || '').toLowerCase();
  const name = (p.name || '').toLowerCase();
  if (
    cat.includes('mobile holders') || cat.includes('mount') || cat.includes('electronics') ||
    cat.includes('smartphone') || cat.includes('audio') || cat.includes('smartwatch')
  ) {
    return true;
  }
  return name.includes('holder') || name.includes('mount') || name.includes('stand') ||
         name.includes('tripod') || name.includes('earbud') || name.includes('earphone') ||
         name.includes('headphone') || name.includes('neckband') || name.includes('smartwatch') ||
         name.includes('charger') || name.includes('power bank') || name.includes('data cable') ||
         name.includes('usb cable');
}

export function isFootwearProduct(p: Product): boolean {
  const cat = (p.cat || '').toLowerCase();
  const name = (p.name || '').toLowerCase();
  if (cat.includes('footwear') || cat.includes('shoe') || cat.includes('sandal')) return true;

  // Protect against mobile holder / tech matches
  if (name.includes('holder') || name.includes('mount') || name.includes('stand') || name.includes('phone')) {
    return false;
  }

  return name.includes('shoe') || name.includes('sneaker') || name.includes('loafer') ||
         name.includes('boot') || name.includes('sandal') || name.includes('slipper') ||
         name.includes('slide') || name.includes('croc') || name.includes('heel') ||
         name.includes('flat') || name.includes('chappal');
}

/**
 * Kids & Baby collection matcher:
 * Only genuine children's products belong here. Words like "girls" in "women & girls handbag"
 * or "school purse for women" must NEVER qualify a women's accessory or women's clothing as Kids.
 */
export function isKidsProduct(p: Product): boolean {
  const cat = (p.cat || '').toLowerCase();
  const name = (p.name || '').toLowerCase();

  // Explicit Kids categories
  if (cat.includes('kids') || cat.includes('baby') || cat.includes('toy')) {
    return true;
  }

  // Strong exclusion: If the product is clearly for adult women, it is NOT Kids
  if (
    name.includes('women') || name.includes('ladies') || name.includes('saree') ||
    name.includes('kurti') || name.includes('lehenga') || name.includes('purse') ||
    name.includes('handbag') || name.includes('bra') || name.includes('lingerie')
  ) {
    return false;
  }

  // Exclude adult menswear
  if (name.includes('menswear') || name.includes("men's") || name.includes('men shirt')) {
    return false;
  }

  // Only qualify if explicitly targeting baby or kids
  return (
    name.includes('infant') || name.includes('toddler') || name.includes('babywear') ||
    name.includes('romper') || name.includes('baby') || name.includes('toy') ||
    name.includes('kids wear') || name.includes('kids clothing') || name.includes('boys clothes') ||
    name.includes('girls frock') || name.includes('kids shoes')
  );
}

/**
 * Women's Collection matcher:
 * Includes Women's ethnic wear, western wear, tops, dresses, jewellery, handbags,
 * and women's footwear.
 */
export function isWomenProduct(p: Product): boolean {
  const cat = (p.cat || '').toLowerCase();
  const name = (p.name || '').toLowerCase();

  // If it's strictly a kids product, exclude from Women
  if (isKidsProduct(p)) return false;

  // Women's categories
  if (
    cat.includes('women') || cat.includes('saree') || cat.includes('kurti') ||
    cat.includes('dress') || cat.includes('jewel') || cat.includes('handbag') ||
    cat.includes('ethnic wear')
  ) {
    return true;
  }

  // Protect against pure tech / electronics
  if (isElectronicsProduct(p) || (p.cat || '').toLowerCase().includes('holder')) return false;

  return (
    name.includes('women') || name.includes('ladies') || name.includes('saree') ||
    name.includes('sari') || name.includes('kurti') || name.includes('lehenga') ||
    name.includes('anarkali') || name.includes('dupatta') || name.includes('blouse') ||
    name.includes('dress') || name.includes('gown') || name.includes('handbag') ||
    name.includes('purse') || name.includes('clutch') || name.includes('jewel') ||
    name.includes('earring') || name.includes('necklace') || name.includes('bangle') ||
    name.includes('mangalsutra') || name.includes('palazzo') || name.includes('salwar')
  );
}

/**
 * Men's Collection matcher:
 * Includes shirts, t-shirts, jeans, trousers, jackets, and men's footwear.
 */
export function isMenProduct(p: Product): boolean {
  const cat = (p.cat || '').toLowerCase();
  const name = (p.name || '').toLowerCase();

  if (isWomenProduct(p) || isKidsProduct(p) || isElectronicsProduct(p)) return false;

  if (
    cat.includes('men') || cat.includes('shirt') || cat.includes('jean') ||
    cat.includes('trouser') || cat.includes('jacket')
  ) {
    return true;
  }

  return (
    name.includes("men's") || name.includes('menswear') || name.includes('shirt') ||
    name.includes('tshirt') || name.includes('t-shirt') || name.includes('polo') ||
    name.includes('jean') || name.includes('denim') || name.includes('trouser') ||
    name.includes('chino') || name.includes('cargo') || name.includes('jacket') ||
    name.includes('blazer') || name.includes('kurta')
  );
}

/**
 * Accessories & Lifestyle collection matcher:
 * STRICT TAXONOMY: Includes only wallets, belts, sunglasses, watches, caps, hats,
 * backpacks, handbags, fashion jewellery, and mobile mounts.
 * NEVER acts as a fallback for clothing, shoes, or unclassified items.
 */
export function isAccessoriesProduct(p: Product): boolean {
  const cat = (p.cat || '').toLowerCase();
  const name = (p.name || '').toLowerCase();
  const textCombined = `${cat} ${name}`;

  // Explicit non-accessories exclusions (Clothing & footwear are not accessories)
  if (
    textCombined.includes('saree') || textCombined.includes('sari') ||
    textCombined.includes('kurti') || textCombined.includes('lehenga') ||
    textCombined.includes('dress') || textCombined.includes('gown') ||
    textCombined.includes('shirt') || textCombined.includes('tshirt') ||
    textCombined.includes('t-shirt') || textCombined.includes('jean') ||
    textCombined.includes('trouser') || textCombined.includes('hoodie') ||
    textCombined.includes('jacket') || textCombined.includes('mop') ||
    cat.includes('home') || cat.includes('kitchen')
  ) {
    if (!name.includes('belt') && !name.includes('pin') && !name.includes('brooch')) {
      return false;
    }
  }

  // Standard footwear is separate
  if (cat.includes('footwear') || (isFootwearProduct(p) && !name.includes('shoe care'))) {
    return false;
  }

  // Genuine accessories categories
  if (
    cat.includes('accessor') || cat.includes('handbag') || cat.includes('jewel') ||
    cat.includes('sunglass') || cat.includes('watch') || cat.includes('wallet') ||
    cat.includes('holder')
  ) {
    return true;
  }

  // Name matches for genuine accessory items
  return (
    name.includes('wallet') || name.includes('belt') || name.includes('sunglass') ||
    name.includes('eyewear') || name.includes('goggle') || name.includes('watch') ||
    name.includes('wristwatch') || name.includes('cap') || name.includes('hat') ||
    name.includes('backpack') || name.includes('handbag') || name.includes('clutch') ||
    name.includes('purse') || name.includes('sling bag') || name.includes('tote bag') ||
    name.includes('jewel') || name.includes('earring') || name.includes('necklace') ||
    name.includes('bracelet') || name.includes('holder') || name.includes('mount')
  );
}

export function isHomeLivingProduct(p: Product): boolean {
  const cat = (p.cat || '').toLowerCase();
  const name = (p.name || '').toLowerCase();
  if (cat.includes('home') || cat.includes('kitchen')) return true;
  return (
    name.includes('bottle') || name.includes('flask') || name.includes('sipper') ||
    name.includes('kitchen') || name.includes('cookware') || name.includes('bedsheet') ||
    name.includes('curtain') || name.includes('cushion') || name.includes('decor') ||
    name.includes('organizer') || name.includes('clock')
  );
}

/**
 * Evaluates whether a product qualifies as a New Arrival based on publication/added dates.
 * Products added within the last 30 days qualify as New Arrivals.
 */
export function isNewProduct(p: Product): boolean {
  const dateStr = p.createdAt || p.updatedAt;
  if (dateStr) {
    const timestamp = new Date(dateStr).getTime();
    if (!isNaN(timestamp)) {
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      return (Date.now() - timestamp) <= thirtyDaysMs;
    }
  }
  if (p.added && typeof p.added === 'number') {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    if (p.added > 1700000000000) {
      return (now - p.added) <= thirtyDaysMs;
    }
  }
  return false;
}

// ============================================================================
// Multi-Category Selection & Suggestion System
// ============================================================================

export interface AdminCategoryOption {
  slug: string;
  name: string;
  desc: string;
  description?: string;
}

export const ADMIN_CATEGORY_OPTIONS: AdminCategoryOption[] = [
  { slug: 'all', name: 'All Products', desc: 'Main curated catalogue' },
  { slug: 'women', name: "Women's Fashion", desc: 'Sarees, kurtis, dresses, tops & jewellery' },
  { slug: 'men', name: "Men's Fashion", desc: 'Shirts, tees, jeans, jackets & menswear' },
  { slug: 'kids', name: 'Kids & Baby', desc: 'Children’s wear, infant clothes & toys' },
  { slug: 'footwear', name: 'Footwear', desc: 'Sneakers, sandals, loafers, slides & heels' },
  { slug: 'mobiles', name: 'Electronics & Mobiles', desc: 'Smartphones, car holders & audio gadgets' },
  { slug: 'accessories', name: 'Accessories & Lifestyle', desc: 'Handbags, wallets, sunglasses, watches, belts' },
  { slug: 'home-living', name: 'Home & Living', desc: 'Kitchenware, bottles, organizers & decor' },
  { slug: 'new', name: 'New Arrivals', desc: 'Latest catalogue drops & fresh additions' },
];

/**
 * Automatically suggests relevant storefront category slugs based on available product metadata
 * (name, category, brand, description).
 */
export function suggestProductCategories(info: {
  name?: string;
  cat?: string;
  brand?: string;
  desc?: string;
  price?: number;
}): string[] {
  const selected = new Set<string>();
  selected.add('all'); // All products belong to All Products by default

  const dummy: Product = {
    id: '',
    slug: '',
    name: info.name || '',
    brand: info.brand || '',
    cat: info.cat || '',
    price: info.price || 0,
    col: '',
    sizes: [],
    ret: '',
    desc: info.desc || '',
    published: true,
    added: Date.now()
  };

  if (isWomenProduct(dummy)) {
    selected.add('women');
  }
  if (isMenProduct(dummy)) {
    selected.add('men');
  }
  if (isKidsProduct(dummy)) {
    selected.add('kids');
  }
  if (isFootwearProduct(dummy)) {
    selected.add('footwear');
  }
  if (isElectronicsProduct(dummy)) {
    selected.add('mobiles');
  }
  if (isAccessoriesProduct(dummy)) {
    selected.add('accessories');
  }
  if (isHomeLivingProduct(dummy)) {
    selected.add('home-living');
  }

  return Array.from(selected);
}

/**
 * Authoritative category collection filter:
 * 1. If administrator has saved explicit category assignments (`p.categories`), uses them.
 * 2. If `p.categories` is absent/empty (legacy Firestore records), falls back to heuristic matchers.
 */
export function isProductInCategory(p: Product, categorySlug: string): boolean {
  if (categorySlug === 'all') {
    return !p.categories || p.categories.length === 0 || p.categories.includes('all');
  }

  // Authoritative check if administrator saved specific category assignments
  if (Array.isArray(p.categories) && p.categories.length > 0) {
    if (categorySlug === 'mobiles' && (p.categories.includes('mobiles') || p.categories.includes('electronics'))) {
      return true;
    }
    if (categorySlug === 'electronics' && (p.categories.includes('electronics') || p.categories.includes('mobiles'))) {
      return true;
    }
    return p.categories.includes(categorySlug);
  }

  // Backward compatibility fallback for legacy products
  if (categorySlug === 'women') return isWomenProduct(p);
  if (categorySlug === 'men') return isMenProduct(p);
  if (categorySlug === 'kids') return isKidsProduct(p);
  if (categorySlug === 'footwear') return isFootwearProduct(p);
  if (categorySlug === 'mobiles' || categorySlug === 'electronics') return isElectronicsProduct(p);
  if (categorySlug === 'accessories') return isAccessoriesProduct(p);
  if (categorySlug === 'home-living') return isHomeLivingProduct(p);
  if (categorySlug === 'new') return isNewProduct(p);

  return true;
}

/**
 * Validates whether a given URL is a valid, supported product video link.
 * Initially supports Instagram Reel and video links.
 * Returns false if url is missing, empty, malformed, or not a supported Instagram video link.
 */
export function isValidProductVideoUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    const isInstagram = hostname === 'instagram.com' || hostname.endsWith('.instagram.com');
    if (!isInstagram) return false;

    const path = parsed.pathname.trim();
    return /^\/(?:reel|reels|p|share\/reel|tv)\/[a-zA-Z0-9_\-\.]+/i.test(path);
  } catch {
    return false;
  }
}


