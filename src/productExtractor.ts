import { generateSafeProductSlug } from './productData';

/**
 * Product Extractor for Devtosh SuperBazaar
 * Specialized for Meesho and universal fashion retailers
 */

export interface ExtractedProduct {
  name: string;
  slug: string;
  brand: string;
  cat: string;
  subcat?: string;
  price: number;
  mrp?: number;
  currency: string;
  col: string;
  sizes: string[];
  desc: string;
  imgUrl: string;
  ret: string;
  retUrl: string;
  affUrl?: string;
  rawText?: string;
  source: 'meesho' | 'url' | 'text' | 'combined';
  isAffiliate?: boolean;
  requiresDirectUrl?: boolean;
  blocked?: boolean;
  resolvedDestination?: string;
  extId?: string;
  productId?: string;
}

export function isAlphanumericId(token: string): boolean {
  if (!token) return false;
  const s = token.trim();
  if (s.includes(' ')) return false;
  // Tokens like fvv0k9, 1kv4b, B08N5WRWNW, itmd0da018445c04, ext_id
  if (/^[a-zA-Z0-9_-]{3,30}$/.test(s)) {
    if (!/[aeiouAEIOU]/.test(s) || /^[a-z0-9]{4,15}$/.test(s) || /^[a-zA-Z]{1,4}[0-9]{1,6}[a-zA-Z0-9]*$/.test(s)) {
      return true;
    }
  }
  return false;
}

export function isForbiddenBrand(str: string): boolean {
  if (!str) return true;
  const s = str.trim().toLowerCase();
  return (
    s === 'https' ||
    s === 'http' ||
    s === 'www' ||
    s === 'com' ||
    s === 'in' ||
    s === 'net' ||
    s === 'org' ||
    s === 'item' ||
    s === 'product' ||
    s === 'null' ||
    s === 'undefined' ||
    s.includes('.') ||
    s.includes('/') ||
    s.includes(':') ||
    s === 'meesho' ||
    s === 'amazon' ||
    s === 'flipkart' ||
    s === 'myntra' ||
    s === 'ajio'
  );
}

export function classifyCategory(text: string): string {
  const t = (text || '').toLowerCase();
  
  // 1. Mobile Holders & Phone Mounts (High priority check so they are never misclassified as footwear/shirts)
  if (
    t.includes('holder') || t.includes('mount') || t.includes('stand') ||
    t.includes('phone stand') || t.includes('mobile stand') || t.includes('car mount') ||
    t.includes('bike mount') || t.includes('tripod') || t.includes('ring light')
  ) {
    return 'Mobile Holders & Mounts';
  }

  // 2. Electronics & Mobile Accessories
  if (
    t.includes('smartphone') || t.includes('mobile phone') || t.includes('iphone') ||
    t.includes('android') || t.includes('earbud') || t.includes('earphone') ||
    t.includes('headphone') || t.includes('neckband') || t.includes('smartwatch') ||
    t.includes('smart watch') || t.includes('charger') || t.includes('power bank') ||
    t.includes('data cable') || t.includes('usb') || t.includes('speaker') ||
    t.includes('bluetooth') || t.includes('tempered glass') || t.includes('back cover') ||
    t.includes('phone case') || t.includes('adapter')
  ) {
    return 'Electronics & Mobiles';
  }

  // 3. Women's Fashion & Ethnic Wear
  if (t.includes('saree') || t.includes('sari') || t.includes('lehenga') || t.includes('anarkali') || t.includes('dupatta') || t.includes('salwar')) {
    return 'Sarees & Ethnic Wear';
  }
  if (t.includes('kurti') || t.includes('kurta set') || t.includes('tunic')) {
    return 'Kurtis & Suits';
  }
  if (t.includes('dress') || t.includes('gown') || t.includes('maxi') || t.includes('frock')) {
    return 'Dresses & Gowns';
  }
  if (t.includes('women top') || t.includes('crop top') || t.includes('blouse') || t.includes('ladies top')) {
    return 'Women’s Tops';
  }
  if (t.includes('jewel') || t.includes('earring') || t.includes('necklace') || t.includes('bangle') || t.includes('mangalsutra')) {
    return 'Fashion Jewellery';
  }
  if (t.includes('handbag') || t.includes('clutch') || t.includes('sling bag') || t.includes('tote bag')) {
    return 'Handbags & Clutches';
  }

  // 4. Kids & Baby Products
  if (
    t.includes('kid') || t.includes('baby') || t.includes('infant') ||
    t.includes('boy') || t.includes('girl') || t.includes('toddler') ||
    t.includes('romper') || t.includes('toy') || t.includes('school bag')
  ) {
    return 'Kids & Toys';
  }

  // 5. Footwear (strictly shoes/sandals, mobile holders prevented above)
  if (
    t.includes('shoe') || t.includes('sneaker') || t.includes('loafer') ||
    t.includes('boot') || t.includes('sandal') || t.includes('slipper') ||
    t.includes('slide') || t.includes('croc') || t.includes('heel') ||
    t.includes('flat') || t.includes('chappal') || t.includes('footwear')
  ) {
    return 'Footwear';
  }

  // 6. Home & Kitchen Essentials
  if (
    t.includes('bottle') || t.includes('flask') || t.includes('sipper') ||
    t.includes('kitchen') || t.includes('cookware') || t.includes('knife') ||
    t.includes('lunch box') || t.includes('bedsheet') || t.includes('curtain') ||
    t.includes('cushion') || t.includes('clock') || t.includes('decor') ||
    t.includes('organizer')
  ) {
    return 'Home & Kitchen';
  }

  // 7. Men's Fashion
  if (t.includes('t-shirt') || t.includes('tshirt') || t.includes(' tee') || t.includes('polo')) return 'T-Shirts';
  if (t.includes('shirt')) return 'Shirts';
  if (t.includes('jean') || t.includes('denim')) return 'Jeans';
  if (t.includes('trouser') || t.includes('chino') || t.includes('pant') || t.includes('cargo') || t.includes('jogger')) return 'Trousers';
  if (t.includes('jacket') || t.includes('blazer') || t.includes('coat') || t.includes('bomber') || t.includes('windcheater')) return 'Jackets';
  if (t.includes('hoodie') || t.includes('sweatshirt') || t.includes('sweater') || t.includes('cardigan')) return 'Winterwear';
  if (t.includes('kurta') || t.includes('sherwani') || t.includes('ethnic') || t.includes('pyjama')) return 'Ethnic Wear';

  // 8. General Accessories
  if (t.includes('sunglass') || t.includes('eyewear') || t.includes('goggle')) return 'Sunglasses';
  if (t.includes('watch') || t.includes('wristwatch')) return 'Watches';
  if (t.includes('wallet') || t.includes('belt') || t.includes('cap') || t.includes('hat') || t.includes('backpack')) return 'Accessories';

  // No fabricated category fallback: if unclassified, return empty string
  return '';
}

export function generateProductSlug(title: string): string {
  if (!title || !title.trim() || isAlphanumericId(title)) return '';
  return generateSafeProductSlug(title);
}

export function parseMeeshoUrl(rawUrl: string): Partial<ExtractedProduct> | null {
  try {
    const u = new URL(rawUrl.trim());
    if (!u.hostname.includes('meesho')) return null;

    const path = u.pathname;

    // 1. Meesho Affiliate Invite Links (e.g. /af_invite/449125188:instagram_stories:15030911?p_id=960507801&ext_id=fvv0k9)
    if (path.includes('/af_invite')) {
      const extId = u.searchParams.get('ext_id') || '';
      const pId = u.searchParams.get('p_id') || u.searchParams.get('product_id') || '';
      const directUrlGuess = extId ? `https://www.meesho.com/s/p/${extId}` : '';
      return {
        name: '',
        slug: '', // Never treat product code like meesho-fvv0k9 as slug
        brand: '', // Never fabricate brand
        cat: '',
        ret: 'Meesho',
        retUrl: directUrlGuess || rawUrl.trim(),
        affUrl: rawUrl.trim(), // Exact affiliate URL preserved
        source: 'meesho',
        isAffiliate: true,
        extId,
        productId: pId,
        resolvedDestination: directUrlGuess,
        requiresDirectUrl: true
      };
    }

    // 2. Direct Meesho Product URLs: /s/p/fvv0k9 or /product-title/p/fvv0k9
    let titleGuess = '';
    let slugGuess = '';
    let productCode = '';

    const match = path.match(/\/([^/]+)\/p\/([a-zA-Z0-9_-]+)/);
    if (match) {
      slugGuess = match[1];
      productCode = match[2];
      // Only treat slugGuess as a title if it is a genuine descriptive slug, NEVER a code or 's'
      if (slugGuess !== 's' && slugGuess !== 'products' && slugGuess.length > 2 && !isAlphanumericId(slugGuess)) {
        titleGuess = slugGuess
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())
          .trim();
      }
    } else {
      const segments = path.split('/').filter(Boolean);
      const last = segments[segments.length - 1] || '';
      if (last && last !== 'p' && !isAlphanumericId(last)) {
        titleGuess = last.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        slugGuess = last;
      }
    }

    const cat = titleGuess ? classifyCategory(titleGuess) : '';
    const slug = titleGuess ? generateSafeProductSlug(titleGuess) : '';

    return {
      name: titleGuess,
      slug,
      brand: '', // Unverified brand left empty
      cat,
      ret: 'Meesho',
      retUrl: u.origin + u.pathname,
      affUrl: rawUrl.trim(),
      source: 'meesho',
      isAffiliate: false,
      productId: productCode
    };
  } catch {
    return null;
  }
}

export function parseAmazonUrl(rawUrl: string): Partial<ExtractedProduct> | null {
  try {
    const u = new URL(rawUrl.trim());
    if (!u.hostname.includes('amazon') && !u.hostname.includes('amzn')) return null;

    let asin = '';
    let titleGuess = '';

    const asinMatch = u.pathname.match(/\/(?:dp|gp\/product)\/([a-zA-Z0-9]{10})/i);
    if (asinMatch) asin = asinMatch[1];

    const slugMatch = u.pathname.match(/\/([^/]+)\/(?:dp|gp\/product)/i);
    if (slugMatch && slugMatch[1] && slugMatch[1] !== 'gp' && slugMatch[1] !== 'dp' && !isAlphanumericId(slugMatch[1])) {
      titleGuess = slugMatch[1]
        .replace(/[-_+]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
    }

    if (isAlphanumericId(titleGuess)) titleGuess = '';
    const cat = titleGuess ? classifyCategory(titleGuess) : '';
    const slug = titleGuess ? generateSafeProductSlug(titleGuess) : '';
    const retUrl = asin ? `https://www.amazon.in/dp/${asin}` : (u.origin + u.pathname);

    return {
      name: titleGuess,
      slug,
      brand: '',
      cat,
      ret: 'Amazon',
      retUrl,
      source: 'url'
    };
  } catch {
    return null;
  }
}

export function parseFlipkartUrl(rawUrl: string): Partial<ExtractedProduct> | null {
  try {
    const u = new URL(rawUrl.trim());
    if (!u.hostname.includes('flipkart') && !u.hostname.includes('fkrt')) return null;

    let titleGuess = '';
    const match = u.pathname.match(/\/([^/]+)\/p\//i);
    if (match && match[1] && !isAlphanumericId(match[1])) {
      titleGuess = match[1]
        .replace(/[-_+]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
    } else {
      const segs = u.pathname.split('/').filter(Boolean);
      if (segs.length > 0 && segs[0] !== 'p' && !isAlphanumericId(segs[0])) {
        titleGuess = segs[0].replace(/[-_+]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
      }
    }

    if (isAlphanumericId(titleGuess)) titleGuess = '';
    const cat = titleGuess ? classifyCategory(titleGuess) : '';
    const slug = titleGuess ? generateSafeProductSlug(titleGuess) : '';
    const retUrl = u.origin + u.pathname;

    return {
      name: titleGuess,
      slug,
      brand: '',
      cat,
      ret: 'Flipkart',
      retUrl,
      source: 'url'
    };
  } catch {
    return null;
  }
}

export function parseMyntraUrl(rawUrl: string): Partial<ExtractedProduct> | null {
  try {
    const u = new URL(rawUrl.trim());
    if (!u.hostname.includes('myntra')) return null;

    let titleGuess = '';
    let brandGuess = '';

    const segs = u.pathname.split('/').filter(Boolean);
    if (segs.length >= 3) {
      if (!isForbiddenBrand(segs[0])) {
        brandGuess = segs[0].replace(/[-_+]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
      }
      const rawTitle = segs.slice(0, segs.length - 1).join(' ');
      if (!isAlphanumericId(rawTitle)) {
        titleGuess = rawTitle.replace(/[-_+]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
      }
    } else if (segs.length > 0 && !isAlphanumericId(segs[0])) {
      titleGuess = segs[0].replace(/[-_+]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
    }

    if (isAlphanumericId(titleGuess)) titleGuess = '';
    const cat = titleGuess ? classifyCategory(titleGuess) : '';
    const slug = titleGuess ? generateSafeProductSlug(titleGuess) : '';
    const retUrl = u.origin + u.pathname;

    return {
      name: titleGuess,
      slug,
      brand: brandGuess,
      cat,
      ret: 'Myntra',
      retUrl,
      source: 'url'
    };
  } catch {
    return null;
  }
}

export function parseAjioUrl(rawUrl: string): Partial<ExtractedProduct> | null {
  try {
    const u = new URL(rawUrl.trim());
    if (!u.hostname.includes('ajio')) return null;

    let titleGuess = '';
    const match = u.pathname.match(/\/([^/]+)\/p\//i);
    if (match && match[1] && !isAlphanumericId(match[1])) {
      titleGuess = match[1]
        .replace(/[-_+]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
    } else {
      const segs = u.pathname.split('/').filter(Boolean);
      if (segs.length > 0 && !isAlphanumericId(segs[0])) {
        titleGuess = segs[0].replace(/[-_+]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
      }
    }

    if (isAlphanumericId(titleGuess)) titleGuess = '';
    const cat = titleGuess ? classifyCategory(titleGuess) : '';
    const slug = titleGuess ? generateSafeProductSlug(titleGuess) : '';
    const retUrl = u.origin + u.pathname;

    return {
      name: titleGuess,
      slug,
      brand: '',
      cat,
      ret: 'Ajio',
      retUrl,
      source: 'url'
    };
  } catch {
    return null;
  }
}

export function parseRetailerUrl(rawUrl: string): Partial<ExtractedProduct> | null {
  return parseMeeshoUrl(rawUrl) ||
         parseAmazonUrl(rawUrl) ||
         parseFlipkartUrl(rawUrl) ||
         parseMyntraUrl(rawUrl) ||
         parseAjioUrl(rawUrl) ||
         parseGenericUrl(rawUrl);
}

export function parseProductText(text: string): Partial<ExtractedProduct> {
  const result: Partial<ExtractedProduct> = {};
  if (!text || !text.trim()) return result;

  const cleanText = text.trim();
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Name extraction
  const nameRegex = /(?:Name|Product Name|Title|Item)\s*[:\-]\s*([^\n\r]+)/i;
  const nameM = cleanText.match(nameRegex);
  if (nameM && nameM[1].trim() && !isAlphanumericId(nameM[1].trim())) {
    result.name = nameM[1].trim();
  } else if (lines.length > 0 && !lines[0].includes(':') && lines[0].length < 100) {
    const firstLine = lines[0].trim();
    if (firstLine.length > 3 && !isAlphanumericId(firstLine) && !firstLine.startsWith('http') && !isForbiddenBrand(firstLine)) {
      result.name = firstLine;
    }
  }

  // 1b. Brand extraction
  const brandRegex = /(?:Brand|Brand Name|Manufacturer|Seller)\s*[:\-]\s*([^\n\r]+)/i;
  const brandM = cleanText.match(brandRegex);
  if (brandM && brandM[1].trim()) {
    const b = brandM[1].trim();
    if (!isForbiddenBrand(b) && !isAlphanumericId(b)) {
      result.brand = b;
    }
  }

  // 2. Selling Price
  const priceRegex = /(?:Price|Selling Price|Offer Price|Deal Price|Special Price|Rs\.?|₹)\s*[:\-]?\s*₹?\s*([0-9,]+)/i;
  const priceM = cleanText.match(priceRegex);
  if (priceM) {
    const p = Number(priceM[1].replace(/,/g, ''));
    if (!isNaN(p) && p > 0) result.price = p;
  }

  // 3. MRP / Original Price
  const mrpRegex = /(?:MRP|Original Price|Strike Price|List Price|M\.R\.P\.?)\s*[:\-]?\s*₹?\s*([0-9,]+)/i;
  const mrpM = cleanText.match(mrpRegex);
  if (mrpM) {
    const m = Number(mrpM[1].replace(/,/g, ''));
    if (!isNaN(m) && m > 0) result.mrp = m;
  }

  // 4. Color / Colour
  const colRegex = /(?:Color|Colour)\s*[:\-]\s*([^\n\r]+)/i;
  const colM = cleanText.match(colRegex);
  if (colM && colM[1].trim() && !isAlphanumericId(colM[1].trim())) {
    result.col = colM[1].trim();
  }

  // 5. Sizes (Only extract when explicitly labelled as sizes to avoid capturing product codes or affiliate numbers)
  const sizeRegex = /(?:Sizes?|Available Sizes?)\s*[:\-]\s*([^\n\r]+)/i;
  const sizeM = cleanText.match(sizeRegex);
  if (sizeM && sizeM[1].trim()) {
    const rawSizes = sizeM[1].split(/[,/|]/);
    const cleaned = rawSizes
      .map(s => s.replace(/\([^)]*\)/g, '').trim())
      .filter(s => s.length > 0 && s.length <= 10 && !isAlphanumericId(s));
    if (cleaned.length > 0) result.sizes = cleaned;
  }

  // 6. Fabric / Material
  const fabricRegex = /(?:Fabric|Material)\s*[:\-]\s*([^\n\r]+)/i;
  const fabricM = cleanText.match(fabricRegex);
  const fabric = fabricM ? fabricM[1].trim() : '';

  // 7. Image URL in text
  const imgRegex = /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^\s"'<>]*)?/i;
  const meeshoImgRegex = /https?:\/\/images[a-z0-9.-]*\.meesho\.com\/[^\s"'<>]+/i;
  const imgM = cleanText.match(meeshoImgRegex) || cleanText.match(imgRegex);
  if (imgM) {
    result.imgUrl = imgM[0].trim();
  }

  // 8. Description
  const descParts: string[] = [];
  if (fabric) descParts.push(`Fabric: ${fabric}`);
  const patternM = cleanText.match(/(?:Pattern)\s*[:\-]\s*([^\n\r]+)/i);
  if (patternM) descParts.push(`Pattern: ${patternM[1].trim()}`);
  const sleeveM = cleanText.match(/(?:Sleeve Length|Sleeves)\s*[:\-]\s*([^\n\r]+)/i);
  if (sleeveM) descParts.push(`Sleeves: ${sleeveM[1].trim()}`);
  const fitM = cleanText.match(/(?:Fit|Fit\/Shape)\s*[:\-]\s*([^\n\r]+)/i);
  if (fitM) descParts.push(`Fit: ${fitM[1].trim()}`);

  if (descParts.length > 0) {
    result.desc = descParts.join(' · ');
  } else if (cleanText.length > 20 && cleanText.length < 500 && !cleanText.includes('{')) {
    result.desc = cleanText;
  }

  if (result.name) {
    result.cat = classifyCategory(result.name);
    result.slug = generateSafeProductSlug(result.name);
  }

  return result;
}

/**
 * Intelligent combined extractor that runs client-side,
 * then calls the backend /api/extract-product if available.
 * Supports Stage A (Affiliate URL) and Stage B (Direct Product URL fallback).
 */
export async function extractProductDetails(
  inputUrl: string,
  inputText: string = '',
  isDirectExtraction: boolean = false
): Promise<ExtractedProduct> {
  const url = (inputUrl || '').trim();
  const text = (inputText || '').trim();

  // 1. Initial heuristic extraction
  const urlData = url ? (parseRetailerUrl(url) || {}) : {};
  const textData = text ? parseProductText(text) : {};

  let combined: ExtractedProduct = {
    name: textData.name || urlData.name || '',
    slug: textData.slug || urlData.slug || (textData.name || urlData.name ? generateSafeProductSlug(textData.name || urlData.name!) : ''),
    brand: textData.brand || urlData.brand || '', // NEVER assign generic retailer name or 'Https'
    cat: textData.cat || urlData.cat || (textData.name || urlData.name ? classifyCategory(textData.name || urlData.name!) : ''),
    price: textData.price || urlData.price || 0,
    mrp: textData.mrp || urlData.mrp || 0,
    currency: 'INR',
    col: textData.col || urlData.col || '',
    sizes: textData.sizes && textData.sizes.length ? textData.sizes : [],
    desc: textData.desc || urlData.desc || '',
    imgUrl: textData.imgUrl || urlData.imgUrl || '',
    ret: urlData.ret || 'Partner Retailer',
    retUrl: urlData.retUrl || url || '',
    affUrl: isDirectExtraction ? '' : url,
    source: (url && text) ? 'combined' : (url ? 'url' : 'text'),
    isAffiliate: urlData.isAffiliate || false,
    requiresDirectUrl: urlData.requiresDirectUrl || false,
    extId: urlData.extId,
    productId: urlData.productId,
    resolvedDestination: urlData.resolvedDestination
  };

  // 2. Query backend server proxy endpoint for rich extraction if URL provided
  if (url) {
    try {
      const resp = await fetch('/api/extract-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, text, isDirectExtraction })
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json && json.success && json.product) {
          const s = json.product;
          combined = {
            ...combined,
            ...Object.fromEntries(
              Object.entries(s).filter(([k, v]) => {
                if (v === undefined || v === null || v === '') return false;
                if (k === 'brand' && isForbiddenBrand(String(v))) return false;
                if (k === 'name' && isAlphanumericId(String(v))) return false;
                return true;
              })
            )
          };
          if (json.resolvedUrl) {
            combined.resolvedDestination = json.resolvedUrl;
          }
          combined.requiresDirectUrl = false;
        } else if (json && json.blocked) {
          combined.blocked = true;
          combined.requiresDirectUrl = true;
        } else if (json && json.requiresDirectUrl) {
          combined.requiresDirectUrl = true;
        }
      } else {
        if (urlData.isAffiliate && !isDirectExtraction) {
          combined.requiresDirectUrl = true;
        }
      }
    } catch (e) {
      console.warn('Backend proxy extraction failed:', e);
      if (urlData.isAffiliate && !isDirectExtraction) {
        combined.requiresDirectUrl = true;
      }
    }
  }

  // Preserve the original affiliate link strictly
  if (!isDirectExtraction && url) {
    combined.affUrl = url;
  }

  // Ensure slug is derived only from genuine product name
  if (combined.name && !isAlphanumericId(combined.name)) {
    combined.slug = generateSafeProductSlug(combined.name);
  } else if (!combined.name) {
    combined.slug = '';
  }

  // Classify category only if verified name is present
  if (combined.name && !combined.cat) {
    combined.cat = classifyCategory(combined.name);
  }

  return combined;
}

function parseGenericUrl(rawUrl: string): Partial<ExtractedProduct> {
  try {
    const u = new URL(rawUrl.trim());
    const hostParts = u.hostname.replace('www.', '').split('.');
    let retailer = hostParts[0].charAt(0).toUpperCase() + hostParts[0].slice(1);
    if (isForbiddenBrand(retailer)) {
      retailer = 'Partner Retailer';
    }
    const pathSegments = u.pathname.split('/').filter(Boolean);
    const last = pathSegments[pathSegments.length - 1] || '';
    const cleanLast = last.replace(/\.html?$/, '').replace(/[-_]/g, ' ').trim();
    const title = (!isAlphanumericId(cleanLast) && cleanLast.length > 3 && cleanLast !== 'item' && !cleanLast.startsWith('http'))
      ? cleanLast.replace(/\b\w/g, c => c.toUpperCase())
      : '';
    const cat = title ? classifyCategory(title) : '';
    return {
      name: title,
      slug: title ? generateSafeProductSlug(title) : '',
      brand: '', // Never set brand to retailer or protocol
      cat,
      ret: retailer,
      retUrl: rawUrl.trim(),
      affUrl: rawUrl.trim()
    };
  } catch {
    return {};
  }
}
