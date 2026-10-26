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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const BASE_ORIGIN = 'https://devtoshsuperbazaar.github.io';

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

function parseMarkdownToHtml(md: string): string {
  const lines = md.trim().split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
      continue;
    }

    if (trimmed === '---') {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
      out.push('<hr class="art-divider" />');
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
      out.push(`<blockquote><p>${formatInline(trimmed.slice(2))}</p></blockquote>`);
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

function formatInline(str: string): string {
  return str
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
}

function renderStaticProductCard(p: Product): string {
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
          <img src="${esc(p.imgUrl)}" alt="${esc(p.name)}" loading="lazy" style="width:100%;height:100%;object-fit:cover" />
        ` : `
          <svg viewBox="0 0 100 125" role="img" aria-label="Illustration for ${esc(p.name)}"><use href="#${sh}"/></svg>
        `}
      </a>
      <button class="wl" id="wl-${p.slug}" data-a="wl" data-s="${p.slug}" aria-label="Save ${esc(p.name)} to wishlist">
        <svg aria-hidden="true" viewBox="0 0 24 24"><use href="#hrt"/></svg>
      </button>
      <div class="pi">
        <div class="rt">${esc(p.brand)}</div>
        <h3 class="pn"><a href="${u}">${esc(p.name)}</a></h3>
        <div class="pr">
          <b>${inr(p.price)}</b>
          ${p.mrp && d > 0 ? `<s><span class="sr">MRP </span>${inr(p.mrp)}</s><em>${d}% off</em>` : ''}
        </div>
        <div class="ck">Sold by ${esc(p.ret)} · Verified price · Checked Oct 2026</div>
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
    jsonLd: object;
    mainHtml: string;
  }): string {
    let out = baseHtml;
    // Replace <title>
    out = out.replace(/<title>.*?<\/title>/i, `<title>${esc(options.title)}</title>`);
    // Replace meta description
    out = out.replace(/<meta name="description" content=".*?"\s*\/?>/i, `<meta name="description" content="${esc(options.description)}">`);
    // Replace og:title
    out = out.replace(/<meta property="og:title" content=".*?"\s*\/?>/i, `<meta property="og:title" content="${esc(options.title)}">`);
    // Replace og:description
    out = out.replace(/<meta property="og:description" content=".*?"\s*\/?>/i, `<meta property="og:description" content="${esc(options.description)}">`);
    // Replace og:type
    out = out.replace(/<meta property="og:type" content=".*?"\s*\/?>/i, `<meta property="og:type" content="${options.ogType || 'website'}">`);

    // Head tags injection
    const ogImg = options.ogImage || `${BASE_ORIGIN}/favicon-48x48.png`;
    const headInject = `
  <link rel="canonical" href="${options.canonicalUrl}">
  <meta property="og:url" content="${options.canonicalUrl}">
  <meta property="og:image" content="${ogImg}">
  <meta name="twitter:image" content="${ogImg}">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <script type="application/ld+json">
${JSON.stringify(options.jsonLd, null, 2)}
  </script>
`;
    out = out.replace('</head>', `${headInject}</head>`);

    // Main body replacement
    out = out.replace('<main id="app" tabindex="-1"></main>', `<main id="app" tabindex="-1">${options.mainHtml}</main>`);
    return out;
  }

  // ========================================================================
  // 1. Prerender All Categories (/category/<slug>/)
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

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      'name': cat.name,
      'description': cat.description,
      'url': canonicalUrl,
      'isPartOf': {
        '@type': 'WebSite',
        '@id': `${BASE_ORIGIN}/#website`,
        'name': 'DevtoshSuperBazaar'
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
        <main class="mn" style="width:100%">
          <div class="tb">
            <div class="tl">
              <strong>${items.length} curated items</strong>
            </div>
          </div>
          <div class="g">${items.map(renderStaticProductCard).join('')}</div>
        </main>
      </div>
    `;

    const catHtml = assembleHtml({
      title: cat.title,
      description: cat.description,
      canonicalUrl,
      jsonLd,
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
  // 2. Prerender Every Single Product (/product/<slug>/)
  // ========================================================================
  console.log(`[SSG Prerender] Prerendering ${DEMO_PRODUCTS.length} single product pages...`);
  for (const p of DEMO_PRODUCTS) {
    const canonicalUrl = `${BASE_ORIGIN}/product/${p.slug}/`;
    const pageTitle = `${p.name} — Buy Online at Best Price | Devtosh SuperBazaar`;
    const pageDesc = `Discover ${p.name} by ${p.brand} at ₹${p.price} (MRP ₹${p.mrp || p.price}). ${p.desc}`;
    const ogImg = p.imgUrl || `${BASE_ORIGIN}/favicon-48x48.png`;
    const d = disc(p);

    const related = DEMO_PRODUCTS
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

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
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
          'name': p.ret || 'Meesho'
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
              <img src="${esc(p.imgUrl)}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover" />
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
              <a class="lm" href="${esc(p.affUrl || p.retUrl || '/')}" target="_blank" rel="noopener noreferrer">Shop at ${esc(p.ret)} ↗</a>
              <button class="wb" id="wb-${p.slug}" data-a="wl" data-s="${p.slug}" aria-label="Save to wishlist">
                <svg aria-hidden="true" viewBox="0 0 24 24"><use href="#hrt"/></svg>
                <span>Save to wishlist</span>
              </button>
            </div>

            <div class="sh-bar" role="region" aria-label="Share this product" style="margin-top:28px">
              <span class="sh-lbl">Share:</span>
              <a class="sh-btn wa" href="https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out ${p.name} on Devtosh SuperBazaar: ${canonicalUrl}`)}" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp">
                <svg aria-hidden="true"><use href="#wa"/></svg>
                <span>WhatsApp</span>
              </a>
              <a class="sh-btn tg" href="https://t.me/share/url?url=${encodeURIComponent(canonicalUrl)}&text=${encodeURIComponent(`Check out ${p.name} on Devtosh SuperBazaar`)}" target="_blank" rel="noopener noreferrer" aria-label="Share on Telegram">
                <svg aria-hidden="true"><use href="#tg"/></svg>
                <span>Telegram</span>
              </a>
              <button type="button" class="sh-btn" data-a="copy-prod-link" data-url="${esc(canonicalUrl)}" aria-label="Copy product link">
                <svg aria-hidden="true"><use href="#cp"/></svg>
                <span class="cp-text">Copy Link</span>
              </button>
            </div>

            <p class="dc" style="margin-top:24px"><b>Affiliate disclosure:</b> Devtosh SuperBazaar participates in affiliate partnerships and may earn a commission on qualifying purchases made through partner retailer links at no additional cost to you.</p>
          </div>
        </div>
        <h2 class="f rh">You may also like</h2>
        <div class="g">${related.map(renderStaticProductCard).join('')}</div>
      </section>
    `;

    const prodHtml = assembleHtml({
      title: pageTitle,
      description: pageDesc,
      canonicalUrl,
      ogType: 'product',
      ogImage: ogImg,
      jsonLd,
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
  // 3. Prerender Blog Articles (/blog/<slug>/) & Blog Index (/blog/)
  // ========================================================================
  console.log('[SSG Prerender] Prerendering blog articles and index...');
  const publishedArticles = SEED_ARTICLES.filter(a => a.published && !a.noindex);

  for (const article of publishedArticles) {
    const canonicalUrl = article.canonicalUrl || `${BASE_ORIGIN}/blog/${article.slug}/`;
    const pageTitle = `${article.metaTitle || article.title} — Devtosh SuperBazaar`;
    const pageDesc = article.metaDesc || article.excerpt;
    const ogImg = article.ogImage || article.coverImage || `${BASE_ORIGIN}/favicon-48x48.png`;
    const readTime = article.readTimeMinutes || calculateReadTime(article.content);
    const pubDateStr = formatBlogDate(article.publishedAt);
    const modDateStr = formatBlogDate(article.updatedAt || article.publishedAt);
    const renderedContent = parseMarkdownToHtml(article.content);
    const shareTitle = encodeURIComponent(article.title);
    const shareUrl = encodeURIComponent(canonicalUrl);

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
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
        '@type': 'Organization',
        'name': 'DevtoshSuperBazaar',
        'url': BASE_ORIGIN,
        'logo': {
          '@type': 'ImageObject',
          'url': `${BASE_ORIGIN}/favicon-48x48.png`
        }
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
                    ${article.updatedAt !== article.publishedAt ? ` · Updated <time datetime="${article.updatedAt}">${modDateStr}</time>` : ''}
                  </div>
                </div>
              </div>
            </div>
          </header>

          ${article.coverImage ? `
            <figure class="art-cover-fig">
              <img class="art-cover-img" src="${esc(article.coverImage)}" alt="${esc(article.coverImageAlt)}" loading="eager" />
            </figure>
          ` : ''}

          ${article.hasAffiliateLinks ? `
            <aside class="art-disclosure" role="note">
              <strong>Editorial &amp; Affiliate Disclosure:</strong> Devtosh SuperBazaar curates independent style recommendations. This article contains verified merchant partner links. When you purchase through links in this guide, we may earn a referral commission at no extra cost to you.
            </aside>
          ` : ''}

          <div class="art-content">
            ${renderedContent}
          </div>

          <!-- Social Share Bar -->
          <div class="sh-bar" role="region" aria-label="Share this guide" style="margin-top:40px">
            <span class="sh-lbl">Share Guide:</span>
            <a class="sh-btn wa" href="https://api.whatsapp.com/send?text=${shareTitle}%20${shareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share guide on WhatsApp">
              <svg aria-hidden="true" width="15" height="15"><use href="#wa"/></svg>
              <span>WhatsApp</span>
            </a>
            <a class="sh-btn tg" href="https://t.me/share/url?url=${shareUrl}&text=${shareTitle}" target="_blank" rel="noopener noreferrer" aria-label="Share guide on Telegram">
              <svg aria-hidden="true" width="15" height="15"><use href="#tg"/></svg>
              <span>Telegram</span>
            </a>
            <button type="button" class="sh-btn" data-a="copy-prod-link" data-url="${esc(canonicalUrl)}" aria-label="Copy guide link">
              <svg aria-hidden="true" width="15" height="15"><use href="#cp"/></svg>
              <span class="cp-text">Copy Link</span>
            </button>
          </div>

          <div style="margin-top:40px;padding-top:20px;border-top:1px solid var(--bd);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
            <a href="/blog/" class="vp">← Back to all style guides</a>
            <a href="/" class="vp">Explore collections catalogue →</a>
          </div>
        </article>
      </section>
    `;

    const artHtml = assembleHtml({
      title: pageTitle,
      description: pageDesc,
      canonicalUrl,
      ogType: 'article',
      ogImage: ogImg,
      jsonLd,
      mainHtml
    });

    writeDocument(`blog/${article.slug}`, artHtml);

    sitemapUrls.push({
      loc: canonicalUrl,
      lastmod: (article.updatedAt || article.publishedAt).split('T')[0],
      changefreq: 'weekly',
      priority: '0.75'
    });
  }

  // Blog Index (/blog/)
  const blogIndexCanonical = `${BASE_ORIGIN}/blog/`;
  const blogIndexJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    'name': 'Devtosh SuperBazaar Editorial Blog',
    'description': 'Fashion styling tips, Meesho shopping strategies, ethnic wear advice, and lifestyle discovery guides.',
    'url': blogIndexCanonical
  };

  const blogIndexMainHtml = `
    <section class="w ih">
      <nav class="bc" aria-label="Breadcrumb">
        <a href="/">Home</a> / <span aria-current="page">Editorial Blog</span>
      </nav>
      <div class="tt">
        <h1 class="f" tabindex="-1">Editorial Blog &amp; Guides</h1>
        <span class="mu">${publishedArticles.length} guides</span>
      </div>
      <p class="lead">Curated styling inspiration, fabric guides, smart shopping advice, and daily fashion discovery.</p>
    </section>

    <div class="w" style="margin-top:24px;margin-bottom:60px">
      <div class="art-grid">
        ${publishedArticles.map(art => `
          <article class="art-card">
            ${art.coverImage ? `
              <a href="/blog/${art.slug}/" class="art-card-img-wrap" tabindex="-1" aria-hidden="true">
                <img src="${esc(art.coverImage)}" alt="${esc(art.coverImageAlt)}" loading="lazy" />
              </a>
            ` : ''}
            <div class="art-card-body">
              <div class="art-card-meta">
                <span class="tag">${esc(art.category)}</span>
                <span class="mu">${art.readTimeMinutes || 5} min read</span>
              </div>
              <h2 class="art-card-title">
                <a href="/blog/${art.slug}/">${esc(art.title)}</a>
              </h2>
              <p class="art-card-excerpt">${esc(art.excerpt)}</p>
              <div class="art-card-footer">
                <span class="mu">By ${esc(art.authorName)}</span>
                <a href="/blog/${art.slug}/" class="art-read-more">Read Guide →</a>
              </div>
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `;

  const blogIndexHtml = assembleHtml({
    title: 'Editorial Blog & Style Guides — Devtosh SuperBazaar',
    description: 'Curated fashion styling tips, Meesho shopping strategies, ethnic wear care, and lifestyle guides.',
    canonicalUrl: blogIndexCanonical,
    jsonLd: blogIndexJsonLd,
    mainHtml: blogIndexMainHtml
  });

  writeDocument('blog', blogIndexHtml);
  sitemapUrls.push({
    loc: blogIndexCanonical,
    changefreq: 'daily',
    priority: '0.80'
  });

  // ========================================================================
  // 4. Prerender Informational Pages (/about/, /contact/, etc.)
  // ========================================================================
  console.log('[SSG Prerender] Prerendering informational pages...');
  const infoPages = [
    {
      slug: 'about',
      title: 'About Devtosh SuperBazaar — Curated Fashion & Lifestyle Discovery',
      description: 'Devtosh SuperBazaar connects smart shoppers across India with handpicked fashion, smartphones, footwear, and lifestyle essentials.',
      heading: 'About Devtosh SuperBazaar',
      body: `
        <p class="lead">Devtosh SuperBazaar is an independent editorial discovery platform that handpicks high-value fashion, smartphones, accessories, and lifestyle essentials from trusted retailer marketplaces.</p>
        <p class="mu" style="margin-top:16px;line-height:1.7">We simplify online shopping by filtering through millions of listings to highlight items that offer exceptional design, reliable merchant ratings, and unmatched value.</p>
      `
    },
    {
      slug: 'contact',
      title: 'Contact & Inquiries — Devtosh SuperBazaar',
      description: 'Contact Devtosh SuperBazaar for customer feedback, brand partnerships, or editorial inquiries.',
      heading: 'Contact & Inquiries',
      body: `
        <p class="lead">Have questions about our curated selections, partner brand integrations, or platform feedback? We’d love to hear from you.</p>
        <div style="margin-top:24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px">
          <div class="adm-card">
            <h2 class="f" style="font-size:18px;margin:0 0 8px;color:var(--dp)">General & Editorial Inquiries</h2>
            <p class="mu" style="font-size:13.5px;line-height:1.5;margin:0 0 12px">For feedback on featured collections or curation.</p>
            <div style="font-weight:600;color:var(--wn)"><a href="mailto:devtoshsuperbazaar@gmail.com" style="color:inherit;text-decoration:none">devtoshsuperbazaar@gmail.com</a></div>
          </div>
          <div class="adm-card">
            <h2 class="f" style="font-size:18px;margin:0 0 8px;color:var(--dp)">Brand & Retailer Partnerships</h2>
            <p class="mu" style="font-size:13.5px;line-height:1.5;margin:0 0 12px">Retailers interested in being featured in our catalogue.</p>
            <div style="font-weight:600;color:var(--wn)"><a href="mailto:devtoshsuperbazaar@gmail.com" style="color:inherit;text-decoration:none">devtoshsuperbazaar@gmail.com</a></div>
          </div>
        </div>
      `
    },
    {
      slug: 'affiliate-disclosure',
      title: 'Affiliate Disclosure — Devtosh SuperBazaar',
      description: 'Learn how Devtosh SuperBazaar maintains editorial independence and how affiliate partnerships work.',
      heading: 'Affiliate Transparency Statement',
      body: `
        <div class="adm-card" style="border-left:3px solid var(--wn);margin-top:20px">
          <p style="margin:0;font-size:14.5px">Devtosh SuperBazaar participates in affiliate partnerships and may earn a commission on qualifying purchases made through partner retailer links at no additional cost to you.</p>
        </div>
        <p class="mu" style="margin-top:20px;line-height:1.7">Our curation team selects garments and accessories based purely on design merits, fabric quality, and aesthetic value. An affiliate partnership never dictates product placement or positive reviews.</p>
      `
    },
    {
      slug: 'privacy',
      title: 'Privacy Policy — Devtosh SuperBazaar',
      description: 'Read the privacy policy of Devtosh SuperBazaar. Guest-first privacy architecture without mandatory logins or telemetry.',
      heading: 'Privacy Policy',
      body: `
        <p class="lead">Devtosh SuperBazaar operates on a strict privacy-first principle. Customers are not required to create accounts, submit email addresses, or log in to browse products or save favourites.</p>
        <p class="mu" style="margin-top:16px;line-height:1.7">Your wishlist is saved locally in your own browser using standard HTML5 localStorage and is never transmitted to third parties.</p>
      `
    },
    {
      slug: 'terms',
      title: 'Terms of Use — Devtosh SuperBazaar',
      description: 'Terms of service and catalog accuracy guidelines for Devtosh SuperBazaar.',
      heading: 'Terms of Use',
      body: `
        <p class="lead">Welcome to Devtosh SuperBazaar. Product details, prices, and availability are provided for discovery purposes and are subject to verification on official partner retailer websites.</p>
      `
    }
  ];

  for (const info of infoPages) {
    const canonicalUrl = `${BASE_ORIGIN}/${info.slug}/`;
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      'name': info.title,
      'description': info.description,
      'url': canonicalUrl
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
      title: `${info.title} | Devtosh SuperBazaar`,
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
  // 5. Generate Universal sitemap.xml
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
  // 6. Generate robots.txt
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
  // 7. Generate 404.html, .nojekyll, and copy README.md
  // ========================================================================
  const fallback404Path = path.resolve(DIST_DIR, '404.html');
  fs.writeFileSync(fallback404Path, baseHtml, 'utf8');
  console.log(`[SSG Prerender] Wrote ${path.relative(ROOT_DIR, fallback404Path)} for GitHub Pages fallback.`);

  const nojekyllPath = path.resolve(DIST_DIR, '.nojekyll');
  fs.writeFileSync(nojekyllPath, '', 'utf8');
  console.log(`[SSG Prerender] Wrote ${path.relative(ROOT_DIR, nojekyllPath)} for GitHub Pages.`);

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
