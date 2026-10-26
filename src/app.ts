/**
 * Devtosh SuperBazaar — Mobile-First Admin Panel, Shared Product Catalogue and Guest Wishlist
 * Architecture: Clean TypeScript application integrating Firebase Auth, Cloud Firestore (devtoshsuperbazaar-84898),
 * and client-side editorial discovery experience.
 */

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db, testConnection, getEffectiveFirebaseConfig, saveAndApplyApiKey, testApiKeyValidity } from './firebase.ts';
import { extractProductDetails, generateProductSlug } from './productExtractor.ts';
import {
  Article,
  ArticleRelatedProduct,
  SEED_ARTICLES,
  calculateReadTime,
  formatBlogDate
} from './blogData.ts';
import {
  renderBlogIndex,
  renderArticleDetail,
  renderAdminArticles,
  renderArticleForm,
  validateArticle,
  generateArticleSlug,
  parseMarkdownToHtml
} from './blog.ts';

// --------------------------------------------------------------------------
// Product Types, Catalog Seed & Filter Helpers (imported from productData.ts)
// --------------------------------------------------------------------------
import {
  Product,
  DEMO_PRODUCTS,
  isElectronicsProduct,
  isFootwearProduct,
  isWomenProduct,
  isKidsProduct,
  isAccessoriesProduct,
  isHomeLivingProduct,
  isMenProduct,
  SITE_CATEGORIES,
  CategoryMeta
} from './productData.ts';

export type { Product, CategoryMeta };
export {
  DEMO_PRODUCTS,
  isElectronicsProduct,
  isFootwearProduct,
  isWomenProduct,
  isKidsProduct,
  isAccessoriesProduct,
  isHomeLivingProduct,
  isMenProduct,
  SITE_CATEGORIES
};

export interface Category {
  id: string;
  name: string;
  slug: string;
  subcategories: string[];
}

export interface Retailer {
  id: string;
  name: string;
  url: string;
  isAffiliate: boolean;
}

export interface SiteSettings {
  announcement: string;
  disclosure: string;
  contactHandle: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  announcement: 'Devtosh SuperBazaar — Curated fashion, mobiles, accessories, footwear and lifestyle catalogue.',
  disclosure: 'Devtosh SuperBazaar participates in affiliate partnerships and may earn a commission when you purchase through links to retailer websites at no extra cost to you.',
  contactHandle: '@devsharanyadav4'
};

const CX: Record<string, string> = {
  'Sky blue': '#9DB7CF',
  'Olive': '#6B6F4B',
  'Black': '#1F1B1C',
  'White': '#ffffff',
  'Navy': '#27364F',
  'Beige': '#D8C7AE',
  'Grey': '#8C8C8C'
};

const SZ = ['S', 'M', 'L', 'XL', 'XXL', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'Universal', 'Standard', 'Free Size'];
const PR = [[0, 299], [300, 499], [500, 999], [1000, 1e9]];
const PL = ['Up to ₹299', '₹300–₹499', '₹500–₹999', '₹1,000 and above'];

// --------------------------------------------------------------------------
// Application State
// --------------------------------------------------------------------------
export class Store {
  currentUser: User | null = null;
  isAdmin: boolean = false;
  authChecking: boolean = true;
  adminError: string = '';
  adminApiKeyError: boolean = false;
  adminSuccessMessage: string = '';

  products: Product[] = [];
  adminProducts: Product[] = [];
  settings: SiteSettings = DEFAULT_SETTINGS;
  wishlistSlugs: string[] = [];

  // Public Catalog Filter State
  filters = {
    brand: [] as string[],
    cat: [] as string[],
    size: [] as string[],
    col: [] as string[],
    price: [] as number[],
    disc: 0,
    min: 0,
    max: 0,
    sort: 'rec',
    n: 8,
    open: { brand: 1, cat: 1, price: 1 } as Record<string, number>,
    mobileFiltersOpen: false
  };

  // Admin filter and sorting state
  adminFilter = {
    q: '',
    status: 'all',
    cat: 'all',
    brand: 'all'
  };
  adminSort: string = 'newest';
  adminCloneSource: Partial<Product> | null = null;
  adminLoadingProductId: string = '';

  // Blog & Editorial Articles State
  articles: Article[] = [];
  adminArticles: Article[] = [];
  adminBlogFilter = {
    q: '',
    status: 'all',
    category: 'all'
  };
  adminBlogSort: string = 'newest';
  adminLoadingArticleId: string = '';

  constructor() {
    this.loadWishlist();
  }

  loadWishlist() {
    try {
      const stored = localStorage.getItem('wl');
      this.wishlistSlugs = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(this.wishlistSlugs)) this.wishlistSlugs = [];
    } catch {
      this.wishlistSlugs = [];
    }
  }

  saveWishlist() {
    try {
      localStorage.setItem('wl', JSON.stringify(this.wishlistSlugs));
    } catch {}
    const badge = document.querySelector('#wc');
    if (badge) badge.textContent = String(this.wishlistSlugs.length);
  }

  toggleWishlist(slug: string): boolean {
    const idx = this.wishlistSlugs.indexOf(slug);
    let added = false;
    if (idx < 0) {
      this.wishlistSlugs.push(slug);
      added = true;
    } else {
      this.wishlistSlugs.splice(idx, 1);
      added = false;
    }
    this.saveWishlist();
    return added;
  }
}

export const store = new Store();

// Article link modal selection tracking
let artLinkSelectionStart = 0;
let artLinkSelectionEnd = 0;

// --------------------------------------------------------------------------
// Utilities
// --------------------------------------------------------------------------
export function inr(n: number): string {
  return '₹' + Number(n || 0).toLocaleString('en-IN');
}

export function esc(s: unknown): string {
  return String(s || '').replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
}

export function disc(p: { price: number; mrp?: number }): number {
  if (!p || !p.mrp || p.mrp <= p.price) return 0;
  return Math.round(((p.mrp - p.price) / p.mrp) * 100);
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function announce(msg: string) {
  const el = document.getElementById('live-announcer');
  if (el) {
    el.textContent = '';
    setTimeout(() => { el.textContent = msg; }, 40);
  }
}

// --------------------------------------------------------------------------
// Firestore Sync & Data Loaders
// --------------------------------------------------------------------------
export async function loadPublicProducts() {
  try {
    const q = query(collection(db, 'products'), where('published', '==', true));
    const snapshot = await getDocs(q);
    const liveItems: Product[] = [];
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      liveItems.push({
        id: docSnap.id,
        slug: d.slug || docSnap.id,
        name: d.name || 'Untitled Product',
        brand: d.brand || 'Devtosh SuperBazaar Curated',
        cat: d.cat || 'Essentials',
        subcat: d.subcat || '',
        price: Number(d.price || 0),
        mrp: Number(d.mrp || 0),
        currency: d.currency || 'INR',
        col: d.col || 'Neutral',
        sizes: Array.isArray(d.sizes) ? d.sizes : (typeof d.sizes === 'string' ? d.sizes.split(',') : ['One size']),
        ret: d.ret || 'Partner Retailer',
        retUrl: d.retUrl || '',
        affUrl: d.affUrl || '',
        imgUrl: d.imgUrl || '',
        desc: d.desc || '',
        published: true,
        featured: !!d.featured,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        isDemo: false
      });
    });

    if (liveItems.length > 0) {
      store.products = liveItems;
    } else {
      // Seamless fallback to curated demo collection so catalog is never empty
      store.products = DEMO_PRODUCTS;
    }
  } catch (error) {
    console.warn('Cloud Firestore query failed or empty, using demo catalog fallback:', error);
    store.products = DEMO_PRODUCTS;
  }
}

export async function loadAdminProducts() {
  try {
    const snapshot = await getDocs(collection(db, 'products'));
    const items: Product[] = [];
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      items.push({
        id: docSnap.id,
        slug: d.slug || docSnap.id,
        name: d.name || 'Untitled Product',
        brand: d.brand || '',
        cat: d.cat || 'Essentials',
        subcat: d.subcat || '',
        price: Number(d.price || 0),
        mrp: Number(d.mrp || 0),
        currency: d.currency || 'INR',
        col: d.col || '',
        sizes: Array.isArray(d.sizes) ? d.sizes : (typeof d.sizes === 'string' ? d.sizes.split(',') : []),
        ret: d.ret || '',
        retUrl: d.retUrl || '',
        affUrl: d.affUrl || '',
        imgUrl: d.imgUrl || '',
        desc: d.desc || '',
        published: !!d.published,
        featured: !!d.featured,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        isDemo: false
      });
    });
    store.adminProducts = items;
  } catch (error) {
    console.warn('Error loading admin products from Firestore:', error);
    store.adminProducts = [];
  }
}

export async function loadPublicArticles() {
  try {
    const q = query(collection(db, 'articles'), where('published', '==', true));
    const snapshot = await getDocs(q);
    const liveItems: Article[] = [];
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      liveItems.push({
        id: docSnap.id,
        title: d.title || 'Untitled Article',
        slug: d.slug || docSnap.id,
        metaTitle: d.metaTitle || d.seoTitle || d.title || '',
        metaDesc: d.metaDesc || '',
        excerpt: d.excerpt || '',
        content: d.content || '',
        authorName: d.authorName || 'Devtosh SuperBazaar Editorial Team',
        authorUrl: d.authorUrl,
        coverImage: d.coverImage || '',
        coverImageAlt: d.coverImageAlt || d.coverAlt || d.title || '',
        category: d.category || 'Shopping Guides',
        tags: Array.isArray(d.tags) ? d.tags : [],
        publishedAt: d.publishedAt || new Date().toISOString(),
        updatedAt: d.updatedAt || new Date().toISOString(),
        published: true,
        noindex: !!d.noindex || !!d.noIndex,
        canonicalUrl: d.canonicalUrl || d.canonicalOverride,
        ogTitle: d.ogTitle,
        ogDesc: d.ogDesc || d.ogDescription,
        ogImage: d.ogImage,
        hasAffiliateLinks: d.hasAffiliateLinks !== false && d.affiliateDisclosure !== false,
        readTimeMinutes: Number(d.readTimeMinutes) || calculateReadTime(d.content || ''),
        relatedProducts: Array.isArray(d.relatedProducts) ? d.relatedProducts : []
      });
    });

    if (liveItems.length > 0) {
      store.articles = liveItems;
    } else {
      store.articles = SEED_ARTICLES.filter(a => a.published);
    }
  } catch (error) {
    console.warn('Could not query published articles from Firestore, using seed articles:', error);
    store.articles = SEED_ARTICLES.filter(a => a.published);
  }
}

export async function loadAdminArticles() {
  try {
    const snapshot = await getDocs(collection(db, 'articles'));
    const items: Article[] = [];
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      items.push({
        id: docSnap.id,
        title: d.title || 'Untitled Article',
        slug: d.slug || docSnap.id,
        metaTitle: d.metaTitle || d.seoTitle || d.title || '',
        metaDesc: d.metaDesc || '',
        excerpt: d.excerpt || '',
        content: d.content || '',
        authorName: d.authorName || 'Devtosh SuperBazaar Editorial Team',
        authorUrl: d.authorUrl,
        coverImage: d.coverImage || '',
        coverImageAlt: d.coverImageAlt || d.coverAlt || d.title || '',
        category: d.category || 'Shopping Guides',
        tags: Array.isArray(d.tags) ? d.tags : [],
        publishedAt: d.publishedAt || new Date().toISOString(),
        updatedAt: d.updatedAt || new Date().toISOString(),
        published: !!d.published,
        noindex: !!d.noindex || !!d.noIndex,
        canonicalUrl: d.canonicalUrl || d.canonicalOverride,
        ogTitle: d.ogTitle,
        ogDesc: d.ogDesc || d.ogDescription,
        ogImage: d.ogImage,
        hasAffiliateLinks: d.hasAffiliateLinks !== false && d.affiliateDisclosure !== false,
        readTimeMinutes: Number(d.readTimeMinutes) || calculateReadTime(d.content || ''),
        relatedProducts: Array.isArray(d.relatedProducts) ? d.relatedProducts : []
      });
    });

    if (items.length > 0) {
      store.adminArticles = items;
    } else {
      store.adminArticles = [...SEED_ARTICLES];
    }
  } catch (error) {
    console.warn('Error loading admin articles from Firestore:', error);
    store.adminArticles = [...SEED_ARTICLES];
  }
}

export async function checkAdminStatus(user: User): Promise<boolean> {
  try {
    const adminDoc = await getDoc(doc(db, 'admins', user.uid));
    return adminDoc.exists();
  } catch (error) {
    console.warn('Error checking admin status in Firestore:', error);
    return false;
  }
}

// --------------------------------------------------------------------------
// Route Parser
// --------------------------------------------------------------------------
export function parseRoute() {
  const pathname = (location.pathname || '').replace(/\/index\.html$/, '');
  const hash = (location.hash || '').slice(1);

  let raw = '';
  if (hash && (hash.startsWith('/') || pathname === '/' || !pathname)) {
    raw = hash;
  } else if (pathname && pathname !== '/') {
    raw = pathname;
  } else {
    raw = hash || '/';
  }

  if (raw.startsWith('/')) raw = raw.slice(1);
  if (raw.endsWith('/')) raw = raw.slice(0, -1);

  const qIdx = raw.indexOf('?');
  const path = (qIdx < 0 ? raw : raw.slice(0, qIdx)).split('/').filter(Boolean);
  let q = '';
  try {
    const searchStr = qIdx >= 0 ? raw.slice(qIdx + 1) : location.search.slice(1);
    q = (new URLSearchParams(searchStr).get('q') || '').trim();
  } catch {}

  let root = path[0] || '';
  let sub = path[1] || '';
  let id = path[2] || '';
  let action = '';

  // Handle "/category/women" -> root = "women", etc.
  if (root === 'category') {
    root = sub;
    sub = path[2] || '';
  }

  // Handle category aliases
  if (root === 'womens') root = 'women';
  if (root === 'mens') root = 'men';

  // Specialized route parsing for admin products:
  if (root === 'admin' && sub === 'products') {
    if (path[2] === 'edit') {
      action = 'edit';
      id = path[3] || '';
    } else if (path[2] === 'new') {
      action = 'new';
      id = 'new';
    } else if (path[2]) {
      action = 'edit';
      id = path[2];
    }
  }

  // Specialized route parsing for admin articles / blog CMS:
  if (root === 'admin' && (sub === 'articles' || sub === 'blog')) {
    if (path[2] === 'edit') {
      action = 'edit';
      id = path[3] || '';
    } else if (path[2] === 'new') {
      action = 'new';
      id = 'new';
    } else if (path[2]) {
      action = 'edit';
      id = path[2];
    }
  }

  return {
    root,
    sub,
    id,
    action,
    extra: path[3] || '',
    path,
    q
  };
}

// --------------------------------------------------------------------------
// Public Views
// --------------------------------------------------------------------------
const H = '<svg aria-hidden="true" viewBox="0 0 24 24"><use href="#hrt"/></svg>';

function renderBreadcrumb(items: [string, string?][]): string {
  return '<nav class="bc" aria-label="Breadcrumb">' +
    items.map((x, i) => {
      return i < items.length - 1
        ? `<a href="${x[1] || '/'}">${esc(x[0])}</a>`
        : `<span aria-current="page">${esc(x[0])}</span>`;
    }).join(' / ') +
  '</nav>';
}

function renderPrice(p: { price: number; mrp?: number }): string {
  const d = disc(p);
  return '<div class="pr"><b>' + inr(p.price) + '</b>' +
    (p.mrp && d > 0 ? `<s><span class="sr">MRP </span>${inr(p.mrp)}</s><em>${d}% off</em>` : '') +
  '</div>';
}

function renderWishlistBtn(p: Product, className: string): string {
  const on = store.wishlistSlugs.includes(p.slug);
  const isIcon = (className === 'wl');
  const label = on ? `Remove ${p.name} from wishlist` : `Save ${p.name} to wishlist`;
  const text = on ? 'Saved to wishlist' : 'Save to wishlist';
  return `<button class="${className}${on ? ' on' : ''}" id="${className}-${p.slug}" data-a="wl" data-s="${p.slug}" aria-pressed="${on}" aria-label="${esc(label)}">` +
    H + (isIcon ? '' : `<span>${text}</span>`) +
  '</button>';
}

function renderProductImage(p: Product, isBig = false): string {
  const tag = isBig ? 'div' : `a href="/product/${p.slug}/" aria-label="View product details for ${esc(p.name)}"`;

  if (p.imgUrl) {
    return `<${tag} class="ph${isBig ? ' big' : ''}" style="background:#fff">` +
      `<img src="${esc(p.imgUrl)}" alt="${esc(p.name)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;transition:transform .4s ease" onerror="this.style.display='none';if(this.nextElementSibling){this.nextElementSibling.style.display='grid';}" />` +
      `<div class="ph-fallback" style="display:none;width:100%;height:100%;place-items:center;background:var(--bl);color:var(--mu);font-size:12px">Image unavailable</div>` +
    `</${isBig ? 'div' : 'a'}>`;
  }

  // Fallback to SVG silhouette
  const tint = p.tint || '#EADFD8';
  const g = p.g || '#9DB7CF';
  const sh = p.sh || (
    isElectronicsProduct(p) ? 'phone' :
    isWomenProduct(p) ? 'dress' :
    isFootwearProduct(p) ? 'shoe' :
    isAccessoriesProduct(p) ? 'bag' :
    'shirt'
  );
  return `<${tag} class="ph${isBig ? ' big' : ''}" style="--t:${tint};--g:${g}">` +
    `<svg viewBox="0 0 100 125" role="img" aria-label="Illustration for ${esc(p.name)}"><use href="#${sh}"/></svg>` +
  `</${isBig ? 'div' : 'a'}>`;
}

function renderProductCard(p: Product): string {
  const u = `/product/${p.slug}/`;
  return `<article class="pc" id="card-${p.slug}">` +
    renderProductImage(p) +
    renderWishlistBtn(p, 'wl') +
    '<div class="pi">' +
      `<div class="rt">${esc(p.brand)}</div>` +
      `<h3 class="pn"><a href="${u}">${esc(p.name)}</a></h3>` +
      renderPrice(p) +
      `<div class="ck">Sold by ${esc(p.ret)} · Verified price · Checked Oct 2026</div>` +
      `<a class="vp" href="${u}">View details<span class="sr"> for ${esc(p.name)}</span> →</a>` +
    '</div>' +
  '</article>';
}

function renderPublicCatalog(title: string, desc: string, base: Product[], key: string) {
  const f = store.filters;
  const ok = (p: Product) => {
    const matchBrand = !f.brand.length || f.brand.includes(p.brand);
    const matchCat = !f.cat.length || f.cat.includes(p.cat);
    const matchCol = !f.col.length || f.col.includes(p.col);
    const matchSize = !f.size.length || p.sizes.some(s => f.size.includes(s));
    const matchPriceTier = !f.price.length || f.price.some(i => p.price >= PR[i][0] && p.price <= PR[i][1]);
    const matchMin = !f.min || p.price >= f.min;
    const matchMax = !f.max || p.price <= f.max;
    const matchDisc = !f.disc || (p.mrp ? (p.mrp > p.price && disc(p) >= f.disc) : false);
    return matchBrand && matchCat && matchCol && matchSize && matchPriceTier && matchMin && matchMax && matchDisc;
  };

  const so: Record<string, (a: Product, b: Product) => number> = {
    rec: (a, b) => base.indexOf(a) - base.indexOf(b),
    lo: (a, b) => a.price - b.price,
    hi: (a, b) => b.price - a.price,
    nw: (a, b) => (b.added || 0) - (a.added || 0)
  };

  const filtered = base.filter(ok).sort(so[f.sort] || so.rec);

  const uq = (fn: (p: Product) => string) => {
    const set = new Set<string>();
    base.forEach(p => { const v = fn(p); if (v) set.add(v); });
    return Array.from(set).sort();
  };

  const cats = uq(p => p.cat);
  const brands = uq(p => p.brand);
  const cols = uq(p => p.col);
  const availableSizes = SZ.filter(s => base.some(p => p.sizes.includes(s)));

  // Filter groups
  const filterGroup = (k: string, t: string, count: number, body: string) => {
    const isOpen = f.open[k] ? ' open' : '';
    return `<details data-k="${k}"${isOpen}>` +
      `<summary><span>${esc(t)}${count ? `<i class="bd">${count}</i>` : ''}</span></summary>` +
      body +
    `</details>`;
  };

  const ck = (k: string, v: string | number, i: number, label: string, isChecked: boolean) => {
    return `<label class="o"><input type="checkbox" id="f-${k}${i}" data-a="f" data-k="${k}" data-v="${esc(v)}" ${isChecked ? 'checked' : ''}><span>${label}</span></label>`;
  };

  const brandHtml = filterGroup('brand', 'Brand', f.brand.length, brands.map((b, i) => ck('brand', b, i, esc(b), f.brand.includes(b))).join(''));
  const catHtml = filterGroup('cat', 'Category', f.cat.length, cats.map((c, i) => ck('cat', c, i, esc(c), f.cat.includes(c))).join(''));
  const sizeHtml = filterGroup('size', 'Size', f.size.length, availableSizes.map((s, i) => ck('size', s, i, esc(s), f.size.includes(s))).join(''));
  const colHtml = filterGroup('col', 'Colour', f.col.length, cols.map((c, i) => {
    const dot = `<i class="dot" style="background:${CX[c] || '#ccc'}"></i>`;
    return ck('col', c, i, `${dot} ${esc(c)}`, f.col.includes(c));
  }).join(''));

  const priceHtml = filterGroup('price', 'Price', f.price.length + (f.min || f.max ? 1 : 0),
    PL.map((l, i) => ck('price', i, i, l, f.price.includes(i))).join('') +
    `<div class="mm">` +
      `<input class="n" id="pmin" type="number" min="0" step="50" inputmode="numeric" placeholder="Min ₹" aria-label="Minimum price in rupees" value="${f.min || ''}">` +
      `<span aria-hidden="true">–</span>` +
      `<input class="n" id="pmax" type="number" min="0" step="50" inputmode="numeric" placeholder="Max ₹" aria-label="Maximum price in rupees" value="${f.max || ''}">` +
    `</div>` +
    `<button class="ln" id="pa" data-a="pa" style="margin-top:6px">Apply price range</button>`
  );

  const discHtml = filterGroup('disc', 'Discount', f.disc ? 1 : 0,
    [10, 20, 30].map((x, i) => ck('disc', x, i, `${x}% and above`, f.disc === x)).join('') +
    `<p class="ck" style="margin-top:8px">Products without an MRP are excluded from discount filter.</p>`
  );

  // Active Chips
  const chips: [string, string, string][] = [];
  f.brand.forEach(v => chips.push(['brand', v, v]));
  f.cat.forEach(v => chips.push(['cat', v, v]));
  f.size.forEach(v => chips.push(['size', v, v]));
  f.col.forEach(v => chips.push(['col', v, v]));
  f.price.forEach(i => chips.push(['price', String(i), PL[i]]));
  if (f.min || f.max) chips.push(['mm', '', `${f.min ? inr(f.min) : '₹0'}–${f.max ? inr(f.max) : 'any'}`]);
  if (f.disc) chips.push(['disc', String(f.disc), `${f.disc}%+ off`]);

  const chipsHtml = chips.map(c => `
    <span class="ch">${esc(c[2])}
      <button data-a="rm" data-k="${c[0]}" data-v="${esc(c[1])}" aria-label="Remove filter: ${esc(c[2])}">×</button>
    </span>
  `).join('');

  const breadcrumbs: [string, string?][] = (key === 'all' || key === 'home' || !key)
    ? [['Home', '/']]
    : [['Home', '/'], [title]];

  return {
    title,
    navKey: key,
    canonical: key && key !== 'all' ? `https://devtoshsuperbazaar.github.io/category/${key}/` : `https://devtoshsuperbazaar.github.io/`,
    metaDesc: desc,
    html: `
      <section class="w ih">
        ${renderBreadcrumb(breadcrumbs)}
        <div class="tt">
          <h1 class="f" tabindex="-1">${esc(title)}</h1>
          <span class="mu" aria-label="${filtered.length} products available">${filtered.length} items</span>
        </div>
        <p class="lead">${esc(desc)}</p>
      </section>

      <div class="w lay">
        <aside id="sidebar-filters" class="sb${f.mobileFiltersOpen ? ' show' : ''}" aria-label="Catalog filters">
          <div class="sbh">
            <h2>Filters ${chips.length ? `<i class="bd">${chips.length}</i>` : ''}</h2>
            <div>
              <button class="ln" data-a="clr" ${chips.length ? '' : 'disabled'} aria-label="Clear all applied filters">Clear all</button>
              <button class="ln sb-close" data-a="fb" aria-label="Close filters panel" style="margin-left:12px">Close ✕</button>
            </div>
          </div>
          ${brandHtml}${catHtml}${sizeHtml}${colHtml}${priceHtml}${discHtml}
        </aside>

        <main class="mn">
          <div class="tb">
            <div class="tl">
              <button class="fbtn" id="fbtn" data-a="fb" aria-expanded="${f.mobileFiltersOpen ? 'true' : 'false'}" aria-controls="sidebar-filters">
                <span>Filters</span>${chips.length ? `<i class="bd">${chips.length}</i>` : ''}
              </button>
              <strong>${filtered.length} items</strong>
              ${chipsHtml}
              ${chips.length ? `<button class="ln" data-a="clr" style="margin-left:4px">Clear all</button>` : ''}
            </div>

            <label class="mu" style="display:inline-flex;align-items:center">
              <span>Sort by</span>
              <select class="sel" id="srt" data-a="sort" aria-label="Sort product catalog">
                <option value="rec" ${f.sort === 'rec' ? 'selected' : ''}>Recommended</option>
                <option value="lo" ${f.sort === 'lo' ? 'selected' : ''}>Price: Low to High</option>
                <option value="hi" ${f.sort === 'hi' ? 'selected' : ''}>Price: High to Low</option>
                <option value="nw" ${f.sort === 'nw' ? 'selected' : ''}>Newest</option>
              </select>
            </label>
          </div>

          ${filtered.length ? `
            <div class="g">${filtered.slice(0, f.n).map(renderProductCard).join('')}</div>
            <div class="mo">
              <span>Showing ${Math.min(f.n, filtered.length)} of ${filtered.length} items</span>
              ${filtered.length > f.n ? `<button class="lm" id="more" data-a="more">Load more products</button>` : ''}
            </div>
          ` : `
            <div class="em" role="status">
              <h2 class="f">No items match these filters</h2>
              <p class="mu">Try removing an active filter, widening your price range, or clearing all criteria.</p>
              <button class="lm" data-a="clr" style="margin-top:16px">Clear all filters</button>
            </div>
          `}
        </main>
      </div>
    `
  };
}

function renderProductDetail(p: Product) {
  const rel = store.products
    .filter(x => x.slug !== p.slug)
    .sort((a, b) => (b.cat === p.cat ? 1 : 0) - (a.cat === p.cat ? 1 : 0))
    .slice(0, 4);

  const dept: [string, string] =
    isElectronicsProduct(p) ? ['Electronics & Mobiles', '/category/mobiles/'] :
    isWomenProduct(p) ? ['Women', '/category/women/'] :
    isKidsProduct(p) ? ['Kids & Baby', '/category/kids/'] :
    isFootwearProduct(p) ? ['Footwear', '/category/footwear/'] :
    isAccessoriesProduct(p) ? ['Accessories', '/category/accessories/'] :
    isHomeLivingProduct(p) ? ['Home & Living', '/category/home-living/'] :
    ['Men', '/category/men/'];

  const prodUrl = `${window.location.origin}/product/${p.slug}/`;
  const canonicalUrl = `https://devtoshsuperbazaar.github.io/product/${p.slug}/`;

  return {
    title: `${p.name} — Buy Online at Best Price`,
    navKey: dept[1].replace(/^\/category\/|\/$/g, ''),
    canonical: canonicalUrl,
    metaDesc: `Discover ${p.name} by ${p.brand} at ₹${p.price} (MRP ₹${p.mrp || p.price}). ${p.desc.slice(0, 120)}`,
    html: `
      <section class="w pgs wide">
        ${renderBreadcrumb([['Home', '/'], [dept[0], dept[1]], [p.name]])}
        <div class="dt">
          ${renderProductImage(p, true)}
          <div>
            <div class="rt">${esc(p.brand)}</div>
            <h1 class="f" tabindex="-1">${esc(p.name)}</h1>
            ${renderPrice(p)}
            <p class="mu" style="margin:6px 0 0">Verified price · checked Oct 2026</p>
            <p class="lead">${esc(p.desc)}</p>
            <dl class="sp">
              <dt>Retailer</dt><dd>${esc(p.ret)}</dd>
              <dt>Category</dt><dd>${esc(p.cat)}</dd>
              <dt>Colour</dt><dd>${esc(p.col)}</dd>
              <dt>Sizes available</dt><dd>${esc(p.sizes.join(', '))}</dd>
              <dt>Product SKU</dt><dd>${esc(p.slug)}</dd>
            </dl>
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:28px">
              <a class="lm" href="${esc(p.affUrl || p.retUrl || `#/go/${p.slug}`)}" target="_blank" rel="noopener noreferrer">Shop at ${esc(p.ret)} ↗</a>
              ${renderWishlistBtn(p, 'wb')}
            </div>

            <!-- Social Share Bar (WhatsApp, Telegram & Copy Link) -->
            <div class="sh-bar" role="region" aria-label="Share this product">
              <span class="sh-lbl">Share:</span>
              <a class="sh-btn wa" href="https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out ${p.name} on Devtosh SuperBazaar: ${prodUrl}`)}" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp">
                <svg aria-hidden="true"><use href="#wa"/></svg>
                <span>WhatsApp</span>
              </a>
              <a class="sh-btn tg" href="https://t.me/share/url?url=${encodeURIComponent(prodUrl)}&text=${encodeURIComponent(`Check out ${p.name} on Devtosh SuperBazaar`)}" target="_blank" rel="noopener noreferrer" aria-label="Share on Telegram">
                <svg aria-hidden="true"><use href="#tg"/></svg>
                <span>Telegram</span>
              </a>
              <button type="button" class="sh-btn" data-a="copy-prod-link" data-url="${esc(prodUrl)}" aria-label="Copy product link">
                <svg aria-hidden="true"><use href="#cp"/></svg>
                <span class="cp-text">Copy Link</span>
              </button>
            </div>

            <p class="dc" style="margin-top:24px"><b>Affiliate disclosure:</b> Devtosh SuperBazaar participates in affiliate partnerships and may earn a commission on qualifying purchases made through partner retailer links at no additional cost to you.</p>
            <p class="dc">Product availability, pricing, and merchant details are subject to verification on the retailer’s website.</p>
          </div>
        </div>
        <h2 class="f rh">You may also like</h2>
        <div class="g">${rel.map(renderProductCard).join('')}</div>
      </section>
    `
  };
}

function renderWishlistView() {
  const saved = store.products.filter(p => store.wishlistSlugs.includes(p.slug));
  return {
    title: 'Wishlist',
    navKey: 'wishlist',
    html: `
      <section class="w pgs wide">
        ${renderBreadcrumb([['Home', '/'], ['Wishlist']])}
        <div class="tt">
          <h1 class="f" tabindex="-1">Your Wishlist</h1>
          <span class="mu">${saved.length} saved items</span>
        </div>
        ${saved.length ? `
          <div class="g" style="margin-top:28px">${saved.map(renderProductCard).join('')}</div>
        ` : `
          <div style="margin-top:24px">
            <p class="lead">Your wishlist is currently empty. Click the heart icon on any product to save it here for later reference (stored in your browser without requiring an account).</p>
            <p style="margin-top:20px"><a class="vp" href="/">Explore All Collections →</a></p>
          </div>
        `}
      </section>
    `
  };
}

// --------------------------------------------------------------------------
// Mobile-First Admin Views
// --------------------------------------------------------------------------

function renderAdminNavigation(activeTab: string): string {
  return `
    <nav class="adm-nav" aria-label="Admin Navigation">
      <div class="adm-nav-inner">
        <a href="#/admin/dashboard" class="adm-tab ${activeTab === 'dashboard' ? 'active' : ''}">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <span>Overview</span>
        </a>
        <a href="#/admin/products" class="adm-tab ${activeTab === 'products' ? 'active' : ''}">
          <svg viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          <span>Products</span>
        </a>
        <a href="#/admin/products/new" class="adm-tab ${activeTab === 'new' ? 'active' : ''}">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
          <span>+ Add</span>
        </a>
        <a href="#/admin/categories" class="adm-tab ${activeTab === 'categories' ? 'active' : ''}">
          <svg viewBox="0 0 24 24"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
          <span>Categories</span>
        </a>
        <a href="#/admin/retailers" class="adm-tab ${activeTab === 'retailers' ? 'active' : ''}">
          <svg viewBox="0 0 24 24"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
          <span>Retailers</span>
        </a>
        <a href="#/admin/articles" class="adm-tab ${activeTab === 'articles' || activeTab === 'blog' ? 'active' : ''}">
          <svg viewBox="0 0 24 24"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/><path d="M6 14h6"/></svg>
          <span>Articles</span>
        </a>
        <a href="#/admin/settings" class="adm-tab ${activeTab === 'settings' ? 'active' : ''}">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
          <span>Settings</span>
        </a>
      </div>
    </nav>
  `;
}

function renderAdminHeader(title: string): string {
  const email = store.currentUser?.email || 'Admin';
  return `
    <header class="adm-hdr">
      <div class="adm-hdr-title">
        <img class="lg-mark" src="/favicon-48x48.png" srcset="/favicon-48x48.png 1x, /apple-touch-icon.png 2x" style="width:28px;height:28px;border-radius:6px;object-fit:cover;flex:none;display:block" width="28" height="28" alt="" aria-hidden="true" />
        <div>
          <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--wn);font-weight:600">Devtosh SuperBazaar Management</div>
          <h1 style="font-size:18px;margin:0;font-weight:600;font-family:'Bodoni Moda',serif">${esc(title)}</h1>
        </div>
      </div>
      <div class="adm-hdr-actions">
        <span class="adm-user-tag">${esc(email)}</span>
        <button class="adm-btn-sec" id="adm-logout" data-a="adm-logout" aria-label="Sign out of admin panel">Sign out</button>
        <a href="/" class="adm-btn-sec" style="text-decoration:none">View Store →</a>
      </div>
    </header>
  `;
}

function renderAdminLogin() {
  const currentCfg = getEffectiveFirebaseConfig();
  const isKeySuspicious = currentCfg.apiKey.length !== 39;

  return {
    title: 'Admin Sign In',
    navKey: 'admin',
    html: `
      <section class="w" style="max-width:480px;margin:50px auto;padding:0 20px">
        <div style="text-align:center;margin-bottom:28px">
          <span class="lo" style="margin:0 auto 12px;width:48px;height:48px;font-size:16px">DSB</span>
          <h1 class="f" style="font-size:26px;margin:0 0 6px">Devtosh SuperBazaar Admin</h1>
          <p class="mu" style="font-size:14px">Secure, mobile-first catalogue management.</p>
        </div>

        <div class="adm-card">
          ${store.adminSuccessMessage ? `
            <div class="adm-alert success" role="alert" style="margin-bottom:18px">
              <div style="display:flex;align-items:center;justify-content:space-between">
                <span><strong>✓ Success:</strong> ${esc(store.adminSuccessMessage)}</span>
                <button type="button" id="adm-clear-success" style="background:none;border:none;color:#1E5224;cursor:pointer;font-size:14px;padding:0 4px" title="Dismiss">✕</button>
              </div>
            </div>
          ` : ''}

          ${store.adminError ? `
            <div class="adm-alert error" role="alert" style="background:#FDF5F5;border:1px solid #EACBCB;border-left:4px solid var(--wn);padding:18px 20px;border-radius:4px;color:#4D2225;box-shadow:0 2px 10px rgba(134,83,86,.08);margin-bottom:20px;">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="display:inline-grid;place-items:center;width:22px;height:22px;background:#865356;color:#FFF;border-radius:50%;font-size:12px;font-weight:700">!</span>
                  <strong style="font-size:14px;color:#865356;letter-spacing:.02em">
                    ${store.adminApiKeyError ? 'Firebase Authentication Notice: Web API Key' : 'Authentication Notice'}
                  </strong>
                </div>
                <button type="button" id="adm-clear-error" style="background:none;border:none;color:#865356;cursor:pointer;font-size:16px;line-height:1;padding:2px 4px" title="Dismiss">✕</button>
              </div>

              <p style="margin:0 0 10px;font-size:13px;line-height:1.55">
                ${esc(store.adminError)}
              </p>

              ${store.adminApiKeyError || isKeySuspicious ? `
                <div style="background:#FFF;border:1px solid #E8C8CA;border-radius:4px;padding:14px;margin-top:12px">
                  <div style="font-size:12px;font-weight:600;color:#865356;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">
                    Update Web API Key for project <code>devtoshsuperbazaar-84898</code>
                  </div>
                  <p class="mu" style="font-size:12px;margin:0 0 10px;line-height:1.4">
                    The currently loaded key is <b>${currentCfg.apiKey.length} characters</b> (standard Google API keys are 39 characters).
                    To fix this, copy your Web API Key from the <a href="https://console.firebase.google.com/project/devtoshsuperbazaar-84898/settings/general" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;color:#865356;font-weight:600">Firebase Console (General Settings)</a> and paste it below:
                  </p>
                  <div style="display:flex;flex-direction:column;gap:8px">
                    <input type="text" id="quick-fix-api-key" class="adm-input" value="${esc(currentCfg.apiKey)}" placeholder="AIzaSy..." style="font-family:monospace;font-size:12px;padding:8px 10px" />
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                      <span id="quick-fix-char-count" style="font-size:11px;color:${currentCfg.apiKey.length === 39 ? '#2E7D32' : '#865356'};font-weight:600">
                        ${currentCfg.apiKey.length} / 39 characters ${currentCfg.apiKey.length !== 39 ? '(incomplete)' : '(standard length)'}
                      </span>
                      <button type="button" id="quick-fix-api-key-btn" class="lm" style="padding:6px 14px;font-size:12px">
                        Save &amp; Verify Key
                      </button>
                    </div>
                  </div>
                  <div id="quick-fix-feedback" style="margin-top:8px;font-size:12px"></div>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <form id="adm-login-form">
            <div class="adm-field">
              <label for="adm-email">Admin Email Address</label>
              <input type="email" id="adm-email" required autocomplete="email" placeholder="devtoshsuperbazaar@gmail.com" class="adm-input" />
            </div>

            <div class="adm-field">
              <label for="adm-pass">Password</label>
              <input type="password" id="adm-pass" required autocomplete="current-password" placeholder="••••••••" class="adm-input" />
            </div>

            <button type="submit" id="adm-login-submit" class="lm" style="width:100%;margin-top:14px">
              Sign In to Dashboard
            </button>
          </form>

          <details style="margin-top:20px;padding-top:14px;border-top:1px solid var(--bd);font-size:12px">
            <summary style="cursor:pointer;color:var(--wn);font-weight:600;display:flex;align-items:center;gap:6px">
              <span>⚙️ Firebase Connection &amp; Web Key Settings</span>
            </summary>
            <div style="margin-top:12px;background:var(--sf);border:1px solid var(--bd);padding:14px;border-radius:3px">
              <div style="margin-bottom:8px">
                <span class="mu">Connected Project:</span> <code>devtoshsuperbazaar-84898</code>
              </div>
              <div style="margin-bottom:8px">
                <span class="mu">Active API Key:</span> <code style="word-break:break-all">${esc(currentCfg.apiKey)}</code> (${currentCfg.apiKey.length} chars)
              </div>
              <div style="margin-top:10px">
                <label for="cfg-api-key" style="display:block;margin-bottom:4px;font-weight:600">Enter / Update Web API Key:</label>
                <div style="display:flex;gap:6px">
                  <input type="text" id="cfg-api-key" class="adm-input" value="${esc(currentCfg.apiKey)}" style="font-family:monospace;font-size:12px" />
                  <button type="button" id="cfg-api-key-save-btn" class="lm" style="white-space:nowrap;padding:6px 12px;font-size:12px">Save</button>
                </div>
                <div id="cfg-api-key-status" style="margin-top:6px;font-size:12px"></div>
              </div>
              <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
                <button type="button" id="cfg-test-conn-btn" class="lm sec" style="padding:5px 12px;font-size:11px">Test Connection</button>
                <button type="button" id="cfg-reset-btn" class="lm sec" style="padding:5px 12px;font-size:11px">Reset to Default</button>
              </div>
            </div>
          </details>

          <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--bd);font-size:12px;color:var(--mu);line-height:1.5">
            <b>Access Policy:</b> Sign-in uses Firebase Authentication with project <code>devtoshsuperbazaar-84898</code>. Privileged dashboard access is verified against the Firestore <code>admins</code> allowlist.
          </div>
        </div>

        <p style="text-align:center;margin-top:24px">
          <a href="/" class="vp">← Return to Public Store</a>
        </p>
      </section>
    `
  };
}

function renderAdminDashboard() {
  const prods = store.adminProducts;
  const publishedCount = prods.filter(p => p.published).length;
  const draftCount = prods.filter(p => !p.published).length;
  const featuredCount = prods.filter(p => p.featured).length;

  const categories = Array.from(new Set(prods.map(p => p.cat).filter(Boolean)));
  const retailers = Array.from(new Set(prods.map(p => p.ret).filter(Boolean)));

  const recent = [...prods].reverse().slice(0, 6);
  const arts = store.adminArticles;
  const artPublishedCount = arts.filter(a => a.published).length;
  const artDraftCount = arts.filter(a => !a.published).length;

  return {
    title: 'Admin Dashboard',
    navKey: 'admin',
    html: `
      <div class="adm-wrap">
        ${renderAdminHeader('Dashboard Overview')}

        <div class="adm-body">
          <div class="adm-grid-kpi">
            <div class="adm-kpi">
              <div class="adm-kpi-val">${prods.length}</div>
              <div class="adm-kpi-lbl">Total Products</div>
            </div>
            <div class="adm-kpi">
              <div class="adm-kpi-val" style="color:#2E7D32">${publishedCount}</div>
              <div class="adm-kpi-lbl">Published Products</div>
            </div>
            <div class="adm-kpi">
              <div class="adm-kpi-val" style="color:#E65100">${draftCount}</div>
              <div class="adm-kpi-lbl">Product Drafts</div>
            </div>
            <div class="adm-kpi">
              <div class="adm-kpi-val">${arts.length}</div>
              <div class="adm-kpi-lbl">Blog Articles</div>
            </div>
            <div class="adm-kpi">
              <div class="adm-kpi-val" style="color:#2E7D32">${artPublishedCount}</div>
              <div class="adm-kpi-lbl">Live Articles</div>
            </div>
            <div class="adm-kpi">
              <div class="adm-kpi-val" style="color:var(--wn)">${artDraftCount}</div>
              <div class="adm-kpi-lbl">Article Drafts</div>
            </div>
          </div>

          <div style="display:flex;gap:12px;margin:24px 0 28px;flex-wrap:wrap">
            <a href="#/admin/products/new" class="lm" style="text-decoration:none">+ Add Product</a>
            <a href="#/admin/articles/new" class="lm" style="text-decoration:none;background:#2E4C38">+ Write Article</a>
            <a href="#/admin/products" class="adm-btn-sec" style="text-decoration:none">Manage Products</a>
            <a href="#/admin/articles" class="adm-btn-sec" style="text-decoration:none">Blog CMS (${arts.length})</a>
            <a href="#/admin/categories" class="adm-btn-sec" style="text-decoration:none">Categories</a>
          </div>

          <div class="adm-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
              <h2 style="font-size:16px;margin:0;font-weight:600">Recent Products</h2>
              <a href="#/admin/products" class="vp" style="font-size:12.5px">View all inventory →</a>
            </div>

            ${recent.length ? `
              <div class="adm-prod-list">
                ${recent.map(p => `
                  <div class="adm-prod-row">
                    <div style="display:flex;gap:12px;align-items:center;min-width:0">
                      ${p.imgUrl ? `
                        <img src="${esc(p.imgUrl)}" alt="" style="width:40px;height:48px;object-fit:cover;border:1px solid var(--bd)" />
                      ` : `
                        <div style="width:40px;height:48px;background:var(--bl);display:grid;place-items:center;font-size:10px;color:var(--wn);border:1px solid var(--bd)">DSB</div>
                      `}
                      <div style="min-width:0">
                        <div style="font-weight:600;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div>
                        <div class="mu" style="font-size:12px">${esc(p.brand)} · ${inr(p.price)}</div>
                      </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px">
                      <span class="adm-badge ${p.published ? 'pub' : 'draft'}">${p.published ? 'Published' : 'Draft'}</span>
                      <a href="#/admin/products/edit/${p.id}" class="adm-btn-sm">Edit</a>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <p class="mu" style="margin:8px 0">No products added in Cloud Firestore yet. Click "+ Add New Product" to create and publish your first item.</p>
            `}
          </div>

          <div class="adm-card" style="margin-top:24px;background:rgba(134,83,86,.04)">
            <h3 style="font-size:14px;margin:0 0 6px;color:var(--wn)">Firebase Project: devtoshsuperbazaar-84898</h3>
            <p class="mu" style="font-size:12.5px;margin:0;line-height:1.5">
              Current authenticated administrator: <b>${esc(store.currentUser?.email)}</b><br />
              UID: <code style="font-size:11px">${esc(store.currentUser?.uid)}</code>
            </p>
          </div>
        </div>

        ${renderAdminNavigation('dashboard')}
      </div>
    `
  };
}

function renderAdminProducts() {
  const f = store.adminFilter;
  let items = [...store.adminProducts];

  if (f.status === 'published') items = items.filter(p => p.published);
  if (f.status === 'draft') items = items.filter(p => !p.published);
  if (f.cat !== 'all') items = items.filter(p => p.cat === f.cat);
  if (f.brand !== 'all') items = items.filter(p => p.brand === f.brand);
  if (f.q) {
    const q = f.q.toLowerCase();
    items = items.filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.ret.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
  }

  // Admin Sorting
  const sort = store.adminSort || 'newest';
  if (sort === 'newest') {
    items.sort((a, b) => {
      const da = a.updatedAt || a.createdAt || '';
      const db = b.updatedAt || b.createdAt || '';
      return db.localeCompare(da);
    });
  } else if (sort === 'oldest') {
    items.sort((a, b) => {
      const da = a.createdAt || a.updatedAt || '';
      const db = b.createdAt || b.updatedAt || '';
      return da.localeCompare(db);
    });
  } else if (sort === 'price-asc') {
    items.sort((a, b) => a.price - b.price);
  } else if (sort === 'price-desc') {
    items.sort((a, b) => b.price - a.price);
  } else if (sort === 'name-asc') {
    items.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'name-desc') {
    items.sort((a, b) => b.name.localeCompare(a.name));
  } else if (sort === 'cat') {
    items.sort((a, b) => a.cat.localeCompare(b.cat));
  } else if (sort === 'published') {
    items.sort((a, b) => (b.published ? 1 : 0) - (a.published ? 1 : 0));
  } else if (sort === 'draft') {
    items.sort((a, b) => (a.published ? 1 : 0) - (b.published ? 1 : 0));
  } else if (sort === 'discount') {
    const getDisc = (p: Product) => (p.mrp && p.mrp > p.price) ? ((p.mrp - p.price) / p.mrp) : 0;
    items.sort((a, b) => getDisc(b) - getDisc(a));
  }

  const allCats = Array.from(new Set(store.adminProducts.map(p => p.cat).filter(Boolean))).sort();
  const totalCount = store.adminProducts.length;
  const publishedCount = store.adminProducts.filter(p => p.published).length;
  const draftCount = totalCount - publishedCount;

  return {
    title: 'Product Inventory',
    navKey: 'admin',
    html: `
      <div class="adm-wrap">
        ${renderAdminHeader('Product Inventory')}

        <div class="adm-body">
          <!-- Quick Stats & Fast Action Bar -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
            <div style="background:var(--bg);border:1px solid var(--bd);padding:12px 14px;border-radius:3px">
              <div class="mu" style="font-size:11px;text-transform:uppercase;letter-spacing:.05em">Total Products</div>
              <div style="font-size:22px;font-weight:700;color:var(--dp);font-family:'Bodoni Moda',serif">${totalCount}</div>
            </div>
            <div style="background:var(--bg);border:1px solid var(--bd);padding:12px 14px;border-radius:3px">
              <div class="mu" style="font-size:11px;text-transform:uppercase;letter-spacing:.05em">Published Live</div>
              <div style="font-size:22px;font-weight:700;color:#2E7D32;font-family:'Bodoni Moda',serif">${publishedCount}</div>
            </div>
            <div style="background:var(--bg);border:1px solid var(--bd);padding:12px 14px;border-radius:3px">
              <div class="mu" style="font-size:11px;text-transform:uppercase;letter-spacing:.05em">Drafts</div>
              <div style="font-size:22px;font-weight:700;color:var(--wn);font-family:'Bodoni Moda',serif">${draftCount}</div>
            </div>
            <div style="background:var(--bg);border:1px solid var(--bd);padding:12px 14px;border-radius:3px">
              <div class="mu" style="font-size:11px;text-transform:uppercase;letter-spacing:.05em">Categories</div>
              <div style="font-size:22px;font-weight:700;color:var(--tx);font-family:'Bodoni Moda',serif">${allCats.length}</div>
            </div>
          </div>

          <!-- Fast Multi-Retailer Import Banner -->
          <div style="background:var(--bg);border:1px dashed var(--bd);padding:14px 18px;border-radius:4px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="display:grid;place-items:center;width:32px;height:32px;background:var(--wn);color:#fff;border-radius:50%;font-size:14px;font-weight:700">⚡</span>
              <div>
                <strong style="font-size:13.5px;color:var(--wn)">Auto-Extract from Multi-Retailer Links</strong>
                <p class="mu" style="font-size:12px;margin:2px 0 0">Paste any Amazon, Flipkart, Myntra, Ajio, or Meesho link to automatically extract image, price, title, category and retailer info.</p>
              </div>
            </div>
            <a href="#/admin/products/new" class="lm" style="height:36px;padding:0 16px;text-decoration:none;font-size:12.5px;white-space:nowrap">+ Add / Extract Product</a>
          </div>

          <!-- Controls Bar: Search, Filters, and Sorting -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:12px">
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <input type="search" id="adm-prod-q" placeholder="Search by name, brand, retailer…" value="${esc(f.q)}" class="adm-input" style="max-width:220px;height:38px;font-size:13px" />
              
              <select id="adm-filter-status" class="adm-input" style="width:auto;height:38px;font-size:13px">
                <option value="all" ${f.status === 'all' ? 'selected' : ''}>All Status</option>
                <option value="published" ${f.status === 'published' ? 'selected' : ''}>Published Only</option>
                <option value="draft" ${f.status === 'draft' ? 'selected' : ''}>Drafts Only</option>
              </select>

              <select id="adm-filter-cat" class="adm-input" style="width:auto;height:38px;font-size:13px">
                <option value="all">All Categories</option>
                ${allCats.map(c => `<option value="${esc(c)}" ${f.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
              </select>

              <!-- Sorting Dropdown -->
              <div style="display:flex;align-items:center;gap:6px">
                <label for="adm-sort" class="mu" style="font-size:12px;white-space:nowrap">Sort:</label>
                <select id="adm-sort" class="adm-input" style="width:auto;height:38px;font-size:13px;font-weight:500">
                  <option value="newest" ${sort === 'newest' ? 'selected' : ''}>Newest First</option>
                  <option value="oldest" ${sort === 'oldest' ? 'selected' : ''}>Oldest First</option>
                  <option value="price-asc" ${sort === 'price-asc' ? 'selected' : ''}>Price: Low to High</option>
                  <option value="price-desc" ${sort === 'price-desc' ? 'selected' : ''}>Price: High to Low</option>
                  <option value="discount" ${sort === 'discount' ? 'selected' : ''}>Highest Discount (%)</option>
                  <option value="name-asc" ${sort === 'name-asc' ? 'selected' : ''}>Name: A to Z</option>
                  <option value="name-desc" ${sort === 'name-desc' ? 'selected' : ''}>Name: Z to A</option>
                  <option value="cat" ${sort === 'cat' ? 'selected' : ''}>Category</option>
                  <option value="published" ${sort === 'published' ? 'selected' : ''}>Published First</option>
                  <option value="draft" ${sort === 'draft' ? 'selected' : ''}>Drafts First</option>
                </select>
              </div>
            </div>

            <a href="#/admin/products/new" class="lm" style="height:38px;padding:0 18px;text-decoration:none;font-size:13px">+ New Product</a>
          </div>

          <div class="adm-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--bd);padding-bottom:10px">
              <div style="font-size:12.5px;color:var(--mu)">
                Showing <b>${items.length}</b> of ${totalCount} products
                ${f.q ? ` · matching "<b>${esc(f.q)}</b>"` : ''}
              </div>
              <div style="font-size:11.5px;color:var(--mu)">
                Sorted by: <b>${esc(sort.replace('-', ' ').toUpperCase())}</b>
              </div>
            </div>

            ${items.length ? `
              <div class="adm-prod-list">
                ${items.map(p => `
                  <div class="adm-prod-card" id="row-${p.id}">
                    <div style="display:flex;gap:14px;align-items:flex-start">
                      ${p.imgUrl ? `
                        <img src="${esc(p.imgUrl)}" alt="" style="width:65px;height:82px;object-fit:cover;border:1px solid var(--bd);border-radius:2px" loading="lazy" />
                      ` : `
                        <div style="width:65px;height:82px;background:var(--bl);display:grid;place-items:center;font-size:10px;color:var(--wn);border:1px solid var(--bd);border-radius:2px">NO IMG</div>
                      `}
                      <div style="flex:1;min-width:0">
                        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                          <span class="adm-badge ${p.published ? 'pub' : 'draft'}">${p.published ? 'Published' : 'Draft'}</span>
                          ${p.featured ? '<span class="adm-badge feat">Featured</span>' : ''}
                          <span class="mu" style="font-size:11.5px;font-weight:500">${esc(p.cat)}</span>
                          ${p.ret ? `<span style="font-size:11px;background:rgba(0,0,0,.04);padding:1px 6px;border-radius:2px;color:var(--mu)">${esc(p.ret)}</span>` : ''}
                        </div>
                        <h3 style="font-size:15px;margin:5px 0 3px;font-weight:600">
                          <a href="#/admin/products/edit/${p.id}" style="color:inherit;text-decoration:none">${esc(p.name)}</a>
                        </h3>
                        <div style="font-size:13.5px;font-weight:600">
                          ${inr(p.price)} 
                          ${p.mrp && p.mrp > p.price ? `
                            <s class="mu" style="font-size:11.5px;font-weight:400;margin-left:4px">${inr(p.mrp)}</s>
                            <span style="font-size:11px;color:#2E7D32;margin-left:4px">(${Math.round(((p.mrp - p.price) / p.mrp) * 100)}% off)</span>
                          ` : ''}
                        </div>
                        <div class="mu" style="font-size:11.5px;margin-top:2px">
                          Brand: <b>${esc(p.brand || 'Devtosh SuperBazaar')}</b> · Slug: <code>${esc(p.slug)}</code>
                        </div>
                      </div>
                    </div>

                    <div class="adm-card-actions">
                      <a href="#/admin/products/edit/${p.id}" class="adm-btn-sm" style="font-weight:600;background:var(--bl);border-color:var(--wn);color:var(--wn)">Edit</a>
                      <button class="adm-btn-sm" data-a="adm-clone-prod" data-id="${p.id}" title="Duplicate this product to create a copy">
                        Duplicate
                      </button>
                      <button class="adm-btn-sm" data-a="adm-toggle-pub" data-id="${p.id}" data-val="${!p.published}">
                        ${p.published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button class="adm-btn-sm del" data-a="adm-del-prod" data-id="${p.id}" data-name="${esc(p.name)}">
                        Delete
                      </button>
                      ${p.published ? `<a href="/product/${p.slug}/" class="adm-btn-sm" target="_blank" title="View product page in online store">Store ↗</a>` : ''}
                      ${p.retUrl ? `<a href="${esc(p.retUrl)}" class="adm-btn-sm" target="_blank" rel="noopener" title="Open source product at ${esc(p.ret)}">Source ↗</a>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div style="text-align:center;padding:48px 0;color:var(--mu)">
                <p style="font-size:15px;margin-bottom:8px">No products matching your search or filters.</p>
                <a href="#/admin/products/new" class="lm" style="display:inline-block;margin-top:8px;text-decoration:none">+ Create First Product</a>
              </div>
            `}
          </div>
        </div>

        ${renderAdminNavigation('products')}
      </div>
    `
  };
}

function renderProductForm(p?: Product, editId?: string, isClone?: boolean) {
  const isEdit = !!p && !isClone;
  const isCloned = !!isClone;

  // Title calculation
  let title = 'Add New Product';
  if (isEdit) title = `Edit Product: ${p!.name}`;
  else if (isCloned) title = `Duplicate Product (Copy)`;

  // If loading a requested product
  if (!p && editId && store.adminLoadingProductId === editId) {
    return {
      title: 'Loading Product…',
      navKey: 'admin',
      html: `
        <div class="adm-wrap">
          ${renderAdminHeader('Loading Product')}
          <div class="adm-body" style="max-width:760px;margin:40px auto;text-align:center">
            <div class="adm-card" style="padding:40px">
              <div style="font-size:16px;font-weight:600;margin-bottom:8px">Retrieving product details from Cloud Firestore…</div>
              <p class="mu" style="font-size:13px">Loading document <code>${esc(editId)}</code>. Please wait a moment.</p>
            </div>
          </div>
          ${renderAdminNavigation('products')}
        </div>
      `
    };
  }

  // Pre-calculated values
  const currentPrice = p?.price !== undefined ? p.price : '';
  const currentMrp = p?.mrp !== undefined && p.mrp > 0 ? p.mrp : '';
  const initialDiscount = (currentPrice && currentMrp && Number(currentMrp) > Number(currentPrice))
    ? Math.round(((Number(currentMrp) - Number(currentPrice)) / Number(currentMrp)) * 100)
    : 0;

  return {
    title,
    navKey: 'admin',
    html: `
      <div class="adm-wrap">
        ${renderAdminHeader(title)}

        <div class="adm-body" style="max-width:780px;margin:0 auto">
          ${isEdit ? `
            <!-- Edit Status Banner -->
            <div style="background:var(--sf);border:1px solid #D5C2C4;border-left:4px solid var(--wn);padding:14px 18px;border-radius:4px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
              <div>
                <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--wn)">Editing Existing Firestore Product</div>
                <div style="font-weight:600;font-size:15px;color:var(--dp)">${esc(p!.name)}</div>
                <div class="mu" style="font-size:12px;margin-top:2px">
                  Document ID: <code>${esc(p!.id)}</code> · Status: <span class="adm-badge ${p!.published ? 'pub' : 'draft'}">${p!.published ? 'Published' : 'Draft'}</span>
                </div>
              </div>
              <div style="display:flex;gap:8px">
                ${p!.published ? `<a href="/product/${p!.slug}/" class="adm-btn-sec" target="_blank" style="text-decoration:none">Store Page ↗</a>` : ''}
                <button type="button" class="adm-btn-sec" data-a="adm-clone-prod" data-id="${p!.id}">Duplicate</button>
              </div>
            </div>
          ` : ''}

          ${isCloned ? `
            <!-- Cloned Banner -->
            <div style="background:#FFF9C4;border:1px solid #FFF176;border-left:4px solid #FBC02D;padding:12px 16px;border-radius:4px;margin-bottom:20px;color:#5D4037;font-size:13px">
              <strong>⚡ Cloned Product:</strong> Loaded from existing item. Adjust the name, slug, price, or image below, then click Create &amp; Publish.
            </div>
          ` : ''}

          <!-- Smart Multi-Retailer Product Extractor (Amazon, Flipkart, Myntra, Ajio, Meesho) -->
          <div class="adm-card" style="margin-bottom:24px;border:1px solid var(--bd);background:var(--bg);box-shadow:none">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="display:inline-grid;place-items:center;width:24px;height:24px;background:var(--wn);color:#fff;border-radius:50%;font-size:12px;font-weight:700">⚡</span>
                <h2 style="font-size:15px;margin:0;font-weight:700;color:var(--dp)">Auto-Extract from Retailer Link (Amazon, Flipkart, Myntra, Ajio, Meesho)</h2>
              </div>
              <span style="font-size:11px;background:rgba(134,83,86,.08);color:var(--wn);padding:2px 8px;border-radius:10px;font-weight:600">Instant Auto-Fill</span>
            </div>

            <p style="font-size:12.5px;margin:0 0 12px;line-height:1.45;color:var(--mu)">
              Paste any product URL from <b>Amazon</b> (<code>amazon.in/dp/...</code>), <b>Flipkart</b> (<code>flipkart.com/.../p/...</code>), <b>Myntra</b>, <b>Ajio</b>, or <b>Meesho</b>. We will automatically detect the merchant and extract <b>Title</b>, <b>Price</b>, <b>MRP</b>, <b>Category</b>, and <b>Image URL</b>!
            </p>

            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <input type="url" id="import-url" placeholder="https://www.amazon.in/dp/... or https://www.flipkart.com/.../p/... or meesho.com/..." class="adm-input" style="flex:1;min-width:240px;background:var(--sf)" />
              <button type="button" id="import-btn" class="lm" style="white-space:nowrap;padding:0 20px;height:42px;font-weight:600">
                ⚡ Extract &amp; Auto-Fill All Info
              </button>
            </div>

            <!-- Optional Retailer Raw Details / Specs Accordion -->
            <details style="margin-top:12px">
              <summary style="font-size:12px;color:var(--wn);cursor:pointer;font-weight:600;user-select:none">
                + Or paste copied product specifications / details text
              </summary>
              <div style="margin-top:10px;background:var(--sf);border:1px solid var(--bd);border-radius:4px;padding:12px">
                <p class="mu" style="font-size:11.5px;margin:0 0 8px">
                  If you copied product details from any retailer app or page, paste the text here to parse Fabric, Sizes, Price, and Color:
                </p>
                <textarea id="import-text" rows="3" class="adm-input" placeholder="Name: Relaxed Cotton Shirt&#10;Fabric: 100% Cotton&#10;Sizes: M, L, XL&#10;Price: ₹389&#10;Color: Olive" style="font-size:12px;background:var(--sf)"></textarea>
                <button type="button" id="import-text-btn" class="adm-btn-sec" style="margin-top:8px;font-size:12px">
                  Parse Specifications Text
                </button>
              </div>
            </details>

            <div id="import-status" style="font-size:12.5px;margin-top:10px"></div>
          </div>

          <!-- Main Product Form -->
          <form id="product-edit-form" class="adm-card">
            <input type="hidden" id="p-id" value="${isCloned ? '' : (p?.id || '')}" />

            <div class="adm-field">
              <label for="p-name">Product Name *</label>
              <input type="text" id="p-name" required value="${esc(p?.name || '')}" class="adm-input" placeholder="e.g. Men's Cotton Regular Fit Shirt" />
            </div>

            <div class="adm-field">
              <label for="p-slug">URL Slug * <span class="mu">(lowercase, hyphens only)</span></label>
              <input type="text" id="p-slug" required pattern="^[a-z0-9-]+$" value="${esc(p?.slug || '')}" class="adm-input" placeholder="mens-cotton-regular-fit-shirt" />
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
              <div class="adm-field">
                <label for="p-brand">Brand *</label>
                <input type="text" id="p-brand" required value="${esc(p?.brand || 'Devtosh SuperBazaar Curated')}" class="adm-input" placeholder="e.g. Meesho Supplier or Devtosh SuperBazaar" />
              </div>

              <div class="adm-field">
                <label for="p-cat">Category *</label>
                <input type="text" id="p-cat" list="standard-cats" required value="${esc(p?.cat || 'Mobile Holders & Mounts')}" class="adm-input" placeholder="Type or select category…" />
                <datalist id="standard-cats">
                  <option value="Mobile Holders &amp; Mounts" />
                  <option value="Electronics &amp; Mobiles" />
                  <option value="Smartphones" />
                  <option value="Earbuds &amp; Audio" />
                  <option value="Smartwatches" />
                  <option value="Sarees &amp; Ethnic Wear" />
                  <option value="Kurtis &amp; Suits" />
                  <option value="Dresses &amp; Gowns" />
                  <option value="Women’s Tops" />
                  <option value="Fashion Jewellery" />
                  <option value="Handbags &amp; Clutches" />
                  <option value="Kids &amp; Toys" />
                  <option value="Footwear" />
                  <option value="Sneakers &amp; Casual Shoes" />
                  <option value="Sandals &amp; Slides" />
                  <option value="Shirts" />
                  <option value="T-Shirts" />
                  <option value="Jeans" />
                  <option value="Trousers" />
                  <option value="Jackets" />
                  <option value="Ethnic Wear" />
                  <option value="Sunglasses" />
                  <option value="Watches" />
                  <option value="Wallets" />
                  <option value="Accessories" />
                  <option value="Home &amp; Kitchen" />
                </datalist>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
              <div class="adm-field">
                <label for="p-price">Selling Price (₹) *</label>
                <input type="number" id="p-price" required min="0" value="${currentPrice}" class="adm-input" placeholder="399" />
              </div>

              <div class="adm-field">
                <label for="p-mrp">MRP / Original Price (₹) <span class="mu">(Optional)</span></label>
                <input type="number" id="p-mrp" min="0" value="${currentMrp}" class="adm-input" placeholder="799" />
                <div id="p-disc-preview" style="font-size:11.5px;color:var(--wn);margin-top:4px;font-weight:600">
                  ${initialDiscount > 0 ? `Discount: ${initialDiscount}% OFF (Save ₹${Number(currentMrp) - Number(currentPrice)})` : ''}
                </div>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
              <div class="adm-field">
                <label for="p-col">Colour</label>
                <input type="text" id="p-col" value="${esc(p?.col || 'White')}" class="adm-input" placeholder="e.g. Navy Blue, Olive, Black" />
              </div>

              <div class="adm-field">
                <label for="p-sizes">Available Sizes <span class="mu">(comma-separated)</span></label>
                <input type="text" id="p-sizes" value="${esc(p?.sizes?.join(', ') || 'S, M, L, XL')}" class="adm-input" placeholder="S, M, L, XL" />
              </div>
            </div>

            <div class="adm-field">
              <label for="p-desc">Description</label>
              <textarea id="p-desc" rows="3" class="adm-input" placeholder="Fabric, fit, and style details…">${esc(p?.desc || '')}</textarea>
            </div>

            <!-- Product Image URL with Meesho helper and Direct Clipboard Paste -->
            <div class="adm-field">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                <label for="p-img" style="margin:0">Product Image URL</label>
                <button type="button" id="paste-img-clipboard-btn" class="adm-btn-sm" style="font-size:11px;padding:2px 8px">
                  📋 Paste Image from Clipboard
                </button>
              </div>

              <input type="url" id="p-img" value="${esc(p?.imgUrl || '')}" class="adm-input" placeholder="https://images.meesho.com/images/products/...jpg" />

              <div style="margin-top:10px;display:flex;align-items:flex-start;gap:14px">
                <div id="img-preview-box" style="width:75px;height:95px;background:var(--bl);border:1px solid var(--bd);display:grid;place-items:center;overflow:hidden;border-radius:3px;flex-shrink:0">
                  ${p?.imgUrl ? `<img src="${esc(p.imgUrl)}" alt="" style="width:100%;height:100%;object-fit:cover" />` : '<span style="font-size:10px;color:var(--mu)">Preview</span>'}
                </div>
                <div style="font-size:12px;color:var(--mu);line-height:1.45">
                  <b>Meesho Image Copy Tip:</b> Open the item on Meesho, right-click (or long press on mobile) the main product photo, select <i>"Copy image address"</i>, then click the button above to paste it!
                </div>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
              <div class="adm-field">
                <label for="p-ret">Retailer Name *</label>
                <input type="text" id="p-ret" required value="${esc(p?.ret || 'Meesho')}" class="adm-input" placeholder="Meesho" />
              </div>

              <div class="adm-field">
                <label for="p-returl">Retailer Product URL</label>
                <input type="url" id="p-returl" value="${esc(p?.retUrl || '')}" class="adm-input" placeholder="https://www.meesho.com/product/..." />
              </div>
            </div>

            <div class="adm-field">
              <label for="p-affurl">Affiliate / Tracking URL <span class="mu">(Optional partner redirect)</span></label>
              <input type="url" id="p-affurl" value="${esc(p?.affUrl || '')}" class="adm-input" placeholder="https://partner.network/click?..." />
            </div>

            <div style="margin:20px 0;padding:16px;background:var(--bl);border-radius:2px;display:flex;flex-direction:column;gap:12px">
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                <input type="checkbox" id="p-published" ${p?.published !== false ? 'checked' : ''} style="width:18px;height:18px" />
                <span><b>Publish to live store</b> (Uncheck to save as private draft)</span>
              </label>

              <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                <input type="checkbox" id="p-featured" ${p?.featured ? 'checked' : ''} style="width:18px;height:18px" />
                <span>Feature in editorial homepage collections</span>
              </label>
            </div>

            <div style="display:flex;gap:12px;margin-top:24px;flex-wrap:wrap">
              <button type="submit" id="p-submit-btn" class="lm" style="flex:1">
                ${isEdit ? 'Save Changes to Firestore' : 'Create &amp; Publish'}
              </button>
              <button type="button" id="p-draft-btn" class="adm-btn-sec">Save as Draft</button>
              <a href="#/admin/products" class="adm-btn-sec" style="text-decoration:none">Cancel</a>
            </div>
          </form>
        </div>

        ${renderAdminNavigation(isEdit ? 'products' : 'new')}
      </div>
    `
  };
}

function renderAdminCategories() {
  const cats = Array.from(new Set(store.adminProducts.map(p => p.cat).filter(Boolean))).sort();

  return {
    title: 'Categories Management',
    navKey: 'admin',
    html: `
      <div class="adm-wrap">
        ${renderAdminHeader('Categories')}

        <div class="adm-body" style="max-width:760px;margin:0 auto">
          <div class="adm-card" style="margin-bottom:24px">
            <h2 style="font-size:16px;margin:0 0 12px;font-weight:600">Active Categories</h2>
            <div class="adm-prod-list">
              ${cats.map(c => {
                const count = store.adminProducts.filter(p => p.cat === c).length;
                return `
                  <div class="adm-prod-row">
                    <div>
                      <b>${esc(c)}</b>
                      <span class="mu" style="font-size:12px;margin-left:8px">(${count} products)</span>
                    </div>
                    <span class="adm-badge pub">Active</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="adm-card">
            <h3 style="font-size:14px;margin:0 0 10px;font-weight:600">Category Taxonomy Guidelines</h3>
            <p class="mu" style="font-size:12.5px;line-height:1.5;margin:0">
              Categories dynamically synchronize with the Cloud Firestore inventory. When you create or update a product with a category (e.g. <i>Shirts, T-shirts, Jeans, Trousers, Jackets, Sneakers, Accessories</i>), it automatically appears in the public navigation and filter sidebar.
            </p>
          </div>
        </div>

        ${renderAdminNavigation('categories')}
      </div>
    `
  };
}

function renderAdminRetailers() {
  const rets = Array.from(new Set(store.adminProducts.map(p => p.ret).filter(Boolean))).sort();

  return {
    title: 'Retailer Directory',
    navKey: 'admin',
    html: `
      <div class="adm-wrap">
        ${renderAdminHeader('Retailer Partners')}

        <div class="adm-body" style="max-width:760px;margin:0 auto">
          <div class="adm-card" style="margin-bottom:24px">
            <h2 style="font-size:16px;margin:0 0 12px;font-weight:600">Active Retailers</h2>
            <div class="adm-prod-list">
              ${rets.map(r => {
                const count = store.adminProducts.filter(p => p.ret === r).length;
                return `
                  <div class="adm-prod-row">
                    <div>
                      <b>${esc(r)}</b>
                      <span class="mu" style="font-size:12px;margin-left:8px">(${count} items curated)</span>
                    </div>
                    <span class="adm-badge draft">Partner</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="adm-card">
            <h3 style="font-size:14px;margin:0 0 8px;font-weight:600">Compliance & Disclosure Policy</h3>
            <p class="mu" style="font-size:12.5px;line-height:1.5;margin:0">
              Only verified affiliate networks with active merchant agreements may be designated as affiliate tracking destinations. Standard retailer URLs direct customers to the merchant’s storefront.
            </p>
          </div>
        </div>

        ${renderAdminNavigation('retailers')}
      </div>
    `
  };
}

function renderAdminSettings() {
  return {
    title: 'Site Settings',
    navKey: 'admin',
    html: `
      <div class="adm-wrap">
        ${renderAdminHeader('Editorial Settings')}

        <div class="adm-body" style="max-width:760px;margin:0 auto">
          <form id="settings-form" class="adm-card">
            <div class="adm-field">
              <label for="set-announcement">Top Announcement Banner</label>
              <textarea id="set-announcement" rows="2" class="adm-input">${esc(store.settings.announcement)}</textarea>
            </div>

            <div class="adm-field">
              <label for="set-disclosure">Affiliate Disclosure Statement</label>
              <textarea id="set-disclosure" rows="3" class="adm-input">${esc(store.settings.disclosure)}</textarea>
            </div>

            <div class="adm-field">
              <label for="set-handle">Social / Support Handle</label>
              <input type="text" id="set-handle" value="${esc(store.settings.contactHandle)}" class="adm-input" />
            </div>

            <button type="submit" class="lm" style="margin-top:16px">Save Settings to Cloud Firestore</button>
          </form>
        </div>

        ${renderAdminNavigation('settings')}
      </div>
    `
  };
}

// --------------------------------------------------------------------------
// Editorial Informational Views
// --------------------------------------------------------------------------
function renderAboutView() {
  return {
    title: 'About Devtosh SuperBazaar',
    navKey: 'about',
    html: `
      <section class="w pgs">
        ${renderBreadcrumb([['Home', '/'], ['About Us']])}
        <div class="tt">
          <h1 class="f" tabindex="-1">About Devtosh SuperBazaar</h1>
        </div>
        <p class="lead" style="margin-top:16px">
          Devtosh SuperBazaar is an independent fashion discovery and editorial curation destination. We simplify menswear shopping by handpicking timeless wardrobe staples, relaxed cuts, versatile outerwear, and refined footwear from respected global and homegrown labels.
        </p>

        <div style="margin-top:36px;display:flex;flex-direction:column;gap:24px">
          <div class="adm-card">
            <h2 class="f" style="font-size:20px;margin:0 0 10px;color:var(--dp)">Our Editorial Philosophy</h2>
            <p class="mu" style="line-height:1.6;margin:0">
              Modern fashion shouldn’t be a maze of endless discount bins and fast-fashion clutter. At Devtosh SuperBazaar, our team scours merchant inventories to assemble a tightly edited catalogue centered around fit, fabric durability, color versatility, and fair pricing.
            </p>
          </div>

          <div class="adm-card">
            <h2 class="f" style="font-size:20px;margin:0 0 10px;color:var(--dp)">How Discovery & Affiliate Shopping Works</h2>
            <p class="mu" style="line-height:1.6;margin:0">
              We do not stock physical inventory in our own warehouses. Instead, Devtosh SuperBazaar connects you directly to verified brand partners and retailers. When you discover an item you love, clicking “Shop at Retailer” brings you directly to the merchant’s storefront to complete your purchase.
            </p>
          </div>

          <div class="adm-card">
            <h2 class="f" style="font-size:20px;margin:0 0 10px;color:var(--dp)">Guest-First Experience</h2>
            <p class="mu" style="line-height:1.6;margin:0">
              We respect your privacy. Customers can browse every collection and maintain a persistent personal Wishlist entirely in their browser—without forced account creation, passwords, or tracking cookies.
            </p>
          </div>
        </div>

        <p style="margin-top:32px">
          <a class="lm" href="/" style="text-decoration:none">Explore Curated Collections →</a>
        </p>
      </section>
    `
  };
}

function renderContactView() {
  return {
    title: 'Contact Devtosh SuperBazaar',
    navKey: '',
    html: `
      <section class="w pgs">
        ${renderBreadcrumb([['Home', '/'], ['Contact']])}
        <div class="tt">
          <h1 class="f" tabindex="-1">Contact & Inquiries</h1>
        </div>
        <p class="lead" style="margin-top:16px">
          Have questions about our curated selections, partner brand integrations, or platform feedback? We’d love to hear from you.
        </p>

        <div style="margin-top:32px;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px">
          <div class="adm-card">
            <h2 class="f" style="font-size:18px;margin:0 0 8px;color:var(--dp)">General & Editorial Inquiries</h2>
            <p class="mu" style="font-size:13.5px;line-height:1.5;margin:0 0 12px">
              For feedback on featured collections, style curation, or general inquiries.
            </p>
            <div style="font-weight:600;color:var(--wn)">
              <a href="mailto:devtoshsuperbazaar@gmail.com" style="color:inherit;text-decoration:none">devtoshsuperbazaar@gmail.com</a>
            </div>
          </div>

          <div class="adm-card">
            <h2 class="f" style="font-size:18px;margin:0 0 8px;color:var(--dp)">Brand & Retailer Partnerships</h2>
            <p class="mu" style="font-size:13.5px;line-height:1.5;margin:0 0 12px">
              Retailers and independent brands interested in being featured in our catalogue.
            </p>
            <div style="font-weight:600;color:var(--wn)">
              <a href="mailto:devtoshsuperbazaar@gmail.com" style="color:inherit;text-decoration:none">devtoshsuperbazaar@gmail.com</a>
            </div>
          </div>
        </div>

        <div class="adm-card" style="margin-top:24px">
          <h2 class="f" style="font-size:18px;margin:0 0 10px;color:var(--dp)">Social & Updates</h2>
          <p class="mu" style="font-size:13.5px;line-height:1.5;margin:0">
            Follow our daily drops, style edits, and seasonal lookbooks at <b>${esc(store.settings.contactHandle || '@devtoshsuperbazaar')}</b>.
          </p>
        </div>

        <p style="margin-top:28px">
          <a class="vp" href="/">← Return to Collections</a>
        </p>
      </section>
    `
  };
}

function renderAffiliateDisclosureView() {
  return {
    title: 'Affiliate Disclosure — Devtosh SuperBazaar',
    navKey: '',
    html: `
      <section class="w pgs">
        ${renderBreadcrumb([['Home', '/'], ['Affiliate Disclosure']])}
        <div class="tt">
          <h1 class="f" tabindex="-1">Affiliate Disclosure</h1>
        </div>
        <div style="margin-top:24px;line-height:1.65;color:var(--tx)">
          <div class="adm-card" style="border-left:3px solid var(--wn)">
            <p style="margin:0;font-size:14.5px">
              <b>Transparency Statement:</b> Devtosh SuperBazaar is an independent fashion curation platform. In accordance with FTC guidelines and international advertising disclosure standards, we believe in complete transparency regarding commercial relationships.
            </p>
          </div>

          <h2 class="f" style="font-size:20px;margin:28px 0 12px;color:var(--dp)">How Affiliate Relationships Work</h2>
          <p class="mu">
            Devtosh SuperBazaar may earn an affiliate commission when visitors click on partner retailer links and make qualifying purchases on third-party merchant websites. This commission comes at no additional cost to you—the retail price you pay remains exactly the same as visiting the retailer directly.
          </p>

          <h2 class="f" style="font-size:20px;margin:28px 0 12px;color:var(--dp)">Editorial Independence</h2>
          <p class="mu">
            Our curation team selects garments and accessories based purely on design merits, fabric quality, and aesthetic value. An affiliate partnership never dictates product placement or positive reviews. If a merchant has great pieces, we feature them; if an item doesn't meet our standards, we don't.
          </p>

          <h2 class="f" style="font-size:20px;margin:28px 0 12px;color:var(--dp)">Affiliate Transparency</h2>
          <p class="mu">
            When clicking outbound product links to partner retailers, you are directed to the merchant’s storefront where pricing and availability are verified in real time.
          </p>

          <p style="margin-top:32px">
            <a class="vp" href="/">← Back to Collections</a>
          </p>
        </div>
      </section>
    `
  };
}

function renderPrivacyView() {
  return {
    title: 'Privacy Policy — Devtosh SuperBazaar',
    navKey: '',
    html: `
      <section class="w pgs">
        ${renderBreadcrumb([['Home', '/'], ['Privacy Policy']])}
        <div class="tt">
          <h1 class="f" tabindex="-1">Privacy Policy</h1>
        </div>
        <div style="margin-top:24px;line-height:1.65;color:var(--tx)">
          <h2 class="f" style="font-size:20px;margin:20px 0 10px;color:var(--dp)">Guest-First Architecture</h2>
          <p class="mu">
            Devtosh SuperBazaar operates on a strict privacy-first principle. Customers are not required to create accounts, submit email addresses, or log in to browse products or save favourites.
          </p>

          <h2 class="f" style="font-size:20px;margin:24px 0 10px;color:var(--dp)">Local Storage for Guest Wishlist</h2>
          <p class="mu">
            When you click the heart icon on any product, your preference is saved locally on your device using HTML5 <code>localStorage</code>. This data never leaves your browser, is never shared with third parties, and can be cleared at any time directly through your browser settings.
          </p>

          <h2 class="f" style="font-size:20px;margin:24px 0 10px;color:var(--dp)">Administrator Authentication</h2>
          <p class="mu">
            Administrator logins are securely handled using Firebase Authentication and restricted via Cloud Firestore security rules. No customer passwords or financial details are stored on our servers.
          </p>

          <p style="margin-top:32px">
            <a class="vp" href="/">← Back to Collections</a>
          </p>
        </div>
      </section>
    `
  };
}

function renderTermsView() {
  return {
    title: 'Terms of Use — Devtosh SuperBazaar',
    navKey: '',
    html: `
      <section class="w pgs">
        ${renderBreadcrumb([['Home', '/'], ['Terms of Use']])}
        <div class="tt">
          <h1 class="f" tabindex="-1">Terms of Use</h1>
        </div>
        <div style="margin-top:24px;line-height:1.65;color:var(--tx)">
          <p class="mu">
            Welcome to Devtosh SuperBazaar. By accessing or using this website, you agree to comply with and be bound by the following terms and conditions.
          </p>

          <h2 class="f" style="font-size:20px;margin:24px 0 10px;color:var(--dp)">Catalogue & Pricing Accuracy</h2>
          <p class="mu">
            Product details, prices, availability, and discounts displayed on Devtosh SuperBazaar are provided for informational and discovery purposes. Prices are subject to change by third-party retailers without prior notice. Always verify final pricing on the retailer’s official website before completing a transaction.
          </p>

          <h2 class="f" style="font-size:20px;margin:24px 0 10px;color:var(--dp)">Third-Party Retailers & Intellectual Property</h2>
          <p class="mu">
            All brand names, trademarks, and retailer logos referenced on this website are the property of their respective owners. Devtosh SuperBazaar does not claim ownership of external brand assets.
          </p>

          <p style="margin-top:32px">
            <a class="vp" href="/">← Back to Collections</a>
          </p>
        </div>
      </section>
    `
  };
}

// --------------------------------------------------------------------------
// View Dispatcher
// --------------------------------------------------------------------------
export function view(route: ReturnType<typeof parseRoute>) {
  const { root, sub, id, q } = route;

  // Informational Editorial Routes
  if (root === 'about') return renderAboutView();
  if (root === 'contact') return renderContactView();
  if (root === 'affiliate-disclosure') return renderAffiliateDisclosureView();
  if (root === 'privacy') return renderPrivacyView();
  if (root === 'terms') return renderTermsView();

  // Admin routes
  if (root === 'admin') {
    if (!store.currentUser) {
      return renderAdminLogin();
    }

    if (!store.isAdmin) {
      return {
        title: 'Admin Access Required',
        navKey: 'admin',
        html: `
          <div class="w" style="max-width:520px;margin:60px auto;padding:0 20px">
            <div class="adm-card" style="text-align:center">
              <span class="lo" style="margin:0 auto 12px;width:44px;height:44px;font-size:14px">DSB</span>
              <h2 style="font-size:20px;margin:0 0 10px;color:var(--wn)">Allowlist Authorization Needed</h2>
              <p class="mu" style="font-size:13.5px;line-height:1.5;margin:0 0 16px">
                Your account (<b>${esc(store.currentUser.email)}</b>) is authenticated with Firebase project <code>devtoshsuperbazaar-84898</code>, but this UID has not yet been authorized in the Firestore <code>admins</code> collection.
              </p>
              
              <div style="text-align:left;background:var(--bl);border:1px solid var(--bd);padding:14px;border-radius:2px;margin:16px 0">
                <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--mu);margin-bottom:6px">Your Firebase Authentication UID:</div>
                <div style="display:flex;align-items:center;gap:8px">
                  <code style="flex:1;font-size:12.5px;word-break:break-all;color:var(--dp);font-weight:600">${esc(store.currentUser.uid)}</code>
                  <button type="button" class="adm-btn-sm" data-a="copy-uid" data-uid="${esc(store.currentUser.uid)}" style="white-space:nowrap;padding:0 10px;height:30px">Copy UID</button>
                </div>
              </div>

              <div style="font-size:12.5px;text-align:left;line-height:1.6;color:var(--tx);background:var(--sf);border:1px solid var(--bd);padding:14px;margin-bottom:20px">
                <b>Console Authorization Steps:</b><br />
                1. Open <a href="https://console.firebase.google.com/project/devtoshsuperbazaar-84898/firestore" target="_blank" rel="noopener" style="color:var(--wn);text-decoration:underline">Firestore Database</a> in Firebase Console.<br />
                2. In the <code>admins</code> collection, click <b>Add document</b>.<br />
                3. Set <b>Document ID</b> to your exact UID above.<br />
                4. Add field <code>email</code> (string) with value <code>${esc(store.currentUser.email)}</code>.<br />
                5. Add field <code>role</code> (string) with value <code>admin</code>.<br />
                6. Click <b>Save</b>, then click <b>Re-check Authorization</b> below.
              </div>

              <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
                <button class="lm" data-a="adm-recheck">Re-check Authorization</button>
                <button class="adm-btn-sec" data-a="adm-logout">Sign Out</button>
                <a href="/" class="adm-btn-sec" style="text-decoration:none">Storefront</a>
              </div>
            </div>
          </div>
        `
      };
    }

    if (sub === 'dashboard' || !sub) return renderAdminDashboard();
    if (sub === 'products') {
      if (id === 'new' || route.action === 'new') {
        const clone = store.adminCloneSource;
        return renderProductForm(clone ? (clone as Product) : undefined, undefined, !!clone);
      }
      if (route.action === 'edit' || (id && id !== 'new')) {
        let prod = store.adminProducts.find(p => p.id === id || p.slug === id);
        if (!prod) {
          prod = store.products.find(p => p.id === id || p.slug === id);
        }
        if (!prod && store.adminLoadingProductId !== id) {
          store.adminLoadingProductId = id;
          getDoc(doc(db, 'products', id)).then(snap => {
            if (snap.exists()) {
              const d = snap.data();
              const fetched: Product = {
                id: snap.id,
                slug: d.slug || snap.id,
                name: d.name || 'Untitled Product',
                brand: d.brand || '',
                cat: d.cat || 'Curated Product',
                subcat: d.subcat || '',
                price: Number(d.price || 0),
                mrp: Number(d.mrp || 0),
                currency: d.currency || 'INR',
                col: d.col || '',
                sizes: Array.isArray(d.sizes) ? d.sizes : [],
                ret: d.ret || '',
                retUrl: d.retUrl || '',
                affUrl: d.affUrl || '',
                imgUrl: d.imgUrl || '',
                desc: d.desc || '',
                published: d.published !== false,
                featured: !!d.featured,
                createdAt: d.createdAt,
                updatedAt: d.updatedAt
              };
              const existingIdx = store.adminProducts.findIndex(p => p.id === id);
              if (existingIdx >= 0) store.adminProducts[existingIdx] = fetched;
              else store.adminProducts.push(fetched);
              draw();
            }
          }).catch(err => {
            console.warn('Could not load single product from Firestore:', err);
          });
        }
        return renderProductForm(prod, id);
      }
      return renderAdminProducts();
    }
    if (sub === 'categories') return renderAdminCategories();
    if (sub === 'retailers') return renderAdminRetailers();
    if (sub === 'articles' || sub === 'blog') {
      if (id === 'new' || route.action === 'new') {
        return renderArticleForm(undefined, undefined, store.adminArticles, store.products);
      }
      if (route.action === 'edit' || (id && id !== 'new')) {
        let art = store.adminArticles.find(a => a.id === id || a.slug === id);
        if (!art) {
          art = store.articles.find(a => a.id === id || a.slug === id);
        }
        if (!art) {
          art = SEED_ARTICLES.find(a => a.id === id || a.slug === id);
        }
        if (!art && store.adminLoadingArticleId !== id) {
          store.adminLoadingArticleId = id;
          getDoc(doc(db, 'articles', id)).then(snap => {
            if (snap.exists()) {
              const d = snap.data();
              const fetched: Article = {
                id: snap.id,
                title: d.title || 'Untitled Article',
                slug: d.slug || snap.id,
                metaTitle: d.metaTitle || d.seoTitle || d.title || '',
                metaDesc: d.metaDesc || '',
                excerpt: d.excerpt || '',
                content: d.content || '',
                authorName: d.authorName || 'Devtosh SuperBazaar Editorial Team',
                authorUrl: d.authorUrl,
                coverImage: d.coverImage || '',
                coverImageAlt: d.coverImageAlt || d.coverAlt || d.title || '',
                category: d.category || 'Shopping Guides',
                tags: Array.isArray(d.tags) ? d.tags : [],
                publishedAt: d.publishedAt || new Date().toISOString(),
                updatedAt: d.updatedAt || new Date().toISOString(),
                published: !!d.published,
                noindex: !!d.noindex || !!d.noIndex,
                canonicalUrl: d.canonicalUrl || d.canonicalOverride,
                ogTitle: d.ogTitle,
                ogDesc: d.ogDesc || d.ogDescription,
                ogImage: d.ogImage,
                hasAffiliateLinks: d.hasAffiliateLinks !== false && d.affiliateDisclosure !== false,
                readTimeMinutes: Number(d.readTimeMinutes) || calculateReadTime(d.content || ''),
                relatedProducts: Array.isArray(d.relatedProducts) ? d.relatedProducts : []
              };
              const existingIdx = store.adminArticles.findIndex(a => a.id === id);
              if (existingIdx >= 0) store.adminArticles[existingIdx] = fetched;
              else store.adminArticles.push(fetched);
              draw();
            }
          }).catch(err => {
            console.warn('Could not load single article from Firestore:', err);
          });
        }
        return renderArticleForm(art, id, store.adminArticles, store.products);
      }
      return renderAdminArticles(store.adminArticles, store.adminBlogFilter, store.adminBlogSort);
    }
    if (sub === 'settings') return renderAdminSettings();
    return renderAdminDashboard();
  }

  // Public Catalog Routes
  if (root === 'home' || root === 'all' || root === '') {
    return renderPublicCatalog(
      'Curated Catalogue',
      'Discover handpicked fashion, footwear, smartphones, mobile holders, and lifestyle essentials curated by Devtosh SuperBazaar.',
      store.products,
      'all'
    );
  }

  if (root === 'women') {
    const items = store.products.filter(isWomenProduct);
    return renderPublicCatalog(
      'Women’s Collection',
      'Sarees, kurtis, dresses, tops, jewellery, and contemporary western wear curated for elegance.',
      items,
      'women'
    );
  }

  if (root === 'men') {
    const items = store.products.filter(isMenProduct);
    return renderPublicCatalog(
      'Men’s Collection',
      'Everyday shirts, tees, jeans, trousers, jackets, and timeless menswear essentials.',
      items,
      'men'
    );
  }

  if (root === 'kids') {
    const items = store.products.filter(isKidsProduct);
    return renderPublicCatalog(
      'Kids & Baby',
      'Comfortable clothing, babywear, playful sets, toys, and daily essentials for boys and girls.',
      items,
      'kids'
    );
  }

  if (root === 'footwear') {
    const items = store.products.filter(isFootwearProduct);
    return renderPublicCatalog(
      'Footwear Collection',
      'Everyday sneakers, comfortable sandals, loafers, slides, and casual footwear.',
      items,
      'footwear'
    );
  }

  if (root === 'electronics' || root === 'mobiles') {
    const items = store.products.filter(isElectronicsProduct);
    return renderPublicCatalog(
      'Electronics & Mobiles',
      'High-grip mobile holders, car & desk mounts, wireless earbuds, smartwatches, and everyday tech gadgets.',
      items,
      'electronics'
    );
  }

  if (root === 'accessories') {
    const items = store.products.filter(isAccessoriesProduct);
    return renderPublicCatalog(
      'Accessories & Lifestyle',
      'Mobile holders & mounts, watches, sunglasses, wallets, belts, caps, and lifestyle gear.',
      items,
      'accessories'
    );
  }

  if (root === 'home-living' || root === 'home-decor') {
    const items = store.products.filter(isHomeLivingProduct);
    return renderPublicCatalog(
      'Home & Living',
      'Curated kitchen utilities, insulated water bottles, home decor, and organizers.',
      items,
      'home-living'
    );
  }

  if (root === 'new') {
    const items = [...store.products].sort((a, b) => (b.added || 0) - (a.added || 0));
    return renderPublicCatalog(
      'New Arrivals',
      'The freshest curated additions, trending styles, and top-rated affiliate deals.',
      items,
      'new'
    );
  }

  if (root === 'search') {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = tokens.length
      ? store.products.filter(x => {
          const hay = `${x.name} ${x.brand} ${x.cat} ${x.col} ${x.ret}`.toLowerCase();
          return tokens.every(t => hay.includes(t));
        })
      : [];
    return renderPublicCatalog(`Search: “${q}”`, `Search results for “${q}”.`, matches, '');
  }

  if (root === 'wishlist') {
    return renderWishlistView();
  }

  if (root === 'product' && sub) {
    const prod = store.products.find(p => p.slug === sub) || store.adminProducts.find(p => p.slug === sub);
    if (prod) return renderProductDetail(prod);
  }

  if (root === 'go' && sub) {
    const prod = store.products.find(p => p.slug === sub) || store.adminProducts.find(p => p.slug === sub);
    if (prod) {
      const destination = prod.affUrl || prod.retUrl;
      return {
        title: `Visiting Storefront — ${prod.ret}`,
        navKey: '',
        html: `
          <div class="w" style="max-width:640px;margin:40px auto;padding:32px 24px;background:var(--sf);border:1px solid var(--bd);text-align:center">
            <h1 class="f" style="font-size:24px;margin-top:0;color:var(--dp)">Visiting Partner Storefront</h1>
            <p class="mu" style="line-height:1.6;font-size:14.5px">
              You are discovering <b>“${esc(prod.name)}”</b> curated by Devtosh SuperBazaar.
            </p>
            ${destination ? `
              <p class="mu" style="line-height:1.6">
                Click below to open the official listing on <b>${esc(prod.ret)}</b>:
              </p>
              <div style="margin:24px 0">
                <a class="lm" href="${esc(destination)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-block;padding:12px 28px">Proceed to ${esc(prod.ret)} ↗</a>
              </div>
            ` : `
              <p class="mu" style="line-height:1.6">
                This item is available through verified merchant partner <b>${esc(prod.ret)}</b>.
              </p>
            `}
            <p style="margin-top:20px">
              <a class="vp" href="/product/${prod.slug}/">← Return to ${esc(prod.name)}</a>
            </p>
          </div>
        `
      };
    }
  }

  if (root === 'blog') {
    const allArticles = store.articles.length > 0 ? store.articles : SEED_ARTICLES.filter(a => a.published);
    if (sub) {
      const art = allArticles.find(a => a.slug === sub || a.id === sub) ||
        (store.isAdmin ? store.adminArticles.find(a => a.slug === sub || a.id === sub) : undefined) ||
        SEED_ARTICLES.find(a => a.slug === sub || a.id === sub);
      if (art) {
        return renderArticleDetail(art.slug, allArticles, store.isAdmin);
      }
      return {
        title: 'Article Not Found',
        navKey: 'blog',
        html: `
          <section class="w pgs">
            ${renderBreadcrumb([['Home', '/'], ['Blog', '/blog/'], ['Article Not Found']])}
            <div class="tt">
              <h1 class="f">Article Not Found</h1>
            </div>
            <p class="lead" style="margin-top:16px">The requested editorial guide could not be located. It may have been renamed, moved, or unpublished.</p>
            <p style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap">
              <a class="lm" href="/blog/" style="text-decoration:none">Browse All Articles →</a>
              <a class="vp" href="/">Return to Catalogue</a>
            </p>
          </section>
        `
      };
    }
    return renderBlogIndex('', route.q || '', allArticles);
  }

  return {
    title: 'Page Not Found',
    navKey: '',
    html: `
      <section class="w pgs">
        <h1 class="f">Page Not Found</h1>
        <p class="lead">The requested page or product was not found.</p>
        <p style="margin-top:20px"><a class="vp" href="/">← Back to Collections</a></p>
      </section>
    `
  };
}

// --------------------------------------------------------------------------
// Drawing and DOM Rendering
// --------------------------------------------------------------------------
// Google Analytics SPA Page View Tracking
let hasSentInitialDocPageView = false;

export function trackSpaPageView(pageTitle: string) {
  const route = parseRoute();
  // Do not track admin-only or private routes as public storefront pages
  if (route.root === 'admin') return;

  // Initial document load already triggered page_view via gtag in <head>; avoid double-counting
  if (!hasSentInitialDocPageView) {
    hasSentInitialDocPageView = true;
    return;
  }

  if (typeof (window as any).gtag === 'function') {
    (window as any).gtag('event', 'page_view', {
      page_title: pageTitle,
      page_location: window.location.href,
      page_path: window.location.pathname + window.location.search
    });
  }
}

export function draw(isNew = false) {
  const route = parseRoute();
  const v = view(route);
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = v.html;
  document.title = `${v.title} — Devtosh SuperBazaar`;
  trackSpaPageView(document.title);

  // Synchronize dynamic meta description & canonical tag
  if ((v as any).metaDesc) {
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', (v as any).metaDesc);
  }
  if ((v as any).canonical) {
    let canLink = document.querySelector('link[rel="canonical"]');
    if (!canLink) {
      canLink = document.createElement('link');
      canLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canLink);
    }
    canLink.setAttribute('href', (v as any).canonical);
  }

  // Synchronize Nav links
  const links = document.querySelectorAll('[data-n]');
  links.forEach(a => {
    const el = a as HTMLElement;
    if (el.dataset.n === v.navKey) {
      el.setAttribute('aria-current', 'page');
    } else {
      el.removeAttribute('aria-current');
    }
  });

  // Public/Admin header visibility
  const publicHeader = document.querySelector('header');
  const publicFooter = document.querySelector('footer');
  const topNotice = document.querySelector('.top');
  const mobStrip = document.querySelector('.mob-strip');

  if (route.root === 'admin') {
    if (publicHeader) (publicHeader as HTMLElement).style.display = 'none';
    if (publicFooter) (publicFooter as HTMLElement).style.display = 'none';
    if (topNotice) (topNotice as HTMLElement).style.display = 'none';
    if (mobStrip) (mobStrip as HTMLElement).style.display = 'none';
  } else {
    if (publicHeader) (publicHeader as HTMLElement).style.display = '';
    if (publicFooter) (publicFooter as HTMLElement).style.display = '';
    if (topNotice) (topNotice as HTMLElement).style.display = '';
    if (mobStrip) (mobStrip as HTMLElement).style.display = '';
  }

  // Synchronize search input and clear button state
  const qInput = document.getElementById('q') as HTMLInputElement;
  const qClr = document.getElementById('q-clr') as HTMLElement;
  if (qInput) {
    if (route.root === 'search') {
      if (document.activeElement !== qInput) {
        qInput.value = route.q;
      }
    } else if (route.root !== 'search' && !route.q) {
      if (document.activeElement !== qInput) {
        qInput.value = '';
      }
    }
    if (qClr) {
      qClr.style.display = qInput.value.trim() ? 'grid' : 'none';
    }
  }

  if (isNew) {
    window.scrollTo(0, 0);
  }

  // Setup discount listener if in product edit form
  const priceInput = document.getElementById('p-price') as HTMLInputElement;
  const mrpInput = document.getElementById('p-mrp') as HTMLInputElement;
  const discPreview = document.getElementById('p-disc-preview');
  if (priceInput && mrpInput && discPreview) {
    const updateDisc = () => {
      const pVal = Number(priceInput.value || 0);
      const mVal = Number(mrpInput.value || 0);
      if (mVal > pVal && pVal > 0) {
        const d = Math.round(((mVal - pVal) / mVal) * 100);
        discPreview.textContent = `Calculated discount: ${d}% off MRP`;
      } else {
        discPreview.textContent = 'No discount applicable';
      }
    };
    priceInput.addEventListener('input', updateDisc);
    mrpInput.addEventListener('input', updateDisc);
    updateDisc();
  }

  // Real-time image URL preview listener
  const imgInput = document.getElementById('p-img') as HTMLInputElement;
  const previewBox = document.getElementById('img-preview-box');
  if (imgInput && previewBox) {
    let currentProbe: HTMLImageElement | null = null;
    imgInput.addEventListener('input', () => {
      const url = imgInput.value.trim();
      if (currentProbe) {
        currentProbe.onload = null;
        currentProbe.onerror = null;
        currentProbe = null;
      }
      if (url) {
        const probe = new Image();
        currentProbe = probe;
        probe.onload = () => {
          if (currentProbe === probe && previewBox.isConnected) {
            previewBox.innerHTML = '';
            const img = document.createElement('img');
            img.src = url;
            img.alt = '';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            previewBox.appendChild(img);
          }
        };
        probe.onerror = () => {
          if (currentProbe === probe && previewBox.isConnected) {
            previewBox.innerHTML = '<span style="font-size:10px;color:#c62828;text-align:center;padding:4px">Invalid image URL</span>';
          }
        };
        probe.src = url;
      } else {
        previewBox.innerHTML = '<span style="font-size:10px;color:var(--mu)">Preview</span>';
      }
    });
  }

  // Live stats & initial counters for Article Editor
  const artContentArea = document.getElementById('art-content') as HTMLTextAreaElement | null;
  if (artContentArea) {
    const text = artContentArea.value.trim();
    const count = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const readMin = Math.max(1, Math.ceil(count / 200));
    const wcEl = document.getElementById('art-word-count');
    const reEl = document.getElementById('art-read-estimate');
    if (wcEl) wcEl.textContent = `${count} words`;
    if (reEl) reEl.textContent = `~${readMin} min read`;
  }
}

// --------------------------------------------------------------------------
// Mobile Menu Management
// --------------------------------------------------------------------------
export function closeMobileMenu() {
  const nav = document.getElementById('nv');
  const mb = document.getElementById('mb');
  if (nav?.classList.contains('open')) {
    nav.classList.remove('open');
    mb?.setAttribute('aria-expanded', 'false');
  }
}

// --------------------------------------------------------------------------
// Global Event Handlers
// --------------------------------------------------------------------------
document.addEventListener('click', async (e) => {
  // 1. Auto-close mobile navigation drawer on any navigation link click (#nv a or .mob-strip a)
  if ((e.target as HTMLElement).closest('#nv a, .mob-strip a')) {
    closeMobileMenu();
  }

  // 2. Auto-close mobile nav if user tapped outside #nv and #mb while open
  const openNav = document.getElementById('nv');
  if (openNav?.classList.contains('open')) {
    const clickedInside = (e.target as HTMLElement).closest('#nv, #mb');
    if (!clickedInside) {
      closeMobileMenu();
    }
  }

  // Clear search input button (#q-clr)
  const clrBtn = (e.target as HTMLElement).closest('#q-clr, [data-a="clr-q"]') as HTMLElement;
  if (clrBtn) {
    const qInput = document.getElementById('q') as HTMLInputElement;
    if (qInput) {
      qInput.value = '';
      const qClr = document.getElementById('q-clr');
      if (qClr) qClr.style.display = 'none';
      qInput.focus();
      const route = parseRoute();
      if (route.root === 'search') {
        window.history.pushState(null, '', '/');
        draw(true);
      }
    }
    return;
  }

  // Open Link Modal buttons
  const openLinkBtn = (e.target as HTMLElement).closest('#art-btn-open-link, #art-btn-open-prod-link') as HTMLElement | null;
  if (openLinkBtn) {
    const isProd = openLinkBtn.id === 'art-btn-open-prod-link' || openLinkBtn.closest('#art-btn-open-prod-link') !== null;
    const contentArea = document.getElementById('art-content') as HTMLTextAreaElement | null;
    if (contentArea) {
      artLinkSelectionStart = contentArea.selectionStart;
      artLinkSelectionEnd = contentArea.selectionEnd;
      const selected = contentArea.value.substring(artLinkSelectionStart, artLinkSelectionEnd).trim();
      const textInput = document.getElementById('art-modal-link-text') as HTMLInputElement | null;
      const urlInput = document.getElementById('art-modal-link-url') as HTMLInputElement | null;
      const prodSelect = document.getElementById('art-modal-prod-select') as HTMLSelectElement | null;
      const errBox = document.getElementById('art-modal-link-error');

      if (textInput) textInput.value = selected;
      if (urlInput) urlInput.value = '';
      if (prodSelect) prodSelect.value = '';
      if (errBox) errBox.style.display = 'none';

      const modal = document.getElementById('art-link-modal');
      if (modal) {
        modal.style.display = 'grid';
        if (isProd && prodSelect) {
          prodSelect.focus();
        } else if (selected && urlInput) {
          urlInput.focus();
        } else if (textInput) {
          textInput.focus();
        }
      }
    }
    return;
  }

  // Close Link Modal (via close button, cancel button, or backdrop click)
  if ((e.target as HTMLElement).closest('#art-link-modal-close, #art-modal-cancel-btn') || (e.target as HTMLElement).id === 'art-link-modal') {
    const modal = document.getElementById('art-link-modal');
    if (modal) modal.style.display = 'none';
    const contentArea = document.getElementById('art-content') as HTMLTextAreaElement | null;
    contentArea?.focus();
    return;
  }

  // Insert Link from Modal
  if ((e.target as HTMLElement).closest('#art-modal-insert-btn')) {
    const textInput = document.getElementById('art-modal-link-text') as HTMLInputElement | null;
    const urlInput = document.getElementById('art-modal-link-url') as HTMLInputElement | null;
    const errBox = document.getElementById('art-modal-link-error');

    const anchorText = (textInput?.value || '').trim();
    let url = (urlInput?.value || '').trim();

    if (!anchorText || !url) {
      if (errBox) {
        errBox.textContent = 'Please enter both the anchor text and a valid link URL.';
        errBox.style.display = 'block';
      }
      return;
    }

    if (!/^https?:\/\//i.test(url) && !url.startsWith('#') && !url.startsWith('/')) {
      url = 'https://' + url;
    }

    const contentArea = document.getElementById('art-content') as HTMLTextAreaElement | null;
    if (contentArea) {
      const linkMarkdown = `[${anchorText}](${url})`;
      contentArea.setRangeText(linkMarkdown, artLinkSelectionStart, artLinkSelectionEnd, 'end');
      contentArea.focus();
      contentArea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const modal = document.getElementById('art-link-modal');
    if (modal) modal.style.display = 'none';
    announce(`Link inserted: ${anchorText}`);
    return;
  }

  // Write vs Live Preview mode tabs
  if ((e.target as HTMLElement).closest('#art-mode-preview')) {
    const writeBtn = document.getElementById('art-mode-write');
    const prevBtn = document.getElementById('art-mode-preview');
    const writePane = document.getElementById('art-write-container');
    const prevPane = document.getElementById('art-preview-pane');
    const contentArea = document.getElementById('art-content') as HTMLTextAreaElement | null;

    if (writeBtn && prevBtn && writePane && prevPane && contentArea) {
      writeBtn.style.background = 'var(--sf)';
      writeBtn.style.color = 'var(--tx)';
      prevBtn.style.background = 'var(--wn)';
      prevBtn.style.color = '#fff';
      writePane.style.display = 'none';
      prevPane.style.display = 'block';
      const renderedHtml = parseMarkdownToHtml(contentArea.value);
      prevPane.innerHTML = renderedHtml || '<div class="mu" style="font-style:italic">Your article story is currently empty. Switch back to Write mode to type or paste your content!</div>';
    }
    return;
  }

  if ((e.target as HTMLElement).closest('#art-mode-write')) {
    const writeBtn = document.getElementById('art-mode-write');
    const prevBtn = document.getElementById('art-mode-preview');
    const writePane = document.getElementById('art-write-container');
    const prevPane = document.getElementById('art-preview-pane');

    if (writeBtn && prevBtn && writePane && prevPane) {
      prevBtn.style.background = 'var(--sf)';
      prevBtn.style.color = 'var(--tx)';
      writeBtn.style.background = 'var(--wn)';
      writeBtn.style.color = '#fff';
      prevPane.style.display = 'none';
      writePane.style.display = 'block';
      const contentArea = document.getElementById('art-content') as HTMLTextAreaElement | null;
      contentArea?.focus();
    }
    return;
  }

  // Toggle Custom Slug URL field
  if ((e.target as HTMLElement).closest('#art-toggle-slug-btn')) {
    const wrap = document.getElementById('art-slug-wrap');
    if (wrap) {
      wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
      if (wrap.style.display === 'block') {
        (document.getElementById('art-slug') as HTMLInputElement)?.focus();
      }
    }
    return;
  }

  // Article Markdown Toolbar action buttons
  const artBtn = (e.target as HTMLElement).closest('[data-art-action]') as HTMLElement;
  if (artBtn) {
    const action = artBtn.dataset.artAction;
    const contentArea = document.getElementById('art-content') as HTMLTextAreaElement;
    if (contentArea) {
      const start = contentArea.selectionStart;
      const end = contentArea.selectionEnd;
      const selected = contentArea.value.substring(start, end);

      if (action === 'link') {
        // Redirect to the rich Link Modal
        artLinkSelectionStart = start;
        artLinkSelectionEnd = end;
        const textInput = document.getElementById('art-modal-link-text') as HTMLInputElement | null;
        const urlInput = document.getElementById('art-modal-link-url') as HTMLInputElement | null;
        const errBox = document.getElementById('art-modal-link-error');
        if (textInput) textInput.value = selected;
        if (urlInput) urlInput.value = '';
        if (errBox) errBox.style.display = 'none';
        const modal = document.getElementById('art-link-modal');
        if (modal) {
          modal.style.display = 'grid';
          if (selected && urlInput) urlInput.focus();
          else if (textInput) textInput.focus();
        }
        return;
      }

      let replacement = '';
      if (action === 'bold') replacement = `**${selected || 'bold text'}**`;
      else if (action === 'italic') replacement = `*${selected || 'italic text'}*`;
      else if (action === 'h2') replacement = `\n\n## ${selected || 'Subheading'}\n`;
      else if (action === 'h3') replacement = `\n\n### ${selected || 'Topic Heading'}\n`;
      else if (action === 'list') replacement = `\n- ${selected || 'First point'}\n- Second point`;
      else if (action === 'quote') replacement = `\n> ${selected || 'Key takeaway or quote'}\n`;
      else if (action === 'disclosure') replacement = `\n> *Affiliate Disclosure: Devtosh SuperBazaar independently curates products. When you buy through our links, we may earn an affiliate commission at no extra cost to you.*\n`;

      contentArea.setRangeText(replacement, start, end, 'end');
      contentArea.focus();
    }
    return;
  }

  // Article Slug Sync Button
  if ((e.target as HTMLElement).id === 'art-slug-sync' || (e.target as HTMLElement).closest('#art-slug-sync')) {
    const titleVal = (document.getElementById('art-title') as HTMLInputElement)?.value || '';
    const slugInput = document.getElementById('art-slug') as HTMLInputElement;
    if (slugInput && titleVal) {
      slugInput.value = generateArticleSlug(titleVal);
      announce('Article URL slug refreshed');
    }
    return;
  }

  // Article SEO Sync Button
  if ((e.target as HTMLElement).id === 'art-seo-sync' || (e.target as HTMLElement).closest('#art-seo-sync')) {
    const titleVal = (document.getElementById('art-title') as HTMLInputElement)?.value.trim() || '';
    const excerptVal = (document.getElementById('art-excerpt') as HTMLTextAreaElement)?.value.trim() || '';
    const coverVal = (document.getElementById('art-cover') as HTMLInputElement)?.value.trim() || '';
    const metaTitleInput = document.getElementById('art-meta-title') as HTMLInputElement;
    const metaDescInput = document.getElementById('art-meta-desc') as HTMLTextAreaElement;
    const ogTitleInput = document.getElementById('art-og-title') as HTMLInputElement;
    const ogDescInput = document.getElementById('art-og-desc') as HTMLTextAreaElement;
    const ogImgInput = document.getElementById('art-og-img') as HTMLInputElement;

    if (metaTitleInput && !metaTitleInput.value && titleVal) {
      metaTitleInput.value = titleVal;
      metaTitleInput.dispatchEvent(new Event('input'));
    }
    if (metaDescInput && !metaDescInput.value && excerptVal) {
      metaDescInput.value = excerptVal.slice(0, 155);
      metaDescInput.dispatchEvent(new Event('input'));
    }
    if (ogTitleInput && !ogTitleInput.value && titleVal) {
      ogTitleInput.value = titleVal;
    }
    if (ogDescInput && !ogDescInput.value && excerptVal) {
      ogDescInput.value = excerptVal.slice(0, 155);
    }
    if (ogImgInput && !ogImgInput.value && coverVal) {
      ogImgInput.value = coverVal;
    }
    announce('SEO and social card metadata populated');
    return;
  }

  const target = (e.target as HTMLElement).closest('[data-a]') as HTMLElement;
  if (!target) return;

  const a = target.dataset.a;
  const v = target.dataset.v || '';
  const k = target.dataset.k || '';
  const id = target.dataset.id || '';

  // Skip link
  if (a === 'skip') {
    document.getElementById('app')?.focus();
  }
  // Mobile Nav toggle
  else if (a === 'mb') {
    const nav = document.getElementById('nv');
    const isOpen = nav?.classList.toggle('open');
    target.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }
  // Wishlist toggle
  else if (a === 'wl') {
    const slug = target.dataset.s || '';
    const added = store.toggleWishlist(slug);
    announce(added ? 'Saved to wishlist' : 'Removed from wishlist');
    draw();
  }
  // Load more
  else if (a === 'more') {
    store.filters.n += 8;
    draw();
    announce('Loaded more products');
  }
  // Clear filters
  else if (a === 'clr') {
    store.filters.brand = [];
    store.filters.cat = [];
    store.filters.size = [];
    store.filters.col = [];
    store.filters.price = [];
    store.filters.disc = 0;
    store.filters.min = 0;
    store.filters.max = 0;
    store.filters.n = 8;
    draw();
    announce('All filters cleared');
  }
  // Mobile filter drawer toggle
  else if (a === 'fb') {
    store.filters.mobileFiltersOpen = !store.filters.mobileFiltersOpen;
    draw();
  }
  // Category quick filter
  else if (a === 'cat') {
    store.filters.cat = [v];
    store.filters.n = 8;
    draw();
  }
  // Remove individual filter chip
  else if (a === 'rm') {
    if (k === 'disc') store.filters.disc = 0;
    else if (k === 'mm') { store.filters.min = 0; store.filters.max = 0; }
    else if (k === 'price') {
      const idx = store.filters.price.indexOf(Number(v));
      if (idx > -1) store.filters.price.splice(idx, 1);
    } else {
      const arr = (store.filters as any)[k];
      if (Array.isArray(arr)) {
        const idx = arr.indexOf(v);
        if (idx > -1) arr.splice(idx, 1);
      }
    }
    store.filters.n = 8;
    draw();
  }
  // Apply custom price range
  else if (a === 'pa') {
    const minEl = document.getElementById('pmin') as HTMLInputElement;
    const maxEl = document.getElementById('pmax') as HTMLInputElement;
    let minVal = Math.max(0, Number(minEl?.value || 0));
    let maxVal = Math.max(0, Number(maxEl?.value || 0));
    if (maxVal > 0 && minVal > maxVal) {
      const t = minVal;
      minVal = maxVal;
      maxVal = t;
    }
    store.filters.min = minVal;
    store.filters.max = maxVal;
    store.filters.n = 8;
    draw();
  }
  // Admin Logout
  else if (a === 'adm-logout') {
    await signOut(auth);
    store.currentUser = null;
    store.isAdmin = false;
    location.hash = '#/admin/login';
    draw();
  }
  // Toggle Publish / Unpublish in Admin
  else if (a === 'adm-toggle-pub') {
    const shouldPub = target.dataset.val === 'true';
    try {
      await updateDoc(doc(db, 'products', id), {
        published: shouldPub,
        updatedAt: new Date().toISOString()
      });
      await loadAdminProducts();
      await loadPublicProducts();
      announce(shouldPub ? 'Product published to live store' : 'Product set to draft');
      draw();
    } catch (err: any) {
      alert('Error updating status in Cloud Firestore: ' + (err?.message || err));
    }
  }
  // Delete Product in Admin
  else if (a === 'adm-del-prod') {
    const name = target.dataset.name || 'this product';
    if (confirm(`Are you sure you want to delete "${name}"? This action removes the item from Cloud Firestore.`)) {
      try {
        await deleteDoc(doc(db, 'products', id));
        await loadAdminProducts();
        await loadPublicProducts();
        announce('Product deleted from Firestore');
        draw();
      } catch (err: any) {
        alert('Error deleting product from Firestore: ' + (err?.message || err));
      }
    }
  }
  // Toggle Publish / Unpublish Article in Admin
  else if (a === 'adm-toggle-art-pub') {
    const shouldPub = target.dataset.val === 'true';
    try {
      await updateDoc(doc(db, 'articles', id), {
        published: shouldPub,
        updatedAt: new Date().toISOString()
      });
      await loadAdminArticles();
      await loadPublicArticles();
      announce(shouldPub ? 'Article published to live blog' : 'Article set to draft');
      draw();
    } catch (err: any) {
      alert('Error updating article status in Cloud Firestore: ' + (err?.message || err));
    }
  }
  // Delete Article in Admin
  else if (a === 'adm-del-art') {
    const title = target.dataset.title || 'this article';
    if (confirm(`Are you sure you want to delete "${title}"? This action permanently removes the article from Cloud Firestore.`)) {
      try {
        await deleteDoc(doc(db, 'articles', id));
        await loadAdminArticles();
        await loadPublicArticles();
        announce('Article deleted from Firestore');
        draw();
      } catch (err: any) {
        alert('Error deleting article from Firestore: ' + (err?.message || err));
      }
    }
  }
  // Clone / Duplicate Product in Admin
  else if (a === 'adm-clone-prod') {
    const prodId = target.dataset.id || id;
    const orig = store.adminProducts.find(p => p.id === prodId) || store.products.find(p => p.id === prodId);
    if (orig) {
      store.adminCloneSource = {
        ...orig,
        id: '', // New ID will be assigned
        name: `${orig.name} (Copy)`,
        slug: `${orig.slug}-copy`,
        published: false
      };
      location.hash = '#/admin/products/new';
      draw();
    }
  }
  // Re-check admin authorization in Firestore
  else if (a === 'adm-recheck') {
    if (store.currentUser) {
      announce('Checking authorization…');
      store.isAdmin = await checkAdminStatus(store.currentUser);
      if (store.isAdmin) {
        await loadAdminProducts();
        location.hash = '#/admin/dashboard';
      } else {
        alert('Your UID is not yet registered in the Firestore "admins" collection. Please verify that you created the document with your exact UID in Firebase Console, then click Re-check.');
      }
      draw();
    }
  }
  // Copy UID helper for ease of Firebase Console configuration
  else if (a === 'copy-uid') {
    const uid = target.dataset.uid || '';
    if (uid) {
      navigator.clipboard.writeText(uid).then(() => {
        announce('UID copied to clipboard');
        const prevText = target.textContent;
        target.textContent = 'Copied!';
        setTimeout(() => { target.textContent = prevText; }, 2000);
      }).catch(() => {
        alert('Your UID is: ' + uid);
      });
    }
  }
  // Copy Product Link to clipboard
  else if (a === 'copy-prod-link') {
    const url = target.dataset.url || window.location.href;
    const textSpan = target.querySelector('.cp-text') || target;
    const orig = textSpan.textContent;
    try {
      await navigator.clipboard.writeText(url);
      textSpan.textContent = 'Copied!';
      announce('Product link copied to clipboard');
      setTimeout(() => {
        textSpan.textContent = orig;
      }, 2000);
    } catch {
      announce('Product link: ' + url);
    }
  }
});

// Checkbox and select change listeners
document.addEventListener('change', (e) => {
  const target = e.target as HTMLElement;
  const a = target.dataset.a;

  if (a === 'f') {
    const k = target.dataset.k as keyof typeof store.filters;
    const v = target.dataset.v || '';
    const isChecked = (target as HTMLInputElement).checked;

    if (k === 'disc') {
      store.filters.disc = isChecked ? Number(v) : 0;
    } else if (k === 'price') {
      const num = Number(v);
      const idx = store.filters.price.indexOf(num);
      if (isChecked && idx < 0) store.filters.price.push(num);
      if (!isChecked && idx > -1) store.filters.price.splice(idx, 1);
    } else {
      const arr = store.filters[k] as string[];
      if (Array.isArray(arr)) {
        const idx = arr.indexOf(v);
        if (isChecked && idx < 0) arr.push(v);
        if (!isChecked && idx > -1) arr.splice(idx, 1);
      }
    }
    store.filters.n = 8;
    draw();
  } else if (a === 'sort') {
    store.filters.sort = (target as HTMLSelectElement).value;
    store.filters.n = 8;
    draw();
  }
});

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// Search & Admin Filter Input Listeners
document.addEventListener('input', (e) => {
  const target = e.target as HTMLElement;

  if (target.id === 'q') {
    const val = (target as HTMLInputElement).value;
    const qClr = document.getElementById('q-clr') as HTMLElement;
    if (qClr) {
      qClr.style.display = val.trim() ? 'grid' : 'none';
    }
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      const trimmed = val.trim();
      if (trimmed) {
        const nextHash = `#/search?q=${encodeURIComponent(trimmed)}`;
        if (location.hash !== nextHash) {
          location.hash = nextHash;
        }
      } else {
        const route = parseRoute();
        if (route.root === 'search') {
          location.hash = '#/home';
        }
      }
    }, 200);
    return;
  }

  if (target.id === 'adm-prod-q') {
    store.adminFilter.q = (target as HTMLInputElement).value;
    draw();
  }

  if (target.id === 'adm-art-q') {
    store.adminBlogFilter.q = (target as HTMLInputElement).value;
    draw();
  }

  if (target.id === 'art-meta-desc') {
    const val = (target as HTMLTextAreaElement).value;
    const counter = document.getElementById('art-desc-counter');
    if (counter) {
      counter.textContent = `${val.length} / 160 characters (recommended: 140–160)`;
      counter.style.color = (val.length >= 120 && val.length <= 165) ? '#2E7D32' : (val.length > 165 ? '#C62828' : 'var(--mu)');
    }
  }

  if (target.id === 'art-meta-title') {
    const val = (target as HTMLInputElement).value;
    const counter = document.getElementById('art-title-counter');
    if (counter) {
      counter.textContent = `${val.length} / 60 characters (recommended: 50–60)`;
      counter.style.color = (val.length >= 40 && val.length <= 65) ? '#2E7D32' : (val.length > 65 ? '#C62828' : 'var(--mu)');
    }
  }

  if (target.id === 'art-title') {
    const titleVal = (target as HTMLInputElement).value;
    const slugInput = document.getElementById('art-slug') as HTMLInputElement;
    const isNew = !(document.getElementById('art-id') as HTMLInputElement)?.value;
    if (slugInput && (isNew || !slugInput.value)) {
      slugInput.value = generateArticleSlug(titleVal);
    }
    const previewEl = document.getElementById('art-slug-preview-text');
    if (previewEl) {
      previewEl.textContent = `https://devtoshsuperbazaar.github.io/blog/${slugInput?.value || generateArticleSlug(titleVal)}/`;
    }
  }

  if (target.id === 'art-slug') {
    const slugVal = (target as HTMLInputElement).value.trim();
    const previewEl = document.getElementById('art-slug-preview-text');
    if (previewEl) {
      previewEl.textContent = `https://devtoshsuperbazaar.github.io/blog/${slugVal || 'article-slug'}/`;
    }
  }

  if (target.id === 'art-content') {
    const text = (target as HTMLTextAreaElement).value.trim();
    const count = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const readMin = Math.max(1, Math.ceil(count / 200));
    const wcEl = document.getElementById('art-word-count');
    const reEl = document.getElementById('art-read-estimate');
    if (wcEl) wcEl.textContent = `${count} words`;
    if (reEl) reEl.textContent = `~${readMin} min read`;
  }

  if (target.id === 'art-cover') {
    const url = (target as HTMLInputElement).value.trim();
    const box = document.getElementById('art-cover-preview-box');
    if (box) {
      if (url) {
        box.innerHTML = `<img src="${esc(url)}" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='<span style=\\'font-size:10px;color:#c62828\\'>Invalid img</span>'" />`;
      } else {
        box.innerHTML = '<span class="mu" style="font-size:11px;text-align:center;padding:4px">Photo Preview</span>';
      }
    }
  }
});

// Continuously keep active text selection range in sync
document.addEventListener('selectionchange', () => {
  const contentArea = document.getElementById('art-content') as HTMLTextAreaElement | null;
  if (contentArea && document.activeElement === contentArea) {
    artLinkSelectionStart = contentArea.selectionStart;
    artLinkSelectionEnd = contentArea.selectionEnd;
  }
});

document.addEventListener('change', (e) => {
  const target = e.target as HTMLElement;

  if (target.id === 'art-modal-prod-select') {
    const sel = target as HTMLSelectElement;
    const opt = sel.selectedOptions[0];
    const urlInput = document.getElementById('art-modal-link-url') as HTMLInputElement | null;
    const textInput = document.getElementById('art-modal-link-text') as HTMLInputElement | null;
    if (urlInput && sel.value) {
      urlInput.value = sel.value;
    }
    if (textInput && (!textInput.value.trim() || textInput.value === 'link text') && opt?.dataset.name) {
      textInput.value = opt.dataset.name;
    }
    const err = document.getElementById('art-modal-link-error');
    if (err) err.style.display = 'none';
  }

  if ((target as HTMLInputElement).name === 'art-status-radio') {
    const radios = document.querySelectorAll('input[name="art-status-radio"]');
    radios.forEach(r => {
      const lbl = r.closest('label') as HTMLElement | null;
      if (lbl) {
        if ((r as HTMLInputElement).checked) {
          lbl.style.background = 'var(--bl)';
          lbl.style.borderColor = 'var(--wn)';
          lbl.style.color = 'var(--tx)';
        } else {
          lbl.style.background = 'var(--sf)';
          lbl.style.borderColor = 'var(--bd)';
          lbl.style.color = 'var(--tx)';
        }
      }
    });
  }
  if (target.id === 'adm-filter-status') {
    store.adminFilter.status = (target as HTMLSelectElement).value;
    draw();
  } else if (target.id === 'adm-filter-cat') {
    store.adminFilter.cat = (target as HTMLSelectElement).value;
    draw();
  } else if (target.id === 'adm-sort') {
    store.adminSort = (target as HTMLSelectElement).value;
    draw();
  } else if (target.id === 'adm-filter-art-status') {
    store.adminBlogFilter.status = (target as HTMLSelectElement).value;
    draw();
  } else if (target.id === 'adm-filter-art-cat') {
    store.adminBlogFilter.category = (target as HTMLSelectElement).value;
    draw();
  } else if (target.id === 'adm-art-sort') {
    store.adminBlogSort = (target as HTMLSelectElement).value;
    draw();
  }
});

// Form Submissions (Login, Product Save, Settings, Search)
document.addEventListener('submit', async (e) => {
  const form = e.target as HTMLFormElement;

  // Search submission
  if (form.id === 'sf') {
    e.preventDefault();
    const qInput = document.getElementById('q') as HTMLInputElement;
    const val = (qInput?.value || '').trim();
    if (val) {
      location.hash = `#/search?q=${encodeURIComponent(val)}`;
    }
  }

  // Admin login submission via Firebase Authentication
  else if (form.id === 'adm-login-form') {
    e.preventDefault();
    const email = (document.getElementById('adm-email') as HTMLInputElement).value.trim();
    const pass = (document.getElementById('adm-pass') as HTMLInputElement).value;
    const submitBtn = document.getElementById('adm-login-submit') as HTMLButtonElement;

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying credentials…';
      store.adminError = '';

      const cred = await signInWithEmailAndPassword(auth, email, pass);
      store.currentUser = cred.user;
      store.isAdmin = await checkAdminStatus(cred.user);

      if (store.isAdmin) {
        await loadAdminProducts();
        location.hash = '#/admin/dashboard';
      } else {
        store.adminError = `Account authenticated, but UID (${cred.user.uid}) is not on the admin allowlist.`;
      }
      draw();
    } catch (err: any) {
      const code = err?.code || '';
      const msg = err?.message || String(err);
      if (code === 'auth/api-key-not-valid' || msg.includes('api-key-not-valid') || msg.includes('API key not valid')) {
        store.adminApiKeyError = true;
        store.adminError = 'Firebase Authentication rejected the current Web API Key ("auth/api-key-not-valid"). The configured API key has 38 characters instead of 39 characters required by Google (one character was truncated when copied from the Firebase Console), or has API restrictions enabled in Google Cloud Console.';
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        store.adminApiKeyError = false;
        store.adminError = 'Invalid email or password. Please double check your credentials and try again.';
      } else if (code === 'auth/user-not-found') {
        store.adminApiKeyError = false;
        store.adminError = 'No user account found with this email. Please create your administrator account in the Firebase Console first.';
      } else if (code === 'auth/invalid-email') {
        store.adminApiKeyError = false;
        store.adminError = 'Please enter a valid email address.';
      } else if (code === 'auth/user-disabled') {
        store.adminApiKeyError = false;
        store.adminError = 'This administrator account has been disabled in the Firebase Console.';
      } else if (code === 'auth/too-many-requests') {
        store.adminApiKeyError = false;
        store.adminError = 'Access to this account has been temporarily disabled due to multiple failed login attempts. Please wait a moment and try again.';
      } else if (code === 'auth/operation-not-allowed') {
        store.adminApiKeyError = false;
        store.adminError = 'Email/Password sign-in is not enabled in Firebase Console. Please go to Authentication > Sign-in method and enable Email/Password.';
      } else if (code === 'auth/network-request-failed') {
        store.adminApiKeyError = false;
        store.adminError = 'Network error: Unable to connect to Firebase. Please verify your internet connection.';
      } else {
        store.adminApiKeyError = false;
        store.adminError = err?.message || 'Authentication failed. Please verify your credentials.';
      }
      draw();
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to Dashboard';
      }
    }
  }

  // Product Create/Edit Form submission to Cloud Firestore
  else if (form.id === 'product-edit-form') {
    e.preventDefault();
    const existingId = (document.getElementById('p-id') as HTMLInputElement).value;
    const name = (document.getElementById('p-name') as HTMLInputElement).value.trim();
    const slug = (document.getElementById('p-slug') as HTMLInputElement).value.trim().toLowerCase();
    const brand = (document.getElementById('p-brand') as HTMLInputElement).value.trim();
    const cat = (document.getElementById('p-cat') as HTMLInputElement).value.trim();
    const price = Number((document.getElementById('p-price') as HTMLInputElement).value || 0);
    const mrp = Number((document.getElementById('p-mrp') as HTMLInputElement).value || 0);
    const col = (document.getElementById('p-col') as HTMLInputElement).value.trim();
    const sizes = (document.getElementById('p-sizes') as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean);
    const desc = (document.getElementById('p-desc') as HTMLTextAreaElement).value.trim();
    const imgUrl = (document.getElementById('p-img') as HTMLInputElement).value.trim();
    const ret = (document.getElementById('p-ret') as HTMLInputElement).value.trim();
    const retUrl = (document.getElementById('p-returl') as HTMLInputElement).value.trim();
    const affUrl = (document.getElementById('p-affurl') as HTMLInputElement).value.trim();
    const published = (document.getElementById('p-published') as HTMLInputElement).checked;
    const featured = (document.getElementById('p-featured') as HTMLInputElement).checked;

    const id = existingId || `${slug}-${Date.now().toString(36)}`;

    const prodPayload: Partial<Product> = {
      name,
      slug,
      brand,
      cat,
      price,
      mrp,
      currency: 'INR',
      col,
      sizes,
      desc,
      imgUrl,
      ret,
      retUrl,
      affUrl,
      published,
      featured,
      updatedAt: new Date().toISOString()
    };

    try {
      const submitBtn = document.getElementById('p-submit-btn') as HTMLButtonElement;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving to Firestore…';

      const now = new Date().toISOString();
      const saveObj: any = {
        ...prodPayload,
        updatedAt: now
      };
      if (!existingId) {
        saveObj.createdAt = now;
      }

      await setDoc(doc(db, 'products', id), saveObj, { merge: true });

      store.adminCloneSource = null;
      await loadAdminProducts();
      await loadPublicProducts();

      announce(`Product "${name}" saved to Cloud Firestore!`);
      location.hash = '#/admin/products';
      draw();
    } catch (err: any) {
      alert('Error saving to Cloud Firestore: ' + (err?.message || err));
      const submitBtn = document.getElementById('p-submit-btn') as HTMLButtonElement;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = existingId ? 'Save Changes to Firestore' : 'Create & Publish';
      }
    }
  }

  // Site Settings Form
  else if (form.id === 'settings-form') {
    e.preventDefault();
    store.settings.announcement = (document.getElementById('set-announcement') as HTMLTextAreaElement).value;
    store.settings.disclosure = (document.getElementById('set-disclosure') as HTMLTextAreaElement).value;
    store.settings.contactHandle = (document.getElementById('set-handle') as HTMLInputElement).value;

    try {
      await setDoc(doc(db, 'settings', 'general'), store.settings);
      announce('Site settings updated in Cloud Firestore!');
      draw();
    } catch (err: any) {
      alert('Settings error: ' + (err?.message || err));
    }
  }

  // Blog Article Create/Edit Form Submission to Cloud Firestore
  else if (form.id === 'article-edit-form') {
    e.preventDefault();
    const existingId = (document.getElementById('art-id') as HTMLInputElement)?.value || '';
    const title = (document.getElementById('art-title') as HTMLInputElement)?.value.trim() || '';
    let slug = (document.getElementById('art-slug') as HTMLInputElement)?.value.trim().toLowerCase() || '';
    if (!slug) slug = generateArticleSlug(title);
    const seoTitle = (document.getElementById('art-meta-title') as HTMLInputElement)?.value.trim() || title;
    const metaDesc = (document.getElementById('art-meta-desc') as HTMLTextAreaElement)?.value.trim() || '';
    const excerpt = (document.getElementById('art-excerpt') as HTMLTextAreaElement)?.value.trim() || '';
    const content = (document.getElementById('art-content') as HTMLTextAreaElement)?.value.trim() || '';
    const authorName = (document.getElementById('art-author') as HTMLInputElement)?.value.trim() || 'Devtosh SuperBazaar Editorial Team';
    const authorUrl = (document.getElementById('art-author-url') as HTMLInputElement)?.value.trim() || undefined;
    const coverImage = (document.getElementById('art-cover') as HTMLInputElement)?.value.trim() || '';
    const coverAlt = (document.getElementById('art-cover-alt') as HTMLInputElement)?.value.trim() || title;
    const category = (document.getElementById('art-category') as HTMLInputElement)?.value.trim() || 'Shopping Guides';
    const tags = ((document.getElementById('art-tags') as HTMLInputElement)?.value || '').split(',').map(s => s.trim()).filter(Boolean);
    const statusRadio = document.querySelector('input[name="art-status-radio"]:checked') as HTMLInputElement | null;
    const published = statusRadio ? statusRadio.value === 'published' : true;
    const noIndex = (document.getElementById('art-noindex') as HTMLInputElement)?.checked ?? false;
    const canonicalOverride = (document.getElementById('art-canonical') as HTMLInputElement)?.value.trim() || undefined;
    const ogTitle = (document.getElementById('art-og-title') as HTMLInputElement)?.value.trim() || undefined;
    const ogDescription = (document.getElementById('art-og-desc') as HTMLTextAreaElement)?.value.trim() || undefined;
    const ogImage = (document.getElementById('art-og-img') as HTMLInputElement)?.value.trim() || undefined;
    const affiliateDisclosure = (document.getElementById('art-aff-disclosure') as HTMLInputElement)?.checked ?? true;

    const checkedBoxes = Array.from(document.querySelectorAll('.art-rel-prod-cb:checked')) as HTMLInputElement[];
    const relatedProducts: ArticleRelatedProduct[] = checkedBoxes.map(cb => {
      const pid = cb.value;
      const p = store.adminProducts.find(item => item.id === pid) || store.products.find(item => item.id === pid);
      return {
        id: pid,
        name: cb.dataset.name || p?.name || 'Curated Product',
        price: Number(cb.dataset.price || p?.price || 0),
        affUrl: cb.dataset.url || p?.affUrl || p?.retUrl || '',
        imgUrl: cb.dataset.img || p?.imgUrl || '',
        ret: cb.dataset.ret || p?.ret || 'Partner Retailer'
      };
    });

    const candidate: Partial<Article> = {
      id: existingId,
      title,
      slug,
      metaTitle: seoTitle,
      metaDesc,
      excerpt,
      content,
      authorName,
      authorUrl,
      coverImage,
      coverImageAlt: coverAlt,
      category,
      tags,
      published,
      noindex: noIndex,
      canonicalUrl: canonicalOverride,
      ogTitle,
      ogDesc: ogDescription,
      ogImage,
      hasAffiliateLinks: affiliateDisclosure,
      readTimeMinutes: calculateReadTime(content),
      relatedProducts
    };

    const validation = validateArticle(candidate, store.adminArticles, existingId);
    const errBox = document.getElementById('art-form-errors');
    if (!validation.valid) {
      if (errBox) {
        errBox.style.display = 'block';
        errBox.innerHTML = `
          <div style="background:#FDF5F5;border:1px solid #EACBCB;border-left:4px solid var(--wn);padding:14px 18px;border-radius:4px;margin-bottom:18px;color:#4D2225">
            <strong style="display:block;margin-bottom:6px">Please resolve the following before publishing:</strong>
            <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6">
              ${validation.errors.map(err => `<li>${esc(err)}</li>`).join('')}
            </ul>
          </div>
        `;
        errBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        alert(validation.errors.join('\n'));
      }
      return;
    }

    const id = existingId || `${slug}-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const saveObj: any = {
      ...candidate,
      id,
      updatedAt: now
    };
    if (!existingId) {
      saveObj.publishedAt = now;
      saveObj.createdAt = now;
    }

    try {
      const submitBtn = document.getElementById('art-submit-btn') as HTMLButtonElement;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving Article to Firestore…';
      }

      await setDoc(doc(db, 'articles', id), saveObj, { merge: true });
      await loadAdminArticles();
      await loadPublicArticles();

      announce(`Article "${title}" saved to Cloud Firestore!`);
      location.hash = '#/admin/articles';
      draw();
    } catch (err: any) {
      alert('Error saving article to Cloud Firestore: ' + (err?.message || err));
      const submitBtn = document.getElementById('art-submit-btn') as HTMLButtonElement;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = existingId ? 'Save Article' : 'Publish Article';
      }
    }
  }
});

// Auto-extract and Admin click handlers
document.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;

  // Auto-extract from Meesho or any Retailer Link or pasted specifications
  if (target.id === 'import-btn' || target.id === 'import-text-btn') {
    const urlInput = document.getElementById('import-url') as HTMLInputElement;
    const textInput = document.getElementById('import-text') as HTMLTextAreaElement;
    const statusDiv = document.getElementById('import-status');
    const urlStr = urlInput?.value.trim() || '';
    const textStr = textInput?.value.trim() || '';

    if (!urlStr && !textStr) {
      if (statusDiv) {
        statusDiv.innerHTML = '<span style="color:#C62828;font-weight:600">Please paste a Meesho / retailer link or specifications text first.</span>';
      }
      return;
    }

    const btn = target as HTMLButtonElement;
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Extracting product data…';
    if (statusDiv) {
      statusDiv.innerHTML = '<span style="color:#5E35B1;font-weight:600">⚡ Extracting from Meesho &amp; analyzing metadata…</span>';
    }

    try {
      const extracted = await extractProductDetails(urlStr, textStr);

      const nameInput = document.getElementById('p-name') as HTMLInputElement;
      const slugInput = document.getElementById('p-slug') as HTMLInputElement;
      const brandInput = document.getElementById('p-brand') as HTMLInputElement;
      const catInput = document.getElementById('p-cat') as HTMLInputElement;
      const priceInput = document.getElementById('p-price') as HTMLInputElement;
      const mrpInput = document.getElementById('p-mrp') as HTMLInputElement;
      const colInput = document.getElementById('p-col') as HTMLInputElement;
      const sizesInput = document.getElementById('p-sizes') as HTMLInputElement;
      const descInput = document.getElementById('p-desc') as HTMLTextAreaElement;
      const imgInput = document.getElementById('p-img') as HTMLInputElement;
      const retInput = document.getElementById('p-ret') as HTMLInputElement;
      const retUrlInput = document.getElementById('p-returl') as HTMLInputElement;

      if (nameInput && extracted.name) nameInput.value = extracted.name;
      if (slugInput && extracted.slug) slugInput.value = extracted.slug;
      if (brandInput && extracted.brand) brandInput.value = extracted.brand;
      if (catInput && extracted.cat) catInput.value = extracted.cat;
      if (priceInput && extracted.price) priceInput.value = String(extracted.price);
      if (mrpInput && extracted.mrp) mrpInput.value = String(extracted.mrp);
      if (colInput && extracted.col) colInput.value = extracted.col;
      if (sizesInput && extracted.sizes && extracted.sizes.length) sizesInput.value = extracted.sizes.join(', ');
      if (descInput && extracted.desc) descInput.value = extracted.desc;
      if (retInput && extracted.ret) retInput.value = extracted.ret;
      if (retUrlInput && extracted.retUrl) retUrlInput.value = extracted.retUrl;

      if (imgInput && extracted.imgUrl) {
        imgInput.value = extracted.imgUrl;
        imgInput.dispatchEvent(new Event('input'));
      }

      // Update price calculation discount preview
      priceInput?.dispatchEvent(new Event('input'));

      const fieldsCount = [
        extracted.name, extracted.price, extracted.mrp, extracted.cat,
        extracted.col, extracted.sizes?.length, extracted.imgUrl, extracted.ret
      ].filter(Boolean).length;

      if (statusDiv) {
        statusDiv.innerHTML = `
          <div style="background:#E8F5E9;border:1px solid #A5D6A7;padding:10px 14px;border-radius:4px;color:#1B5E20;margin-top:6px">
            <strong>✓ Successfully Extracted (${fieldsCount} fields populated)!</strong><br />
            <span style="font-size:11.5px">Title, ${extracted.price ? `Price (₹${extracted.price}), ` : ''}Category (${esc(extracted.cat)}), and Retailer (${esc(extracted.ret)}) auto-filled. Review values below and click "Save Changes" or "Create &amp; Publish".</span>
          </div>
        `;
      }
      announce('Product information extracted and auto-filled');
    } catch (err: any) {
      if (statusDiv) {
        statusDiv.innerHTML = `<span style="color:#C62828">Extraction error: ${esc(err?.message || 'Check link')}</span>`;
      }
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }

  // Paste image directly from clipboard
  if (target.id === 'paste-img-clipboard-btn') {
    const imgInput = document.getElementById('p-img') as HTMLInputElement;
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text ? text.trim() : '';
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        if (imgInput) {
          imgInput.value = trimmed;
          imgInput.dispatchEvent(new Event('input'));
          announce('Image URL pasted from clipboard');
        }
      } else {
        alert('Clipboard content is not an image URL link. Please copy the image address first.');
      }
    } catch (e) {
      const manual = prompt('Paste your copied Meesho image address URL:');
      if (manual && manual.trim().startsWith('http') && imgInput) {
        imgInput.value = manual.trim();
        imgInput.dispatchEvent(new Event('input'));
      }
    }
  }

  // Handle Save as Draft button
  if (target.id === 'p-draft-btn') {
    const pubBox = document.getElementById('p-published') as HTMLInputElement;
    if (pubBox) pubBox.checked = false;
    const form = document.getElementById('product-edit-form') as HTMLFormElement;
    form?.requestSubmit();
  }

  // Dismiss admin alert
  if (target.id === 'adm-clear-error') {
    store.adminError = '';
    store.adminApiKeyError = false;
    draw();
  }
  if (target.id === 'adm-clear-success') {
    store.adminSuccessMessage = '';
    draw();
  }

  // Quick fix API key handler
  if (target.id === 'quick-fix-api-key-btn') {
    const input = document.getElementById('quick-fix-api-key') as HTMLInputElement;
    const feedback = document.getElementById('quick-fix-feedback');
    const keyVal = (input?.value || '').trim();

    if (!keyVal) {
      if (feedback) feedback.innerHTML = '<span style="color:#C62828">Please enter a valid API key.</span>';
      return;
    }

    const btn = target as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Verifying key with Google…';
    if (feedback) feedback.innerHTML = '<span class="mu" style="font-size:12px">Testing key against Google Identity Toolkit…</span>';

    try {
      const res = await saveAndApplyApiKey(keyVal);
      if (res.valid) {
        store.adminError = '';
        store.adminApiKeyError = false;
        store.adminSuccessMessage = 'Web API Key successfully updated, verified, and reconnected! You can now sign in.';
        draw();
      } else {
        btn.disabled = false;
        btn.textContent = 'Save & Verify Key';
        if (feedback) {
          feedback.innerHTML = `<span style="color:#C62828"><b>Verification failed:</b> ${esc(res.message)}</span>`;
        }
      }
    } catch (e: any) {
      btn.disabled = false;
      btn.textContent = 'Save & Verify Key';
      if (feedback) feedback.innerHTML = `<span style="color:#C62828"><b>Error:</b> ${esc(e.message)}</span>`;
    }
  }

  // Detailed settings API key save
  if (target.id === 'cfg-api-key-save-btn') {
    const input = document.getElementById('cfg-api-key') as HTMLInputElement;
    const status = document.getElementById('cfg-api-key-status');
    const keyVal = (input?.value || '').trim();

    if (!keyVal) {
      if (status) status.innerHTML = '<span style="color:#C62828">API key cannot be empty.</span>';
      return;
    }

    const btn = target as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const res = await saveAndApplyApiKey(keyVal);
      btn.disabled = false;
      btn.textContent = 'Save';
      if (res.valid) {
        if (status) status.innerHTML = '<span style="color:#2E7D32">✓ Key verified and saved!</span>';
        store.adminError = '';
        store.adminApiKeyError = false;
        store.adminSuccessMessage = 'API Key updated and verified!';
        draw();
      } else {
        if (status) status.innerHTML = `<span style="color:#C62828"><b>Warning:</b> ${esc(res.message)}</span>`;
      }
    } catch (e: any) {
      btn.disabled = false;
      btn.textContent = 'Save';
      if (status) status.innerHTML = `<span style="color:#C62828">${esc(e.message)}</span>`;
    }
  }

  // Test connection button
  if (target.id === 'cfg-test-conn-btn') {
    const status = document.getElementById('cfg-api-key-status');
    if (status) status.innerHTML = '<span class="mu">Testing connection to Firebase…</span>';
    const res = await testConnection();
    if (status) {
      if (res.connected) {
        status.innerHTML = `<span style="color:#2E7D32">✓ ${esc(res.message)}</span>`;
      } else {
        status.innerHTML = `<span style="color:#C62828">✗ ${esc(res.message)}</span>`;
      }
    }
  }

  // Reset to default configuration
  if (target.id === 'cfg-reset-btn') {
    try {
      localStorage.removeItem('dsb_firebase_api_key');
      localStorage.removeItem('dsb_firebase_config');
      await saveAndApplyApiKey(getEffectiveFirebaseConfig().apiKey);
      store.adminSuccessMessage = 'Configuration restored to default values.';
      store.adminError = '';
      store.adminApiKeyError = false;
      draw();
    } catch (e: any) {
      console.error(e);
    }
  }
});

// Live character counter on input
document.addEventListener('input', (e) => {
  const target = e.target as HTMLElement;
  if (target.id === 'quick-fix-api-key') {
    const val = (target as HTMLInputElement).value.trim();
    const countEl = document.getElementById('quick-fix-char-count');
    if (countEl) {
      const isValid = val.length === 39;
      countEl.textContent = `${val.length} / 39 characters ${isValid ? '(standard length)' : '(incomplete)'}`;
      countEl.style.color = isValid ? '#2E7D32' : '#865356';
    }
  }
});

// Keyboard accessibility: Escape closes open menus
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const nav = document.getElementById('nv');
    const mb = document.getElementById('mb');
    if (nav?.classList.contains('open')) {
      nav.classList.remove('open');
      mb?.setAttribute('aria-expanded', 'false');
      mb?.focus();
      return;
    }
    if (store.filters.mobileFiltersOpen) {
      store.filters.mobileFiltersOpen = false;
      draw();
      document.getElementById('fbtn')?.focus();
    }
  }
});

// Clean path and history router listener
window.addEventListener('popstate', () => {
  closeMobileMenu();
  draw(true);
});

window.addEventListener('hashchange', () => {
  closeMobileMenu();
  draw(true);
});

// Intercept internal link clicks for smooth SPA transitions with clean path URLs
document.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
  if (!target) return;
  const href = target.getAttribute('href');
  if (!href) return;

  // Don't intercept external links, mailto, tel, target="_blank", or hash jumps
  if (
    target.target === '_blank' ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('#')
  ) {
    return;
  }

  // Intercept clean internal paths like "/", "/category/women/", "/product/slug/", "/blog/", etc.
  if (href.startsWith('/') && !href.startsWith('/#')) {
    e.preventDefault();
    if (location.pathname + location.search !== href) {
      window.history.pushState(null, '', href);
    }
    closeMobileMenu();
    draw(true);
  }
});

// --------------------------------------------------------------------------
// Initialization on DOM Ready
// --------------------------------------------------------------------------
async function init() {
  testConnection().then(res => {
    console.log('Firebase connection status:', res.message);
  });

  // Listen to Firebase Auth state
  onAuthStateChanged(auth, async (user) => {
    store.currentUser = user;
    store.authChecking = false;
    if (user) {
      store.isAdmin = await checkAdminStatus(user);
      if (store.isAdmin) {
        await Promise.all([loadAdminProducts(), loadAdminArticles()]);
      }
    } else {
      store.isAdmin = false;
      store.adminProducts = [];
      store.adminArticles = [];
    }
    draw();
  });

  // Load public products and editorial articles from Cloud Firestore
  await Promise.all([loadPublicProducts(), loadPublicArticles()]);

  store.saveWishlist();
  draw(true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
