import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  DEMO_PRODUCTS,
  Product,
  SITE_CATEGORIES,
  CategoryMeta,
  isWomenProduct,
  isMenProduct,
  isKidsProduct,
  isFootwearProduct,
  isElectronicsProduct,
  isAccessoriesProduct,
  isHomeLivingProduct
} from '../src/productData.ts';
import { SEED_ARTICLES, Article, formatBlogDate, calculateReadTime } from '../src/blogData.ts';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import baseConfig from '../firebase-applet-config.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const BASE_ORIGIN = 'https://devtoshsuperbazaar.github.io';

async function fetchLiveProductsFromFirestore(): Promise<Product[]> {
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(baseConfig);
    const db = getFirestore(app);
    const q = query(collection(db, 'products'), where('published', '==', true));
    const snap = await getDocs(q);
    const items: Product[] = [];
    snap.forEach(d => {
      const data = d.data();
      items.push({
        id: d.id,
        slug: data.slug || d.id,
        name: data.name || 'Untitled Product',
        brand: data.brand || 'DevTosh Superbazaar Curated',
        cat: data.cat || 'Essentials',
        subcat: data.subcat || '',
        price: Number(data.price || 0),
        mrp: Number(data.mrp || 0),
        currency: data.currency || 'INR',
        col: data.col || 'Neutral',
        sizes: Array.isArray(data.sizes) ? data.sizes : (typeof data.sizes === 'string' ? data.sizes.split(',') : ['One size']),
        ret: data.ret || 'Partner Retailer',
        retUrl: data.retUrl || '',
        affUrl: data.affUrl || '',
        imgUrl: data.imgUrl || '',
        desc: data.desc || '',
        published: true,
        featured: !!data.featured,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        isDemo: false
      });
    });
    if (items.length > 0) {
      console.log(`[SSG Prerender] Fetched ${items.length} live products from Cloud Firestore for homepage.`);
      return items;
    }
  } catch (err) {
    console.warn('[SSG Prerender] Could not connect to Firestore during build, using fallback:', err);
  }
  return [];
}

function esc(str: string = ''): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inr(n: number = 0): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function disc(p: { price: number; mrp?: number }): number {
  if (!p.mrp || p.mrp <= p.price) return 0;
  return Math.round(((p.mrp - p.price) / p.mrp) * 100);
}

function sanitizeUrl(url: string, isImage: boolean = false): string {
  if (!url) return '';
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:')
  ) {
    return '#';
  }
  if (isImage) {
    if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('/')) {
      return trimmed;
    }
    return '';
  }
  return trimmed;
}

function stripDangerousHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<applet\b[^>]*>/gi, '')
    .replace(/on\w+\s*=\s*(?:["'][^"']*["']|[^\s>]+)/gi, '');
}

function formatInline(str: string): string {
  if (!str) return '';
  let s = stripDangerousHtml(str);

  // Markdown images: ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => {
    const cleanUrl = sanitizeUrl(url, true);
    if (!cleanUrl) return '';
    return `<figure class="art-body-fig" style="margin:20px 0;text-align:center"><img src="${esc(cleanUrl)}" alt="${esc(alt)}" loading="lazy" style="max-width:100%;height:auto;border-radius:4px;border:1px solid var(--bd)" />${alt ? `<figcaption class="art-cover-cap" style="margin-top:6px;font-size:12px;color:var(--mu);font-style:italic">${esc(alt)}</figcaption>` : ''}</figure>`;
  });

  // Markdown links: [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, url) => {
    const cleanUrl = sanitizeUrl(url, false);
    return `<a href="${esc(cleanUrl)}" rel="noopener noreferrer">${text}</a>`;
  });

  // Bold & Italic
  s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__(.*?)__/g, '<strong>$1</strong>');
  s = s.replace(/\*(.*?)\*/g, '<em>$1</em>');
  s = s.replace(/_(.*?)_/g, '<em>$1</em>');

  // Inline code & Strikethrough
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/~~(.*?)~~/g, '<del>$1</del>');

  return s;
}

function parseMarkdownToHtml(md: string): string {
  if (!md) return '';
  let cleanMd = md;
  // Safely strip frontmatter if present
  if (cleanMd.startsWith('---')) {
    const fmEnd = cleanMd.indexOf('---', 3);
    if (fmEnd !== -1) {
      cleanMd = cleanMd.slice(fmEnd + 3).trim();
    }
  }

  const lines = cleanMd.trim().split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Multi-line code blocks ```
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        out.push(`<pre class="art-code-block" style="background:var(--bl);padding:14px 18px;border-radius:4px;overflow-x:auto;border:1px solid var(--bd);margin:18px 0;font-size:13px;line-height:1.5"><code>${esc(codeBlockLines.join('\n'))}</code></pre>`);
        inCodeBlock = false;
        codeBlockLines = [];
      } else {
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (inOl) { out.push('</ol>'); inOl = false; }
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(raw);
      continue;
    }

    if (!trimmed) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
      continue;
    }

    if (trimmed === '---' || trimmed === '***') {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
      out.push('<hr class="art-divider" />');
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
      out.push(`<h4>${formatInline(trimmed.slice(5))}</h4>`);
      continue;
    }

    if (trimmed.startsWith('### ')) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
      out.push(`<h3>${formatInline(trimmed.slice(4))}</h3>`);
      continue;
    }

    if (trimmed.startsWith('## ')) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
      out.push(`<h2>${formatInline(trimmed.slice(3))}</h2>`);
      continue;
    }

    if (trimmed.startsWith('# ')) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
      out.push(`<h2>${formatInline(trimmed.slice(2))}</h2>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push(`<li>${formatInline(trimmed.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (!inOl) { out.push('<ol>'); inOl = true; }
      out.push(`<li>${formatInline(trimmed.replace(/^\d+\.\s+/, ''))}</li>`);
      continue;
    }

    if (trimmed.startsWith('> ')) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
      out.push(`<blockquote>${formatInline(trimmed.slice(2))}</blockquote>`);
      continue;
    }

    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
    out.push(`<p>${formatInline(trimmed)}</p>`);
  }

  if (inUl) out.push('</ul>');
  if (inOl) out.push('</ol>');

  return out.join('\n');
}

function getCategoryFaqs(key: string, title: string): { q: string; a: string }[] {
  if (key === 'women') {
    return [
      {
        q: 'What styles are featured in the Women’s Collection?',
        a: 'The collection highlights traditional Banarasi woven silk sarees, pure cotton printed Anarkali kurti sets, flared midi dresses, traditional jewellery, and orthopedic comfort ethnic footwear.'
      },
      {
        q: 'Where do purchases take place?',
        a: 'When you click to shop on a partner retailer, you are redirected directly to trusted partner marketplaces (such as Meesho). Product checkout, payment, and shipping are handled securely by the partner.'
      },
      {
        q: 'Can prices or stock availability change?',
        a: 'Yes. Merchant partner pricing and sizes fluctuate based on inventory. We regularly refresh listings, but final prices are confirmed on the partner website.'
      }
    ];
  }
  if (key === 'men') {
    return [
      {
        q: 'What apparel is included in the Men’s Collection?',
        a: 'Our menswear selection includes classic Oxford button-down shirts, heavyweight casual tees, stone-washed denim jeans, stretch utility cargo trousers, and cushioned slip-on loafers.'
      },
      {
        q: 'How are product prices and deals determined?',
        a: 'We monitor popular collections to curate top-rated wardrobe essentials offering value for money from verified retail merchants.'
      }
    ];
  }
  if (key === 'mobiles' || key === 'electronics') {
    return [
      {
        q: 'What mobile accessories and gadgets are available?',
        a: 'We feature 360-degree rotating car dashboard phone mounts, foldable aluminium desktop phone and tablet stands, true wireless Bluetooth earbuds, and smartwatches.'
      },
      {
        q: 'Are mobile accessories compatible with all phones?',
        a: 'Most phone holders and stands feature universal spring-loaded or magnetic grips compatible with modern Apple, Samsung, Xiaomi, and OnePlus devices.'
      }
    ];
  }
  if (key === 'all' || key === 'home' || !key) {
    return [
      {
        q: 'What is DevTosh Superbazaar?',
        a: 'DevTosh Superbazaar is an independent editorial discovery platform that curates high-value fashion, smartphones, mobile accessories, footwear, and lifestyle products from trusted Indian retail marketplaces.'
      },
      {
        q: 'How do shopping and affiliate links work?',
        a: 'We handpick top trending items and provide direct outbound links to verified merchant platforms. We may earn an affiliate commission on qualifying purchases at no extra cost to you.'
      },
      {
        q: 'Where does payment and order delivery take place?',
        a: 'Orders, payments, order tracking, and returns are handled entirely by the destination retailer (e.g., Meesho). DevTosh Superbazaar does not collect payments or manage shipments directly.'
      },
      {
        q: 'Can product prices or discounts vary?',
        a: 'Yes, merchant pricing and promotional discounts are subject to change by the respective retailers. We advise checking the final price before completing your purchase.'
      }
    ];
  }
  return [
    {
      q: `How are products in ${title} curated?`,
      a: 'Our editorial team curates items based on customer satisfaction ratings, construction quality, merchant credibility, and everyday usability.'
    },
    {
      q: 'How do I purchase items from this catalog?',
      a: 'Clicking any product link takes you to the official retailer storefront to view sizing options and complete your order securely.'
    }
  ];
}

function renderFaqsHtml(
  faqs: { q: string; a: string }[],
  heading: string = 'Frequently Asked Questions',
  intro: string = 'Helpful answers regarding our curation, retailer shopping links, and store operations.',
  groupId: string = 'main'
): string {
  if (!faqs || !faqs.length) return '';
  const cleanGroupId = groupId.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `
    <section class="w faqs-sec" aria-labelledby="faqs-heading-${cleanGroupId}">
      <h2 id="faqs-heading-${cleanGroupId}" class="faqs-title">${esc(heading)}</h2>
      <p class="faqs-lead">${esc(intro)}</p>
      <div class="faqs-list" role="presentation">
        ${faqs.map((f, i) => {
          const qId = `faq-q-${cleanGroupId}-${i}`;
          const aId = `faq-a-${cleanGroupId}-${i}`;
          return `
          <details name="faq-${cleanGroupId}" class="faq-item">
            <summary class="faq-q" id="${qId}" aria-expanded="false" aria-controls="${aId}">
              <span class="faq-q-text">${esc(f.q)}</span>
              <svg class="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </summary>
            <div id="${aId}" class="faq-a" role="region" aria-labelledby="${qId}">
              <p style="margin:0">${esc(f.a)}</p>
            </div>
          </details>`;
        }).join('')}
      </div>
    </section>
  `;
}

function renderStaticProductCard(p: Product, isLcp: boolean = false): string {
  const u = `/product/${p.slug}/`;
  const d = disc(p);
  const tint = p.tint || '#EADFD8';
  const g = p.g || '#9DB7CF';
  const sh = p.sh || (
    isElectronicsProduct(p) ? 'phone' :
    isWomenProduct(p) ? 'dress' :
    isFootwearProduct(p) ? 'shoe' :
    isAccessoriesProduct(p) ? 'bag' :
    'shirt'
  );

  return `
    <article class="pc" id="card-${p.slug}">
      <a href="${u}" class="ph" style="--t:${tint};--g:${g};background:#fff" aria-label="View product details for ${esc(p.name)}">
        ${p.imgUrl ? `
          <img src="${esc(p.imgUrl)}" alt="${esc(p.name)}" ${isLcp ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} style="width:100%;height:100%;object-fit:cover" />
        ` : `
          <svg viewBox="0 0 100 125" role="img" aria-label="Illustration for ${esc(p.name)}"><use href="#${sh}"/></svg>
        `}
      </a>
      <button class="wl" id="wl-${p.slug}" data-a="wl" data-s="${p.slug}" aria-label="Save ${esc(p.name)} to wishlist">
        <svg aria-hidden="true" viewBox="0 0 24 24"><use href="#hrt"/></svg>
      </button>
      <div class="pi">
        <div class="rt">${esc(p.brand)}</div>
        <h2 class="pn"><a href="${u}">${esc(p.name)}</a></h2>
        <div class="pr">
          <b>${inr(p.price)}</b>
          ${p.mrp && d > 0 ? `<s><span class="sr">MRP </span>${inr(p.mrp)}</s><em>${d}% off</em>` : ''}
        </div>
        <div class="ck">Partner retailer: ${esc(p.ret)} · Prices subject to change</div>
        <a class="vp" href="${u}">View details<span class="sr"> for ${esc(p.name)}</span> →</a>
      </div>
    </article>
  `;
}

export async function prerender() {
  console.log('[SSG Prerender] Starting full static site generation...');

  if (!fs.existsSync(DIST_DIR)) {
    throw new Error(`Dist directory not found at ${DIST_DIR}. Run vite build first.`);
  }

  const baseHtmlPath = path.resolve(DIST_DIR, 'index.html');
  if (!fs.existsSync(baseHtmlPath)) {
    throw new Error(`Base index.html not found in ${DIST_DIR}.`);
  }
  const baseHtml = fs.readFileSync(baseHtmlPath, 'utf8');

  // Track all indexed URLs for universal sitemap.xml
  const sitemapUrls: { loc: string; lastmod?: string; changefreq: string; priority: string }[] = [
    { loc: `${BASE_ORIGIN}/`, changefreq: 'daily', priority: '1.0' }
  ];

  function writeDocument(subPath: string, htmlContent: string) {
    const fullDir = path.resolve(DIST_DIR, subPath);
    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true });
    }
    const filePath = path.resolve(fullDir, 'index.html');
    fs.writeFileSync(filePath, htmlContent, 'utf8');
    console.log(`[SSG Prerender] Wrote ${path.relative(ROOT_DIR, filePath)}`);
  }

  function assembleHtml(options: {
    title: string;
    description: string;
    canonicalUrl: string;
    ogType?: string;
    ogImage?: string;
    jsonLd?: object;
    mainHtml: string;
    noindex?: boolean;
    faqs?: { q: string; a: string }[];
  }): string {
    let out = baseHtml;

    // Clean existing meta tags that could conflict
    out = out.replace(/<title>.*?<\/title>/i, `<title>${esc(options.title)}</title>`);
    out = out.replace(/<meta name="description" content=".*?"\s*\/?>/i, `<meta name="description" content="${esc(options.description)}">`);
    out = out.replace(/<meta property="og:title" content=".*?"\s*\/?>/i, `<meta property="og:title" content="${esc(options.title)}">`);
    out = out.replace(/<meta property="og:description" content=".*?"\s*\/?>/i, `<meta property="og:description" content="${esc(options.description)}">`);
    out = out.replace(/<meta property="og:type" content=".*?"\s*\/?>/i, `<meta property="og:type" content="${options.ogType || 'website'}">`);
    out = out.replace(/<link rel="canonical" href=".*?"\s*\/?>/gi, '');
    out = out.replace(/<meta property="og:url" content=".*?"\s*\/?>/gi, '');
    out = out.replace(/<meta property="og:image" content=".*?"\s*\/?>/gi, '');
    out = out.replace(/<meta name="twitter:image" content=".*?"\s*\/?>/gi, '');
    out = out.replace(/<meta name="robots" content=".*?"\s*\/?>/gi, '');
    out = out.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '');

    const ogImg = options.ogImage || `${BASE_ORIGIN}/apple-touch-icon.png`;
    const robotsContent = options.noindex
      ? 'noindex, nofollow'
      : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';

    let schemaBlock = '';
    if (!options.noindex && options.jsonLd) {
      const graphItems: any[] = [
        {
          '@type': 'Organization',
          '@id': `${BASE_ORIGIN}/#organization`,
          'name': 'DevTosh Superbazaar',
          'url': `${BASE_ORIGIN}/`,
          'logo': `${BASE_ORIGIN}/favicon-48x48.png`,
          'sameAs': ['https://www.instagram.com/devtoshsuperbazaar/']
        },
        {
          '@type': 'WebSite',
          '@id': `${BASE_ORIGIN}/#website`,
          'url': `${BASE_ORIGIN}/`,
          'name': 'DevTosh Superbazaar',
          'description': 'Curated fashion, smartphones, mobile accessories, footwear and lifestyle affiliate discovery.',
          'publisher': {
            '@id': `${BASE_ORIGIN}/#organization`
          }
        },
        options.jsonLd
      ];

      if (options.faqs && options.faqs.length) {
        graphItems.push({
          '@type': 'FAQPage',
          '@id': `${options.canonicalUrl}#faq`,
          'mainEntity': options.faqs.map(f => ({
            '@type': 'Question',
            'name': f.q,
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': f.a
            }
          }))
        });
      }

      schemaBlock = `
  <script type="application/ld+json">
${JSON.stringify({ '@context': 'https://schema.org', '@graph': graphItems }, null, 2)}
  </script>`;
    }

    const headInject = `
  <link rel="canonical" href="${options.canonicalUrl}">
  <meta property="og:url" content="${options.canonicalUrl}">
  <meta property="og:image" content="${ogImg}">
  <meta name="twitter:image" content="${ogImg}">
  <meta name="robots" content="${robotsContent}">${schemaBlock}
`;
    out = out.replace('</head>', `${headInject}</head>`);

    // Main body replacement - preserves single outer <main id="app"> landmark
    out = out.replace('<main id="app" tabindex="-1"></main>', `<main id="app" tabindex="-1">${options.mainHtml}</main>`);
    return out;
  }

  // ========================================================================
  // 1. Prerender Homepage (dist/index.html)
  // ========================================================================
  console.log('[SSG Prerender] Prerendering Homepage (dist/index.html)...');
  const homeFaqs = getCategoryFaqs('home', 'DevTosh Superbazaar');
  const liveProducts = await fetchLiveProductsFromFirestore();
  const homeFeatured = liveProducts.length > 0 ? liveProducts : DEMO_PRODUCTS.slice(0, 8);
  const homeMainHtml = `
    <section class="w ih">
      <div class="tt">
        <h1 class="f" tabindex="-1">DevTosh Superbazaar — Curated Fashion, Mobiles &amp; Lifestyle Discovery</h1>
      </div>
      <p class="lead">Discover handpicked fashion, smartphones, car mobile holders, footwear, and lifestyle essentials curated by DevTosh Superbazaar.</p>
    </section>

    <div class="w lay">
      <div class="mn" style="width:100%">
        <div class="tb">
          <div class="tl">
            <strong>Featured Collections &amp; Handpicked Finds</strong>
          </div>
        </div>
        <div class="g">${homeFeatured.map((p, idx) => renderStaticProductCard(p, idx === 0)).join('')}</div>
      </div>
    </div>
    ${renderFaqsHtml(homeFaqs, 'DevTosh Superbazaar — Frequently Asked Questions', 'Helpful answers regarding our curation, retailer shopping links, and store operations.', 'home')}
  `;

  const homeJsonLd = {
    '@type': 'WebPage',
    '@id': `${BASE_ORIGIN}/#webpage`,
    'url': `${BASE_ORIGIN}/`,
    'name': 'DevTosh Superbazaar — Curated Fashion, Mobiles & Lifestyle Discovery',
    'description': 'Editorial discovery catalog and affiliate shopping platform for women\'s, men\'s, kids fashion, footwear, smartphones, mobile accessories, and lifestyle by DevTosh Superbazaar.',
    'isPartOf': {
      '@id': `${BASE_ORIGIN}/#website`
    }
  };

  const homeHtml = assembleHtml({
    title: 'DevTosh Superbazaar — Curated Fashion, Mobiles & Lifestyle Discovery',
    description: 'Editorial discovery catalog and affiliate shopping platform for women\'s, men\'s, kids fashion, footwear, smartphones, mobile accessories, and lifestyle by DevTosh Superbazaar.',
    canonicalUrl: `${BASE_ORIGIN}/`,
    jsonLd: homeJsonLd,
    faqs: homeFaqs,
    mainHtml: homeMainHtml
  });

  fs.writeFileSync(baseHtmlPath, homeHtml, 'utf8');
  console.log('[SSG Prerender] Successfully populated dist/index.html with prerendered storefront.');

  // ========================================================================
  // 2. Prerender All Categories (/category/<slug>/)
  // ========================================================================
  console.log('[SSG Prerender] Prerendering category collection pages...');
  for (const cat of SITE_CATEGORIES) {
    let items: Product[] = [];
    if (cat.slug === 'women') items = DEMO_PRODUCTS.filter(isWomenProduct);
    else if (cat.slug === 'men') items = DEMO_PRODUCTS.filter(isMenProduct);
    else if (cat.slug === 'kids') items = DEMO_PRODUCTS.filter(isKidsProduct);
    else if (cat.slug === 'footwear') items = DEMO_PRODUCTS.filter(isFootwearProduct);
    else if (cat.slug === 'mobiles' || cat.slug === 'electronics') items = DEMO_PRODUCTS.filter(isElectronicsProduct);
    else if (cat.slug === 'accessories') items = DEMO_PRODUCTS.filter(isAccessoriesProduct);
    else if (cat.slug === 'home-living') items = DEMO_PRODUCTS.filter(isHomeLivingProduct);
    else if (cat.slug === 'new') items = [...DEMO_PRODUCTS].sort((a, b) => (b.added || 0) - (a.added || 0));
    else items = DEMO_PRODUCTS;

    const canonicalUrl = `${BASE_ORIGIN}/category/${cat.slug}/`;
    const catFaqs = getCategoryFaqs(cat.slug, cat.name);

    const jsonLd = {
      '@type': 'CollectionPage',
      '@id': `${canonicalUrl}#collection`,
      'name': cat.name,
      'description': cat.description,
      'url': canonicalUrl,
      'isPartOf': {
        '@id': `${BASE_ORIGIN}/#website`
      },
      'mainEntity': {
        '@type': 'ItemList',
        'itemListElement': items.map((p, idx) => ({
          '@type': 'ListItem',
          'position': idx + 1,
          'url': `${BASE_ORIGIN}/product/${p.slug}/`,
          'name': p.name
        }))
      }
    };

    const mainHtml = `
      <section class="w ih">
        <nav class="bc" aria-label="Breadcrumb">
          <a href="/">Home</a> / <span aria-current="page">${esc(cat.name)}</span>
        </nav>
        <div class="tt">
          <h1 class="f" tabindex="-1">${esc(cat.h1)}</h1>
          <span class="mu" aria-label="${items.length} products available">${items.length} items</span>
        </div>
        <p class="lead">${esc(cat.description)}</p>
      </section>

      <div class="w lay">
        <div class="mn" style="width:100%">
          <div class="tb">
            <div class="tl">
              <strong>${items.length} curated items</strong>
            </div>
          </div>
          <div class="g">${items.map((p, idx) => renderStaticProductCard(p, idx === 0)).join('')}</div>
        </div>
      </div>
      ${renderFaqsHtml(catFaqs, `${cat.name} — Questions & Answers`, `Common questions about our ${cat.name.toLowerCase()} curation and shopping advice.`, `cat-${cat.slug}`)}
    `;

    const catHtml = assembleHtml({
      title: cat.title,
      description: cat.description,
      canonicalUrl,
      jsonLd,
      faqs: catFaqs,
      mainHtml
    });

    writeDocument(`category/${cat.slug}`, catHtml);

    sitemapUrls.push({
      loc: canonicalUrl,
      changefreq: 'weekly',
      priority: '0.85'
    });
  }

  // ========================================================================
  // 3. Prerender Every Single Product (/product/<slug>/)
  // ========================================================================
  const allProductsToPrerender: Product[] = [];
  const seenProductSlugs = new Set<string>();

  // Live products from Cloud Firestore take priority
  for (const lp of liveProducts) {
    if (lp.slug && !seenProductSlugs.has(lp.slug)) {
      seenProductSlugs.add(lp.slug);
      allProductsToPrerender.push(lp);
    }
  }

  // Demo products supplement catalogue
  for (const dp of DEMO_PRODUCTS) {
    if (dp.slug && !seenProductSlugs.has(dp.slug)) {
      seenProductSlugs.add(dp.slug);
      allProductsToPrerender.push(dp);
    }
  }

  console.log(`[SSG Prerender] Prerendering ${allProductsToPrerender.length} single product pages (${liveProducts.length} live from Firestore + demo catalogue)...`);
  for (const p of allProductsToPrerender) {
    const canonicalUrl = `${BASE_ORIGIN}/product/${p.slug}/`;
    const pageTitle = `${p.name} — Buy Online at Best Price | DevTosh Superbazaar`;
    const pageDesc = `Discover ${p.name} by ${p.brand} at ₹${p.price} (MRP ₹${p.mrp || p.price}). ${p.desc}`;
    const ogImg = p.imgUrl || `${BASE_ORIGIN}/favicon-48x48.png`;
    const d = disc(p);

    const related = allProductsToPrerender
      .filter(x => x.slug !== p.slug)
      .sort((a, b) => (b.cat === p.cat ? 1 : 0) - (a.cat === p.cat ? 1 : 0))
      .slice(0, 4);

    const deptName =
      isElectronicsProduct(p) ? 'Electronics & Mobiles' :
      isWomenProduct(p) ? 'Women’s Fashion' :
      isKidsProduct(p) ? 'Kids & Baby' :
      isFootwearProduct(p) ? 'Footwear' :
      isAccessoriesProduct(p) ? 'Accessories' :
      isHomeLivingProduct(p) ? 'Home & Living' :
      'Men’s Fashion';

    const deptSlug =
      isElectronicsProduct(p) ? 'mobiles' :
      isWomenProduct(p) ? 'women' :
      isKidsProduct(p) ? 'kids' :
      isFootwearProduct(p) ? 'footwear' :
      isAccessoriesProduct(p) ? 'accessories' :
      isHomeLivingProduct(p) ? 'home-living' :
      'men';

    const prodFaqs = [
      {
        q: `Where can I buy "${p.name}"?`,
        a: `This item is available through verified merchant partner ${p.ret}. Clicking "Shop at ${p.ret}" opens the official product listing where you can select your size or color variant and complete checkout.`
      },
      {
        q: 'How does DevTosh Superbazaar track prices?',
        a: `Prices displayed are indicative of recent retailer listings. Retailers frequently update discounts and stock levels, so please verify the live price directly on ${p.ret}.`
      },
      {
        q: 'What is the return and shipping policy?',
        a: `Because orders are placed directly on ${p.ret}, shipping speeds, delivery fees, and return or exchange windows follow ${p.ret}'s official customer care policies.`
      }
    ];

    const jsonLd = {
      '@type': 'Product',
      '@id': `${canonicalUrl}#product`,
      'name': p.name,
      'image': [ogImg],
      'description': p.desc,
      'sku': p.slug,
      'brand': {
        '@type': 'Brand',
        'name': p.brand
      },
      'offers': {
        '@type': 'Offer',
        'price': p.price,
        'priceCurrency': 'INR',
        'availability': 'https://schema.org/InStock',
        'url': p.affUrl || p.retUrl || canonicalUrl,
        'seller': {
          '@type': 'Organization',
          'name': p.ret || 'Partner Retailer'
        }
      }
    };

    const mainHtml = `
      <section class="w pgs wide">
        <nav class="bc" aria-label="Breadcrumb">
          <a href="/">Home</a> / <a href="/category/${deptSlug}/">${esc(deptName)}</a> / <span aria-current="page">${esc(p.name)}</span>
        </nav>
        <div class="dt">
          <div class="ph big" style="background:#fff">
            ${p.imgUrl ? `
              <img src="${esc(p.imgUrl)}" alt="${esc(p.name)}" loading="eager" fetchpriority="high" style="width:100%;height:100%;object-fit:cover" />
            ` : `
              <div style="padding:60px 20px;text-align:center;background:var(--bl);color:var(--dp);font-weight:600">${esc(p.name)}</div>
            `}
          </div>
          <div>
            <div class="rt">${esc(p.brand)}</div>
            <h1 class="f" tabindex="-1">${esc(p.name)}</h1>
            <div class="pr">
              <b>${inr(p.price)}</b>
              ${p.mrp && d > 0 ? `<s><span class="sr">MRP </span>${inr(p.mrp)}</s><em>${d}% off</em>` : ''}
            </div>
            <p class="mu" style="margin:6px 0 0">Listed via ${esc(p.ret)} · Prices and availability subject to merchant change</p>
            <p class="lead">${esc(p.desc)}</p>
            <dl class="sp">
              <dt>Retailer</dt><dd>${esc(p.ret)}</dd>
              <dt>Category</dt><dd>${esc(p.cat)}</dd>
              <dt>Colour</dt><dd>${esc(p.col)}</dd>
              <dt>Sizes available</dt><dd>${esc(p.sizes.join(', '))}</dd>
              <dt>Product SKU</dt><dd>${esc(p.slug)}</dd>
            </dl>
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:28px">
              <a class="lm" href="${esc(p.affUrl || p.retUrl || '/')}" target="_blank" rel="noopener noreferrer">Shop at ${esc(p.ret)} ↗</a>
              <button class="wb" id="wb-${p.slug}" data-a="wl" data-s="${p.slug}" aria-label="Save to wishlist">
                <svg aria-hidden="true" viewBox="0 0 24 24"><use href="#hrt"/></svg>
                <span>Save to wishlist</span>
              </button>
            </div>

            <div class="sh-bar" role="region" aria-label="Share this product" style="margin-top:28px">
              <span class="sh-lbl">Share:</span>
              <a class="sh-btn wa" href="https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out ${p.name} on DevTosh Superbazaar: ${canonicalUrl}`)}" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp">
                <svg aria-hidden="true"><use href="#wa"/></svg>
                <span>WhatsApp</span>
              </a>
              <a class="sh-btn tg" href="https://t.me/share/url?url=${encodeURIComponent(canonicalUrl)}&text=${encodeURIComponent(`Check out ${p.name} on DevTosh Superbazaar`)}" target="_blank" rel="noopener noreferrer" aria-label="Share on Telegram">
                <svg aria-hidden="true"><use href="#tg"/></svg>
                <span>Telegram</span>
              </a>
              <button type="button" class="sh-btn" data-a="copy-prod-link" data-url="${esc(canonicalUrl)}" aria-label="Copy product link">
                <svg aria-hidden="true"><use href="#cp"/></svg>
                <span class="cp-text">Copy Link</span>
              </button>
            </div>

            <p class="dc" style="margin-top:24px"><b>Affiliate disclosure:</b> DevTosh Superbazaar participates in affiliate partnerships and may earn a commission on qualifying purchases made through partner retailer links at no additional cost to you.</p>
          </div>
        </div>
        <h2 class="f rh">You may also like</h2>
        <div class="g">${related.map(r => renderStaticProductCard(r, false)).join('')}</div>
        ${renderFaqsHtml(prodFaqs, `About ${p.name} — FAQs`, 'Answers about materials, fit, care instructions, and retailer ordering.', `prod-${p.slug}`)}
      </section>
    `;

    const prodHtml = assembleHtml({
      title: pageTitle,
      description: pageDesc,
      canonicalUrl,
      ogType: 'product',
      ogImage: ogImg,
      jsonLd,
      faqs: prodFaqs,
      mainHtml
    });

    writeDocument(`product/${p.slug}`, prodHtml);

    sitemapUrls.push({
      loc: canonicalUrl,
      changefreq: 'weekly',
      priority: '0.80'
    });
  }

  // ========================================================================
  // 4. Prerender Blog Articles (/blog/<slug>/) & Blog Index (/blog/)
  // ========================================================================
  console.log('[SSG Prerender] Prerendering blog articles and index...');
  const publishedArticles = SEED_ARTICLES.filter(a => a.published && !a.noindex);

  for (const article of publishedArticles) {
    const canonicalUrl = article.canonicalUrl || `${BASE_ORIGIN}/blog/${article.slug}/`;
    const pageTitle = `${article.metaTitle || article.title} — DevTosh Superbazaar`;
    const pageDesc = article.metaDesc || article.excerpt;
    const ogImg = article.ogImage || article.coverImage || `${BASE_ORIGIN}/favicon-48x48.png`;
    const readTime = article.readTimeMinutes || calculateReadTime(article.content);
    const pubDateStr = formatBlogDate(article.publishedAt);
    const modDateStr = formatBlogDate(article.updatedAt || article.publishedAt);
    const renderedContent = parseMarkdownToHtml(article.content);
    const shareTitle = encodeURIComponent(article.title);
    const shareUrl = encodeURIComponent(canonicalUrl);

    const jsonLd = {
      '@type': 'BlogPosting',
      '@id': `${canonicalUrl}#article`,
      'headline': article.title,
      'description': pageDesc,
      'image': [ogImg],
      'datePublished': article.publishedAt,
      'dateModified': article.updatedAt || article.publishedAt,
      'author': {
        '@type': 'Person',
        'name': article.authorName,
        'url': article.authorUrl || BASE_ORIGIN
      },
      'publisher': {
        '@id': `${BASE_ORIGIN}/#organization`
      },
      'mainEntityOfPage': {
        '@type': 'WebPage',
        '@id': canonicalUrl
      }
    };

    const mainHtml = `
      <section class="w pgs wide art-view">
        <nav class="bc" aria-label="Breadcrumb">
          <a href="/">Home</a> / <a href="/blog/">Editorial Blog</a> / <span aria-current="page">${esc(article.title)}</span>
        </nav>

        <article class="art-container">
          <header class="art-header">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
              <span class="tag">${esc(article.category)}</span>
              <span class="mu" style="font-size:12px">${readTime} min read</span>
            </div>
            <h1 class="f art-h1" tabindex="-1">${esc(article.title)}</h1>
            <p class="lead art-lead">${esc(article.excerpt)}</p>

            <div class="art-byline">
              <div style="display:flex;align-items:center;gap:12px">
                <div class="art-avatar" aria-hidden="true">${article.authorName.charAt(0)}</div>
                <div>
                  <div style="font-size:13.5px;font-weight:600">${esc(article.authorName)}</div>
                  <div class="mu" style="font-size:12px">
                    Published on <time datetime="${article.publishedAt}">${pubDateStr}</time>
                    ${article.updatedAt && article.updatedAt !== article.publishedAt ? ` · Updated <time datetime="${article.updatedAt}">${modDateStr}</time>` : ''}
                  </div>
                </div>
              </div>

              <div class="sh-bar" role="region" aria-label="Share article" style="margin:0;padding:6px 10px">
                <span class="sh-lbl">Share:</span>
                <a class="sh-btn wa" href="https://api.whatsapp.com/send?text=${shareTitle}%20${shareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp">
                  <svg aria-hidden="true"><use href="#wa"/></svg>
                  <span>WhatsApp</span>
                </a>
                <a class="sh-btn tg" href="https://t.me/share/url?url=${shareUrl}&text=${shareTitle}" target="_blank" rel="noopener noreferrer" aria-label="Share on Telegram">
                  <svg aria-hidden="true"><use href="#tg"/></svg>
                  <span>Telegram</span>
                </a>
              </div>
            </div>
          </header>

          ${article.coverImage ? `
            <figure class="art-cover-fig">
              <img class="art-cover-img" src="${esc(article.coverImage)}" alt="${esc(article.coverImageAlt || article.title)}" loading="eager" fetchpriority="high" />
              ${article.coverImageAlt ? `<figcaption class="art-cover-cap">${esc(article.coverImageAlt)}</figcaption>` : ''}
            </figure>
          ` : ''}

          ${article.hasAffiliateLinks ? `
            <div class="art-disclosure" role="note">
              <strong>Editorial Transparency &amp; Affiliate Disclosure:</strong> This article contains curated product suggestions with affiliate links. If you make a purchase through these links, Devtosh SuperBazaar may earn a small referral commission at no additional cost to you.
            </div>
          ` : ''}

          <div class="art-content">
            ${renderedContent}
          </div>

          <footer style="margin-top:40px;padding-top:24px;border-top:1px solid var(--bd)">
            <p><a class="vp" href="/blog/">← Back to All Editorial Articles</a></p>
          </footer>
        </article>
      </section>
    `;

    const articleHtml = assembleHtml({
      title: pageTitle,
      description: pageDesc,
      canonicalUrl,
      ogType: 'article',
      ogImage: ogImg,
      jsonLd,
      mainHtml
    });

    writeDocument(`blog/${article.slug}`, articleHtml);

    sitemapUrls.push({
      loc: canonicalUrl,
      lastmod: article.updatedAt ? article.updatedAt.split('T')[0] : article.publishedAt.split('T')[0],
      changefreq: 'monthly',
      priority: '0.70'
    });
  }

  // Blog Index (/blog/)
  const blogIndexCanonical = `${BASE_ORIGIN}/blog/`;
  const blogIndexTitle = 'Editorial Style Blog & Shopping Guides | DevTosh Superbazaar';
  const blogIndexDesc = 'Curated fashion guides, saree styling advice, and mobile accessory roundups by the DevTosh Superbazaar editorial team.';

  const blogIndexJsonLd = {
    '@type': 'CollectionPage',
    '@id': `${blogIndexCanonical}#collection`,
    'name': blogIndexTitle,
    'description': blogIndexDesc,
    'url': blogIndexCanonical,
    'isPartOf': {
      '@id': `${BASE_ORIGIN}/#website`
    },
    'mainEntity': {
      '@type': 'ItemList',
      'itemListElement': publishedArticles.map((a, idx) => ({
        '@type': 'ListItem',
        'position': idx + 1,
        'url': `${BASE_ORIGIN}/blog/${a.slug}/`,
        'name': a.title
      }))
    }
  };

  const blogIndexMainHtml = `
    <section class="w pgs wide">
      <nav class="bc" aria-label="Breadcrumb">
        <a href="/">Home</a> / <span aria-current="page">Blog</span>
      </nav>
      <div class="tt">
        <h1 class="f" tabindex="-1">Editorial Guides &amp; Style Blog</h1>
        <span class="mu">${publishedArticles.length} articles</span>
      </div>
      <p class="lead">${esc(blogIndexDesc)}</p>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:24px;margin-top:32px">
        ${publishedArticles.map(a => `
          <article class="adm-card" style="margin:0;display:flex;flex-direction:column;justify-content:space-between">
            <div>
              <span class="tag" style="margin-bottom:8px">${esc(a.category)}</span>
              <h2 class="f" style="font-size:20px;margin:8px 0"><a href="/blog/${a.slug}/">${esc(a.title)}</a></h2>
              <p class="mu" style="font-size:13.5px;line-height:1.55;margin:8px 0">${esc(a.excerpt)}</p>
            </div>
            <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--bd);display:flex;justify-content:space-between;align-items:center;font-size:12px">
              <span class="mu">${formatBlogDate(a.publishedAt)}</span>
              <a class="vp" href="/blog/${a.slug}/">Read article →</a>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `;

  const blogIndexHtml = assembleHtml({
    title: blogIndexTitle,
    description: blogIndexDesc,
    canonicalUrl: blogIndexCanonical,
    jsonLd: blogIndexJsonLd,
    mainHtml: blogIndexMainHtml
  });

  writeDocument('blog', blogIndexHtml);
  sitemapUrls.push({
    loc: blogIndexCanonical,
    changefreq: 'weekly',
    priority: '0.75'
  });

  // ========================================================================
  // 5. Prerender Informational Pages
  // ========================================================================
  console.log('[SSG Prerender] Prerendering informational pages...');
  const infoPages = [
    {
      slug: 'about',
      title: 'About DevTosh Superbazaar',
      description: 'Learn about Devtosh SuperBazaar, an independent curated online catalog for fashion, electronics, and lifestyle discovery.',
      heading: 'About DevTosh Superbazaar',
      body: `
        <p class="lead">DevTosh Superbazaar is a curated product discovery destination founded by Devsharan Yadav, focused on showcasing top-tier ethnic wear, smart mobile essentials, and everyday lifestyle values from India's vibrant retail marketplaces.</p>
        <p class="mu" style="margin-top:20px;line-height:1.7">We do not sell counterfeit goods, manufacture apparel, or take customer payments. Instead, our editors browse thousands of listings to surface genuine bargains with dependable merchant reviews, directing you to trusted e-commerce stores.</p>
      `
    },
    {
      slug: 'contact',
      title: 'Contact DevTosh Superbazaar',
      description: 'Get in touch with Devtosh SuperBazaar for catalog suggestions, business collaborations, or general questions.',
      heading: 'Contact DevTosh Superbazaar',
      body: `
        <p class="lead">We welcome suggestions, feedback, and merchant partnership inquiries.</p>
        <div style="background:var(--sf);border:1px solid var(--bd);padding:24px;border-radius:4px;margin-top:24px">
          <h2 style="font-size:18px;margin:0 0 12px;color:var(--dp)">Editorial &amp; Business Office</h2>
          <p style="line-height:1.7;margin:0 0 16px"><b>Founder &amp; Curator:</b> Devsharan Yadav<br /><b>Direct Instagram:</b> <a href="https://www.instagram.com/devtoshsuperbazaar/" target="_blank" rel="noopener noreferrer" style="color:var(--wn);text-decoration:underline">@devtoshsuperbazaar</a><br /><b>Website:</b> <a href="${BASE_ORIGIN}/" style="color:var(--wn);text-decoration:underline">devtoshsuperbazaar.github.io</a></p>
          <p class="mu" style="font-size:13px;line-height:1.6;margin:0">For product returns or shipping tracking, please contact the retailer (Meesho, Amazon, or Flipkart) directly using the order confirmation received in your email or SMS.</p>
        </div>
      `
    },
    {
      slug: 'affiliate-disclosure',
      title: 'Affiliate Disclosure — DevTosh Superbazaar',
      description: 'Learn how Devtosh SuperBazaar maintains editorial independence and how affiliate partnerships work.',
      heading: 'Affiliate Disclosure',
      body: `
        <p class="lead">DevTosh Superbazaar participates in affiliate marketing programs. When you click on product links and make a purchase on partner retailer websites (such as Meesho), we may receive a small commission.</p>
        <p class="mu" style="margin-top:16px;line-height:1.7">This commission comes at <b>no additional cost to you</b>. Retailers pay this referral fee directly from their marketing budgets, ensuring you always enjoy standard pricing, sales, and platform vouchers.</p>
        <p class="mu" style="margin-top:20px;line-height:1.7">Our curation team selects garments and accessories based purely on design merits, fabric quality, and aesthetic value. An affiliate partnership never dictates product placement or positive reviews.</p>
      `
    },
    {
      slug: 'privacy',
      title: 'Privacy Policy — DevTosh Superbazaar',
      description: 'Read the privacy policy of DevTosh Superbazaar. Guest-first privacy architecture without mandatory logins or telemetry.',
      heading: 'Privacy Policy',
      body: `
        <p class="lead">DevTosh Superbazaar operates on a strict privacy-first principle. Customers are not required to create accounts, submit email addresses, or log in to browse products or save favourites.</p>
        <p class="mu" style="margin-top:16px;line-height:1.7">Your wishlist is saved locally in your own browser using standard HTML5 localStorage and is never transmitted to third parties.</p>
      `
    },
    {
      slug: 'terms',
      title: 'Terms of Use — DevTosh Superbazaar',
      description: 'Terms of service and catalog accuracy guidelines for DevTosh Superbazaar.',
      heading: 'Terms of Use',
      body: `
        <p class="lead">Welcome to DevTosh Superbazaar. Product details, prices, and availability are provided for discovery purposes and are subject to verification on official partner retailer websites.</p>
      `
    }
  ];

  for (const info of infoPages) {
    const canonicalUrl = `${BASE_ORIGIN}/${info.slug}/`;
    const jsonLd = {
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      'name': info.title,
      'description': info.description,
      'url': canonicalUrl,
      'isPartOf': {
        '@id': `${BASE_ORIGIN}/#website`
      }
    };

    const mainHtml = `
      <section class="w pgs">
        <nav class="bc" aria-label="Breadcrumb">
          <a href="/">Home</a> / <span aria-current="page">${esc(info.heading)}</span>
        </nav>
        <div class="tt">
          <h1 class="f" tabindex="-1">${esc(info.heading)}</h1>
        </div>
        <div style="margin-top:20px">
          ${info.body}
        </div>
      </section>
    `;

    const infoHtml = assembleHtml({
      title: `${info.title} | DevTosh Superbazaar`,
      description: info.description,
      canonicalUrl,
      jsonLd,
      mainHtml
    });

    writeDocument(info.slug, infoHtml);

    sitemapUrls.push({
      loc: canonicalUrl,
      changefreq: 'monthly',
      priority: '0.50'
    });
  }

  // ========================================================================
  // 6. Prerender Wishlist Page (dist/wishlist/index.html) - With Noindex
  // ========================================================================
  console.log('[SSG Prerender] Prerendering Wishlist (dist/wishlist/index.html)...');
  const wishlistCanonical = `${BASE_ORIGIN}/wishlist/`;
  const wishlistFaqs = [
    {
      q: 'How does the DevTosh Superbazaar Wishlist work?',
      a: 'Items you save by clicking the heart icon are stored privately in your browser using local storage. You do not need to create an account or provide personal data.'
    },
    {
      q: 'Will my saved wishlist items expire?',
      a: 'Saved items remain in your browser until you remove them or clear your browser browsing data. Wishlist items are never shared with third parties or indexed by search engines.'
    }
  ];

  const wishlistMainHtml = `
    <section class="w pgs wide">
      <nav class="bc" aria-label="Breadcrumb">
        <a href="/">Home</a> / <span aria-current="page">Wishlist</span>
      </nav>
      <div class="tt">
        <h1 class="f" tabindex="-1">Your Wishlist</h1>
        <span class="mu" id="wishlist-count-badge">Private Guest Wishlist</span>
      </div>
      <div id="wishlist-dynamic-container" style="margin-top:24px">
        <p class="lead">Your wishlist is currently empty or loading from local storage. Click the heart icon on any product to save it here for later reference.</p>
        <p style="margin-top:20px"><a class="vp" href="/">Explore All Collections →</a></p>
      </div>
      ${renderFaqsHtml(wishlistFaqs, 'Wishlist Questions & Privacy', 'How our private, guest-first wishlist works on your browser.', 'wishlist')}
    </section>
  `;

  // Wishlist explicitly has noindex: true and NO structured data
  const wishlistHtml = assembleHtml({
    title: 'My Saved Wishlist | DevTosh Superbazaar',
    description: 'View and manage your saved fashion, footwear, mobile accessories, and lifestyle items.',
    canonicalUrl: wishlistCanonical,
    noindex: true,
    mainHtml: wishlistMainHtml
  });

  writeDocument('wishlist', wishlistHtml);

  // ========================================================================
  // 7. Generate Universal sitemap.xml
  // ========================================================================
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(u => `  <url>
    <loc>${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  const sitemapPath = path.resolve(DIST_DIR, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, sitemapXml, 'utf8');
  console.log(`[SSG Prerender] Wrote ${path.relative(ROOT_DIR, sitemapPath)} with ${sitemapUrls.length} indexed URLs.`);

  // ========================================================================
  // 8. Generate robots.txt
  // ========================================================================
  const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /#/admin/

Sitemap: ${BASE_ORIGIN}/sitemap.xml
`;
  const robotsPath = path.resolve(DIST_DIR, 'robots.txt');
  fs.writeFileSync(robotsPath, robotsTxt, 'utf8');
  console.log(`[SSG Prerender] Wrote ${path.relative(ROOT_DIR, robotsPath)}`);

  // ========================================================================
  // 9. Generate 404.html (Clean error response without structured data; route-aware SPA loader)
  // ========================================================================
  const notFoundMainHtml = `
    <div id="ghp-404-msg">
      <section class="w pgs" style="text-align:center;padding:60px 20px">
        <h1 class="f" style="font-size:36px;margin-bottom:12px">Page Not Found (404)</h1>
        <p class="lead" style="margin:0 auto 24px;max-width:520px">The page or product you were looking for could not be found. It may have moved or been retired.</p>
        <p><a class="lm" href="/" style="text-decoration:none;display:inline-block;padding:12px 28px">Return to Homepage →</a></p>
      </section>
    </div>
    <div id="ghp-route-loading" style="display:none">
      <section class="w pgs wide">
        <nav class="bc" aria-label="Breadcrumb">
          <a href="/">Home</a> / <span>Loading Product…</span>
        </nav>
        <div class="dt" style="margin-top:24px">
          <div class="ph big" style="background:var(--bl);animation:1.5s ease-in-out infinite shimmer;min-height:460px;border-radius:4px"></div>
          <div>
            <div style="height:14px;width:120px;background:var(--bd);border-radius:3px;margin-bottom:14px;animation:1.5s ease-in-out infinite shimmer"></div>
            <div style="height:32px;width:85%;background:var(--bd);border-radius:4px;margin-bottom:18px;animation:1.5s ease-in-out infinite shimmer"></div>
            <div style="height:24px;width:40%;background:var(--bd);border-radius:3px;margin-bottom:24px;animation:1.5s ease-in-out infinite shimmer"></div>
            <div style="height:14px;width:95%;background:var(--bd);border-radius:3px;margin-bottom:10px;animation:1.5s ease-in-out infinite shimmer"></div>
            <div style="height:14px;width:90%;background:var(--bd);border-radius:3px;margin-bottom:10px;animation:1.5s ease-in-out infinite shimmer"></div>
            <div style="height:14px;width:75%;background:var(--bd);border-radius:3px;margin-bottom:28px;animation:1.5s ease-in-out infinite shimmer"></div>
            <div style="height:48px;width:220px;background:var(--sat);border-radius:3px;opacity:0.75"></div>
          </div>
        </div>
      </section>
    </div>
    <script>
      (function(){
        var p = window.location.pathname || '';
        if (p && (p.indexOf('/product/') !== -1 || p.indexOf('/category/') !== -1 || p.indexOf('/blog/') !== -1 || p.indexOf('/go/') !== -1)) {
          var m = document.getElementById('ghp-404-msg');
          var l = document.getElementById('ghp-route-loading');
          if (m) m.style.display = 'none';
          if (l) l.style.display = 'block';
        }
      })();
    </script>
  `;

  // 404.html explicitly has noindex: true and NO structured data
  const notFoundHtml = assembleHtml({
    title: 'Page Not Found | DevTosh Superbazaar',
    description: 'The requested page could not be located on DevTosh Superbazaar.',
    canonicalUrl: `${BASE_ORIGIN}/404.html`,
    noindex: true,
    mainHtml: notFoundMainHtml
  });

  const fallback404Path = path.resolve(DIST_DIR, '404.html');
  fs.writeFileSync(fallback404Path, notFoundHtml, 'utf8');
  console.log(`[SSG Prerender] Wrote clean ${path.relative(ROOT_DIR, fallback404Path)} for GitHub Pages fallback.`);

  // ========================================================================
  // 10. Copy static assets: .nojekyll, llms.txt, and README.md
  // ========================================================================
  const nojekyllPath = path.resolve(DIST_DIR, '.nojekyll');
  fs.writeFileSync(nojekyllPath, '', 'utf8');
  console.log(`[SSG Prerender] Wrote ${path.relative(ROOT_DIR, nojekyllPath)} for GitHub Pages.`);

  const llmsSrc = path.resolve(ROOT_DIR, 'public/llms.txt');
  if (fs.existsSync(llmsSrc)) {
    fs.copyFileSync(llmsSrc, path.resolve(DIST_DIR, 'llms.txt'));
    console.log('[SSG Prerender] Copied llms.txt to dist/');
  }

  const readmeSrc = path.resolve(ROOT_DIR, 'README.md');
  if (fs.existsSync(readmeSrc)) {
    fs.copyFileSync(readmeSrc, path.resolve(DIST_DIR, 'README.md'));
    console.log('[SSG Prerender] Copied README.md to dist/');
  }

  console.log('[SSG Prerender] Completed full static site generation successfully.');
}

// Execute when invoked directly
prerender().catch(err => {
  console.error('[SSG Prerender Error]', err);
  process.exit(1);
});
