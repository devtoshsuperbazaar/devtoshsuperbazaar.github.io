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
    title: 'Women’s Collection — Sarees, Kurtis & Dresses | Devtosh SuperBazaar',
    description: 'Explore elegant Banarasi sarees, pure cotton kurtis, party dresses, and designer jewellery handpicked for elegance.',
    badge: 'Ethnic & Western'
  },
  {
    key: 'men',
    slug: 'men',
    name: 'Men’s Collection',
    h1: 'Men’s Casuals & Tailored Essentials',
    title: 'Men’s Collection — Shirts, Tees, Jeans & Trousers | Devtosh SuperBazaar',
    description: 'Everyday oxford shirts, heavyweight graphic tees, stone-wash stretch jeans, and utility cargo trousers.',
    badge: 'Menswear'
  },
  {
    key: 'kids',
    slug: 'kids',
    name: 'Kids & Baby',
    h1: 'Kids & Baby Clothing & Essentials',
    title: 'Kids & Baby — Comfortable Clothing & Play Sets | Devtosh SuperBazaar',
    description: 'Pure cotton t-shirts, denim shorts sets, festive flare frocks, and comfortable daily wear for boys and girls.',
    badge: 'Kids & Baby'
  },
  {
    key: 'footwear',
    slug: 'footwear',
    name: 'Footwear Collection',
    h1: 'Footwear — Sneakers, Loafers & Sandals',
    title: 'Footwear Collection — Sneakers, Loafers & Sandals | Devtosh SuperBazaar',
    description: 'Everyday canvas sneakers, memory foam slip-on loafers, and orthopedic comfort ethnic sandals.',
    badge: 'Footwear'
  },
  {
    key: 'mobiles',
    slug: 'mobiles',
    name: 'Electronics & Mobiles',
    h1: 'Electronics, Smartphones & Mobile Holders',
    title: 'Electronics & Mobiles — Car Mounts, Stands & Audio | Devtosh SuperBazaar',
    description: '360° rotating car mobile holders, aluminium desktop stands, wireless earbuds, and Bluetooth calling smartwatches.',
    badge: 'Mobiles & Tech'
  },
  {
    key: 'electronics',
    slug: 'electronics',
    name: 'Electronics & Gadgets',
    h1: 'Electronics, Gadgets & Audio Accessories',
    title: 'Electronics & Gadgets — Audio, Wearables & Accessories | Devtosh SuperBazaar',
    description: 'Wireless earbuds, smartwatches, fast charging accessories, and audio gadgets curated from verified merchants.',
    badge: 'Tech & Gadgets'
  },
  {
    key: 'accessories',
    slug: 'accessories',
    name: 'Accessories & Lifestyle',
    h1: 'Accessories & Lifestyle Essentials',
    title: 'Accessories & Lifestyle — Polarised Sunglasses & RFID Wallets | Devtosh SuperBazaar',
    description: 'TAC polarised UV400 sunglasses, genuine leather RFID slim bifold wallets, caps, belts, and daily essentials.',
    badge: 'Accessories'
  },
  {
    key: 'home-living',
    slug: 'home-living',
    name: 'Home & Living',
    h1: 'Home & Living Essentials',
    title: 'Home & Living — Insulated Flasks & Kitchen Utilities | Devtosh SuperBazaar',
    description: 'Stainless steel double-walled insulated vacuum flasks, kitchen organizers, and everyday home essentials.',
    badge: 'Home & Living'
  },
  {
    key: 'new',
    slug: 'new',
    name: 'New Arrivals',
    h1: 'New In: Latest Drops & Fresh Finds',
    title: 'New Arrivals — Trending Styles & Latest Catalog Drops | Devtosh SuperBazaar',
    description: 'The freshest curated fashion, mobile tech, and footwear additions curated across merchant partner platforms.',
    badge: 'Fresh Drops'
  }
];

export const DEMO_PRODUCTS: Product[] = [];

// Department and Category matchers
export function isElectronicsProduct(p: Product): boolean {
  const t = `${p.cat || ''} ${p.name || ''} ${p.desc || ''}`.toLowerCase();
  return t.includes('holder') || t.includes('mount') || t.includes('stand') ||
         t.includes('mobile') || t.includes('smartphone') || t.includes('phone') ||
         t.includes('earbud') || t.includes('earphone') || t.includes('headphone') ||
         t.includes('neckband') || t.includes('smartwatch') || t.includes('smart watch') ||
         t.includes('charger') || t.includes('power bank') || t.includes('data cable') ||
         t.includes('usb') || t.includes('speaker') || t.includes('bluetooth') ||
         t.includes('gadget') || (p.cat || '').toLowerCase().includes('electronic');
}

export function isFootwearProduct(p: Product): boolean {
  const t = `${p.cat || ''} ${p.name || ''}`.toLowerCase();
  if (
    t.includes('holder') || t.includes('mount') || t.includes('stand') ||
    t.includes('mobile') || t.includes('phone') || t.includes('earbud') ||
    t.includes('smartwatch') || t.includes('charger') || t.includes('cable') ||
    t.includes('bottle')
  ) {
    return false;
  }
  return t.includes('shoe') || t.includes('sneaker') || t.includes('loafer') ||
         t.includes('boot') || t.includes('sandal') || t.includes('slipper') ||
         t.includes('slide') || t.includes('croc') || t.includes('heel') ||
         t.includes('flat') || t.includes('chappal') || (p.cat || '').toLowerCase().includes('footwear');
}

export function isWomenProduct(p: Product): boolean {
  if (isKidsProduct(p)) return false;
  const t = `${p.cat || ''} ${p.name || ''} ${p.desc || ''}`.toLowerCase();
  if (t.includes('holder') || t.includes('mount') || t.includes('smartphone')) return false;
  return t.includes('saree') || t.includes('sari') || t.includes('kurti') ||
         t.includes('lehenga') || t.includes('dress') || t.includes('gown') ||
         t.includes('anarkali') || t.includes('dupatta') ||
         t.includes('women') || t.includes('ladies') || t.includes('jewel') ||
         t.includes('handbag') || t.includes('clutch') || t.includes('blouse') ||
         t.includes('salwar') || t.includes('palazzo') || (p.cat || '').toLowerCase().includes('women');
}

export function isKidsProduct(p: Product): boolean {
  const t = `${p.cat || ''} ${p.name || ''} ${p.desc || ''}`.toLowerCase();
  if (t.includes('holder') || t.includes('mount')) return false;
  return t.includes('kid') || t.includes('baby') || t.includes('infant') ||
         t.includes('toddler') || t.includes('boy') || t.includes('girl') ||
         t.includes('romper') || t.includes('toy') || t.includes('school bag') ||
         (p.cat || '').toLowerCase().includes('kid');
}

export function isAccessoriesProduct(p: Product): boolean {
  const t = `${p.cat || ''} ${p.name || ''} ${p.desc || ''}`.toLowerCase();
  return t.includes('holder') || t.includes('mount') || t.includes('stand') ||
         t.includes('sunglass') || t.includes('eyewear') || t.includes('watch') ||
         t.includes('belt') || t.includes('wallet') || t.includes('cap') ||
         t.includes('hat') || t.includes('bag') || t.includes('backpack') ||
         t.includes('jewel') || (p.cat || '').toLowerCase().includes('access');
}

export function isHomeLivingProduct(p: Product): boolean {
  const t = `${p.cat || ''} ${p.name || ''} ${p.desc || ''}`.toLowerCase();
  return t.includes('kitchen') || t.includes('bottle') || t.includes('flask') ||
         t.includes('sipper') || t.includes('bedsheet') || t.includes('curtain') ||
         t.includes('cushion') || t.includes('decor') || t.includes('organizer') ||
         t.includes('clock') || t.includes('cookware') || (p.cat || '').toLowerCase().includes('home');
}

export function isMenProduct(p: Product): boolean {
  const t = `${p.cat || ''} ${p.name || ''} ${p.desc || ''}`.toLowerCase();
  if (isWomenProduct(p) || isKidsProduct(p)) return false;
  if (t.includes('holder') || t.includes('mount') || t.includes('phone') || t.includes('bottle')) return false;
  return t.includes('shirt') || t.includes('tshirt') || t.includes('t-shirt') ||
         t.includes('tee') || t.includes('jean') || t.includes('denim') ||
         t.includes('trouser') || t.includes('chino') || t.includes('cargo') ||
         t.includes('jacket') || t.includes('blazer') || t.includes('men') ||
         t.includes('menswear') || t.includes('kurta');
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
    // Support /reel/<id>, /reels/<id>, /p/<id>, /share/reel/<id>, /tv/<id> with a non-empty identifier
    return /^\/(?:reel|reels|p|share\/reel|tv)\/[a-zA-Z0-9_\-\.]+/i.test(path);
  } catch {
    return false;
  }
}

