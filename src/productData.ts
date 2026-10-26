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
  retUrl?: string;
  affUrl?: string;
  imgUrl?: string;
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

export const DEMO_PRODUCTS: Product[] = [
  // 1. Electronics & Mobile Accessories (Mobile Holders, Mounts, Earbuds, Smartwatch)
  {
    id: 'dsb-e1',
    slug: '360-rotating-car-dashboard-mobile-holder',
    name: '360° Rotating Car Dashboard & Windshield Mobile Holder',
    brand: 'GripPro Tech',
    cat: 'Mobile Holders & Mounts',
    price: 279,
    mrp: 699,
    currency: 'INR',
    col: 'Black',
    sizes: ['Universal Fit'],
    ret: 'Meesho',
    added: 24,
    sh: 'phone',
    tint: '#E8E3DF',
    g: '#2E2A2B',
    desc: 'High-suction dashboard & windshield phone mount with 360-degree ball joint, quick release, and anti-slip silicone padding. Compatible with all smartphones.',
    published: true,
    featured: true,
    isDemo: true
  },
  {
    id: 'dsb-e2',
    slug: 'foldable-aluminium-desktop-mobile-stand',
    name: 'Foldable Aluminium Desktop Cell Phone Stand & Tablet Mount',
    brand: 'MetalGrip',
    cat: 'Mobile Holders & Mounts',
    price: 199,
    mrp: 499,
    currency: 'INR',
    col: 'Silver',
    sizes: ['Standard'],
    ret: 'Meesho',
    added: 23,
    sh: 'phone',
    tint: '#E4DDD3',
    g: '#7A7F82',
    desc: 'Solid aluminium alloy desktop phone holder with charging cable pass-through hole, dual-axis folding, and anti-scratch rubber pads.',
    published: true,
    featured: true,
    isDemo: true
  },
  {
    id: 'dsb-e3',
    slug: 'true-wireless-stereo-earbuds',
    name: 'True Wireless Stereo Bluetooth 5.3 Earbuds with LED Display',
    brand: 'SonicPro Audio',
    cat: 'Electronics & Mobiles',
    price: 649,
    mrp: 1899,
    currency: 'INR',
    col: 'Black',
    sizes: ['Universal'],
    ret: 'Meesho',
    added: 22,
    sh: 'phone',
    tint: '#DDE0D6',
    g: '#2E2A2B',
    desc: 'Deep bass wireless earbuds with 35-hour playtime, smart touch controls, digital battery indicator, and IPX5 splash resistance.',
    published: true,
    isDemo: true
  },
  {
    id: 'dsb-e4',
    slug: 'smart-watch-with-bluetooth-calling',
    name: 'Smart Watch with 1.83" HD Display & Bluetooth Calling',
    brand: 'PulseTrack',
    cat: 'Electronics & Mobiles',
    price: 1199,
    mrp: 2999,
    currency: 'INR',
    col: 'Black',
    sizes: ['Standard'],
    ret: 'Meesho',
    added: 21,
    sh: 'phone',
    tint: '#EFE5DF',
    g: '#59363A',
    desc: 'Bluetooth calling smartwatch with voice assistant, 100+ sports modes, SpO2 & heart rate monitoring, and 7-day battery life.',
    published: true,
    isDemo: true
  },

  // 2. Women's Fashion (Saree, Kurti, Dress, Jewellery)
  {
    id: 'dsb-w1',
    slug: 'banarasi-soft-silk-zari-woven-saree',
    name: 'Banarasi Soft Silk Zari Woven Saree with Blouse Piece',
    brand: 'Varanasi Weaves',
    cat: 'Sarees & Ethnic Wear',
    price: 899,
    mrp: 2499,
    currency: 'INR',
    col: 'Maroon',
    sizes: ['Free Size (5.5m + 0.8m)'],
    ret: 'Meesho',
    added: 20,
    sh: 'dress',
    tint: '#EADFD8',
    g: '#865356',
    desc: 'Luxurious Banarasi art silk saree adorned with rich golden zari borders and matching unstitched jacquard blouse piece.',
    published: true,
    featured: true,
    isDemo: true
  },
  {
    id: 'dsb-w2',
    slug: 'pure-cotton-printed-anarkali-kurti-pant-set',
    name: 'Pure Cotton Printed Anarkali Kurti with Trousers & Dupatta',
    brand: 'Jaipur Prints',
    cat: 'Kurtis & Suits',
    price: 649,
    mrp: 1499,
    currency: 'INR',
    col: 'Mustard',
    sizes: ['M', 'L', 'XL', 'XXL'],
    ret: 'Meesho',
    added: 19,
    sh: 'dress',
    tint: '#EADFCF',
    g: '#B9A58A',
    desc: 'Breathable 100% cotton 3-piece ethnic suit set featuring floral block print, round neck, and matching straight-fit pants.',
    published: true,
    isDemo: true
  },
  {
    id: 'dsb-w3',
    slug: 'tiered-floral-flared-maxi-dress',
    name: 'Tiered Floral Flared Midi Dress with Belt',
    brand: 'Studio Blush',
    cat: 'Dresses & Gowns',
    price: 749,
    mrp: 1599,
    currency: 'INR',
    col: 'Rose pink',
    sizes: ['S', 'M', 'L', 'XL'],
    ret: 'Meesho',
    added: 18,
    sh: 'dress',
    tint: '#EFE5DF',
    g: '#D49A9C',
    desc: 'Lightweight flowy georgette tiered dress with tie-up waist belt and subtle puff sleeves. Perfect for casual outings and parties.',
    published: true,
    isDemo: true
  },
  {
    id: 'dsb-w4',
    slug: 'gold-plated-kundan-pearl-choker-set',
    name: 'Gold-Plated Traditional Kundan & Pearl Choker Jewellery Set',
    brand: 'Heritage Gems',
    cat: 'Fashion Jewellery',
    price: 349,
    mrp: 999,
    currency: 'INR',
    col: 'Gold',
    sizes: ['Adjustable'],
    ret: 'Meesho',
    added: 17,
    sh: 'bag',
    tint: '#EADFCF',
    g: '#C5A059',
    desc: 'Handcrafted bridal & festive choker necklace with matching drop earrings and maang tikka.',
    published: true,
    isDemo: true
  },

  // 3. Kids & Baby
  {
    id: 'dsb-k1',
    slug: 'boys-cotton-printed-tshirt-denim-shorts-set',
    name: 'Boys Pure Cotton Graphic T-Shirt & Denim Shorts Set',
    brand: 'Little Stars',
    cat: 'Kids & Toys',
    price: 429,
    mrp: 899,
    currency: 'INR',
    col: 'Navy',
    sizes: ['2-3Y', '3-4Y', '4-5Y', '5-6Y'],
    ret: 'Meesho',
    added: 16,
    sh: 'tee',
    tint: '#E7D8D2',
    g: '#56657C',
    desc: 'Soft and breathable cotton t-shirt with soft-elastic waist denim shorts designed for all-day playtime comfort.',
    published: true,
    isDemo: true
  },
  {
    id: 'dsb-k2',
    slug: 'girls-festive-floral-fluffy-frock',
    name: 'Girls Festive Net Fluffy Party Frock with Headband',
    brand: 'Angel Kids',
    cat: 'Kids & Toys',
    price: 499,
    mrp: 1199,
    currency: 'INR',
    col: 'Peach',
    sizes: ['1-2Y', '2-3Y', '3-4Y', '4-5Y'],
    ret: 'Meesho',
    added: 15,
    sh: 'dress',
    tint: '#DFCFCB',
    g: '#E6A89B',
    desc: 'Multi-layer flare party frock with glitter floral appliqué and soft cotton inner lining for sensitive skin.',
    published: true,
    isDemo: true
  },

  // 4. Footwear
  {
    id: 'dsb-f1',
    slug: 'low-top-canvas-sneakers',
    name: 'Low-Top Canvas Everyday Sneakers',
    brand: 'UrbanStride',
    cat: 'Footwear',
    price: 849,
    mrp: 1699,
    currency: 'INR',
    col: 'White',
    sizes: ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10'],
    ret: 'Meesho',
    added: 14,
    sh: 'shoe',
    tint: '#DFCFCB',
    g: '#EDE7E0',
    desc: 'Breathable canvas upper with vulcanized rubber sole and cushioned insoles for everyday walks.',
    published: true,
    isDemo: true
  },
  {
    id: 'dsb-f2',
    slug: 'mens-slip-on-cushioned-loafers',
    name: 'Men’s Slip-On Cushioned Casual Loafers',
    brand: 'ComfortWalk',
    cat: 'Footwear',
    price: 749,
    mrp: 1499,
    currency: 'INR',
    col: 'Tan brown',
    sizes: ['UK 7', 'UK 8', 'UK 9', 'UK 10'],
    ret: 'Meesho',
    added: 13,
    sh: 'shoe',
    tint: '#EADFCF',
    g: '#8E5B3C',
    desc: 'Feather-light slip-on shoes with memory foam footbed and anti-skid TPR sole.',
    published: true,
    isDemo: true
  },
  {
    id: 'dsb-f3',
    slug: 'womens-ortho-comfort-ethnic-sandals',
    name: 'Women’s Ortho Comfort Flat Ethnic Sandals',
    brand: 'SoleGrace',
    cat: 'Footwear',
    price: 399,
    mrp: 849,
    currency: 'INR',
    col: 'Gold',
    sizes: ['IND-4', 'IND-5', 'IND-6', 'IND-7'],
    ret: 'Meesho',
    added: 12,
    sh: 'shoe',
    tint: '#E4DDD3',
    g: '#C5A059',
    desc: 'Soft padded footbed with braided metallic straps. Complements kurtis, sarees, and casual dresses.',
    published: true,
    isDemo: true
  },

  // 5. Men's Fashion (Shirts, T-shirts, Jeans, Trousers, Jackets)
  {
    id: 'dsb-m1',
    slug: 'relaxed-fit-oxford-shirt',
    name: 'Relaxed-Fit 100% Cotton Oxford Shirt',
    brand: 'Devtosh Classic',
    cat: 'Shirts',
    price: 799,
    mrp: 1499,
    currency: 'INR',
    col: 'Sky blue',
    sizes: ['S', 'M', 'L', 'XL'],
    ret: 'Meesho',
    added: 11,
    sh: 'shirt',
    tint: '#EADFD8',
    g: '#9DB7CF',
    desc: 'Button-down collar, tailored relaxed fit, premium breathable oxford weave.',
    published: true,
    isDemo: true
  },
  {
    id: 'dsb-m2',
    slug: 'oversized-heavyweight-tee',
    name: 'Heavyweight 240 GSM Oversized Graphic Tee',
    brand: 'StreetVibe',
    cat: 'T-Shirts',
    price: 499,
    mrp: 999,
    currency: 'INR',
    col: 'Black',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    ret: 'Meesho',
    added: 10,
    sh: 'tee',
    tint: '#EFE5DF',
    g: '#2E2A2B',
    desc: 'Boxy drop-shoulder cut crafted in combed bio-washed cotton.',
    published: true,
    isDemo: true
  },
  {
    id: 'dsb-m3',
    slug: 'straight-fit-stone-wash-jeans',
    name: 'Straight-Fit Stretch Stone-Wash Jeans',
    brand: 'BlueDenim Co',
    cat: 'Jeans',
    price: 999,
    mrp: 1999,
    currency: 'INR',
    col: 'Navy',
    sizes: ['30', '32', '34', '36'],
    ret: 'Meesho',
    added: 9,
    sh: 'jns',
    tint: '#E7D8D2',
    g: '#56657C',
    desc: 'Classic five-pocket jeans with stretch comfort, mid rise, and durable stone-wash treatment.',
    published: true,
    isDemo: true
  },
  {
    id: 'dsb-m4',
    slug: 'tapered-stretch-cargo-trousers',
    name: 'Tapered Utility Cargo Trousers with Multi Pockets',
    brand: 'UrbanCraft',
    cat: 'Trousers',
    price: 899,
    mrp: 1799,
    currency: 'INR',
    col: 'Olive',
    sizes: ['30', '32', '34', '36'],
    ret: 'Meesho',
    added: 8,
    sh: 'jns',
    tint: '#DDE0D6',
    g: '#6B6F4B',
    desc: 'Durable stretch cotton twill with deep cargo utility pockets and ankle cuff tailoring.',
    published: true,
    isDemo: true
  },

  // 6. Accessories & Lifestyle (Caps, Belts, Sunglasses, Wallets)
  {
    id: 'dsb-a1',
    slug: 'retro-polarised-sunglasses',
    name: 'Retro Square Polarised UV400 Sunglasses',
    brand: 'OpticShade',
    cat: 'Sunglasses',
    price: 299,
    mrp: 799,
    currency: 'INR',
    col: 'Black',
    sizes: ['Standard'],
    ret: 'Meesho',
    added: 7,
    sh: 'bag',
    tint: '#E4DDD3',
    g: '#2E2A2B',
    desc: 'Lightweight scratch-resistant TAC polarised lenses offering complete UV400 sun protection.',
    published: true,
    isDemo: true
  },
  {
    id: 'dsb-a2',
    slug: 'genuine-leather-bifold-wallet',
    name: 'Genuine Leather RFID-Protected Slim Bifold Wallet',
    brand: 'Devtosh Leather',
    cat: 'Wallets',
    price: 349,
    mrp: 899,
    currency: 'INR',
    col: 'Dark Brown',
    sizes: ['Standard'],
    ret: 'Meesho',
    added: 6,
    sh: 'bag',
    tint: '#EADFCF',
    g: '#5C3826',
    desc: 'Handcrafted top-grain leather wallet with 8 card slots, currency divider, and coin pocket.',
    published: true,
    isDemo: true
  },

  // 7. Home & Kitchen
  {
    id: 'dsb-h1',
    slug: 'stainless-steel-insulated-vacuum-flask',
    name: '1000ml Stainless Steel Double-Walled Insulated Flask Bottle',
    brand: 'ThermoPure',
    cat: 'Home & Kitchen',
    price: 399,
    mrp: 899,
    currency: 'INR',
    col: 'Black',
    sizes: ['1000 ml'],
    ret: 'Meesho',
    added: 5,
    sh: 'bag',
    tint: '#D9DDE0',
    g: '#302729',
    desc: 'Grade 304 food-safe stainless steel vacuum bottle that maintains temperature hot or cold for 24 hours.',
    published: true,
    isDemo: true
  }
];

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
  const t = `${p.cat || ''} ${p.name || ''} ${p.desc || ''}`.toLowerCase();
  if (t.includes('holder') || t.includes('mount') || t.includes('smartphone')) return false;
  return t.includes('saree') || t.includes('sari') || t.includes('kurti') ||
         t.includes('lehenga') || t.includes('dress') || t.includes('gown') ||
         t.includes('frock') || t.includes('anarkali') || t.includes('dupatta') ||
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
