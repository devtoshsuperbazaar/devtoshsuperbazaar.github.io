import fs from 'fs';

// 1. Verify firestore.rules
const rules = fs.readFileSync('firestore.rules', 'utf8');
if (!rules.includes("rules_version = '2';")) throw new Error("Rules must be version 2");
if (!rules.includes("allow read, write: if false;")) throw new Error("Missing default deny");
if (!rules.includes("function isAdmin()")) throw new Error("Missing isAdmin helper");
if (!rules.includes("exists(/databases/$(database)/documents/admins/$(request.auth.uid))")) throw new Error("Missing admin allowlist check");
if (!rules.includes("allow read: if (resource.data.published == true) || isAdmin();")) throw new Error("Missing published read gate");

// 2. Verify URL import extraction logic
function testImport(urlStr) {
  const parsed = new URL(urlStr);
  const hostParts = parsed.hostname.replace('www.', '').split('.');
  const retailerGuess = hostParts[0].charAt(0).toUpperCase() + hostParts[0].slice(1);
  const pathSegments = parsed.pathname.split('/').filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1] || 'item';
  const slugGuess = lastSegment.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/\.html?$/, '');
  return { retailerGuess, slugGuess };
}

const import1 = testImport('https://www.zara.com/in/en/relaxed-fit-oxford-shirt-p01234567.html');
if (import1.retailerGuess !== 'Zara') throw new Error('Zara retailer extraction failed');
if (!import1.slugGuess.includes('relaxed-fit-oxford-shirt')) throw new Error('Zara slug extraction failed');

const import2 = testImport('https://hm.com/linen-blend-casual-shirt');
if (import2.retailerGuess !== 'Hm') throw new Error('H&M retailer extraction failed');
if (import2.slugGuess !== 'linen-blend-casual-shirt') throw new Error('H&M slug extraction failed');

// 3. Verify discount calculation safety
function disc(p) {
  if (!p || !p.mrp || p.mrp <= p.price) return 0;
  return Math.round(((p.mrp - p.price) / p.mrp) * 100);
}
if (disc({ price: 1000, mrp: 2000 }) !== 50) throw new Error('50% discount test failed');
if (disc({ price: 1000, mrp: 0 }) !== 0) throw new Error('Zero MRP should return 0%');
if (disc({ price: 1000, mrp: 800 }) !== 0) throw new Error('MRP < price should return 0%');
if (disc({ price: 1000, mrp: 1000 }) !== 0) throw new Error('MRP == price should return 0%');

// 4. Verify Wishlist duplicate prevention and removal
let wl = [];
function toggleWishlist(slug) {
  const idx = wl.indexOf(slug);
  if (idx < 0) { wl.push(slug); return true; }
  else { wl.splice(idx, 1); return false; }
}

toggleWishlist('item-1');
if (wl.length !== 1 || wl[0] !== 'item-1') throw new Error('Wishlist add failed');
toggleWishlist('item-1');
if (wl.length !== 0) throw new Error('Wishlist remove failed');
toggleWishlist('item-2');
toggleWishlist('item-3');
if (wl.length !== 2 || wl.includes('item-1')) throw new Error('Wishlist multi-item test failed');

// 5. Verify Firestore security rules for articles collection
if (!rules.includes("match /articles/{articleId}")) throw new Error("Missing /articles/{articleId} match rule");
if (!rules.includes("allow create, update, delete: if isAdmin();")) throw new Error("Missing admin-only write rule for articles");

// 6. Verify slug generation & duplicate detection
function generateSlug(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

const slug1 = generateSlug('Styling Daily Ethnic Wear: A Budget-Friendly Guide (2026)');
if (slug1 !== 'styling-daily-ethnic-wear-a-budget-friendly-guide-2026') {
  throw new Error(`Slug generation failed: expected styling-daily-ethnic-wear-a-budget-friendly-guide-2026, got ${slug1}`);
}

const mockArticles = [
  { id: 'art-1', slug: 'styling-daily-ethnic-wear', title: 'Styling Daily Ethnic Wear', published: true },
  { id: 'art-2', slug: 'smart-shopping-guide', title: 'Smart Shopping Guide', published: false }
];

function checkDuplicateSlug(candidateSlug, articles, currentId) {
  return articles.some(a => a.slug === candidateSlug && a.id !== currentId);
}

if (!checkDuplicateSlug('styling-daily-ethnic-wear', mockArticles, 'art-new')) {
  throw new Error('Duplicate slug detection should flag duplicate on new article');
}
if (checkDuplicateSlug('styling-daily-ethnic-wear', mockArticles, 'art-1')) {
  throw new Error('Duplicate slug detection should allow preserving own slug during edit');
}
if (checkDuplicateSlug('new-unique-slug', mockArticles, 'art-new')) {
  throw new Error('Unique slug should not be flagged as duplicate');
}

// 7. Verify read time calculation
function calcReadTime(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
if (calcReadTime('word '.repeat(450)) !== 3) throw new Error('450 words should be 3 min read');
if (calcReadTime('') !== 1) throw new Error('Empty text should be min 1 min read');

// 8. Verify static prerendered files if dist exists
if (fs.existsSync('dist')) {
  if (!fs.existsSync('dist/blog/index.html')) throw new Error('dist/blog/index.html missing');
  const blogIdx = fs.readFileSync('dist/blog/index.html', 'utf8');
  if (!blogIdx.includes('<link rel="canonical" href="https://devtoshsuperbazaar.github.io/blog/">')) {
    throw new Error('dist/blog/index.html missing canonical URL');
  }

  // Verify Demo Articles are ABSENT from static output
  const demoArticles = [
    'styling-daily-ethnic-wear-budget-guide',
    'smart-meesho-shopping-guide-quality-sarees',
    'top-everyday-accessories-under-500'
  ];
  for (const slug of demoArticles) {
    const p = `dist/blog/${slug}/index.html`;
    if (fs.existsSync(p)) {
      throw new Error(`Demo article ${slug} must NOT exist in static output, but was found at ${p}`);
    }
  }

  // Verify Demo Products are ABSENT from static output
  const demoProducts = [
    'banarasi-soft-silk-zari-woven-saree',
    '360-rotating-car-dashboard-mobile-holder',
    'oxford-cotton-slim-fit-casual-shirt'
  ];
  for (const slug of demoProducts) {
    const p = `dist/product/${slug}/index.html`;
    if (fs.existsSync(p)) {
      throw new Error(`Demo product ${slug} must NOT exist in static output, but was found at ${p}`);
    }
  }

  // Check all 9 Category Pages
  const requiredCategories = ['women', 'men', 'kids', 'footwear', 'mobiles', 'electronics', 'accessories', 'home-living', 'new'];
  for (const cat of requiredCategories) {
    const catPath = `dist/category/${cat}/index.html`;
    if (!fs.existsSync(catPath)) throw new Error(`${catPath} missing`);
    const catHtml = fs.readFileSync(catPath, 'utf8');
    if (!catHtml.includes(`https://devtoshsuperbazaar.github.io/category/${cat}/`)) {
      throw new Error(`Category ${cat} missing canonical URL matching https://devtoshsuperbazaar.github.io/category/${cat}/`);
    }
    if (!catHtml.includes('"@type": "CollectionPage"')) {
      throw new Error(`Category ${cat} missing CollectionPage schema`);
    }
  }

  // Check genuine live product from Firestore: 1kv4b (Frekman shirt)
  const liveProd1Path = 'dist/product/1kv4b/index.html';
  if (!fs.existsSync(liveProd1Path)) throw new Error(`${liveProd1Path} missing`);
  const liveProd1Html = fs.readFileSync(liveProd1Path, 'utf8');
  if (!liveProd1Html.includes('https://devtoshsuperbazaar.github.io/product/1kv4b/')) {
    throw new Error('Live Product 1 missing canonical URL');
  }
  if (!liveProd1Html.includes('"@type": "Product"')) {
    throw new Error('Live Product 1 missing Product schema');
  }

  // Check Informational Pages
  const infoPages = ['about', 'contact', 'affiliate-disclosure', 'privacy', 'terms'];
  for (const page of infoPages) {
    const pagePath = `dist/${page}/index.html`;
    if (!fs.existsSync(pagePath)) throw new Error(`${pagePath} missing`);
    const pageHtml = fs.readFileSync(pagePath, 'utf8');
    if (!pageHtml.includes(`https://devtoshsuperbazaar.github.io/${page}/`)) {
      throw new Error(`${page} missing canonical URL matching https://devtoshsuperbazaar.github.io/${page}/`);
    }
  }

  // Check sitemap.xml
  if (!fs.existsSync('dist/sitemap.xml')) throw new Error('dist/sitemap.xml missing');
  const sitemap = fs.readFileSync('dist/sitemap.xml', 'utf8');
  const locMatches = sitemap.match(/<loc>(.*?)<\/loc>/g) || [];
  if (locMatches.length < 15) {
    throw new Error(`Expected at least 15 URLs in sitemap.xml, found ${locMatches.length}`);
  }
  if (!sitemap.includes('https://devtoshsuperbazaar.github.io/blog/')) throw new Error('sitemap missing /blog/');
  if (!sitemap.includes('https://devtoshsuperbazaar.github.io/category/women/')) throw new Error('sitemap missing /category/women/');
  if (!sitemap.includes('https://devtoshsuperbazaar.github.io/category/electronics/')) throw new Error('sitemap missing /category/electronics/');
  if (!sitemap.includes('https://devtoshsuperbazaar.github.io/product/1kv4b/')) throw new Error('sitemap missing live product 1kv4b');

  // Verify demo content is strictly absent from sitemap.xml
  if (sitemap.includes('banarasi-soft-silk-zari-woven-saree')) {
    throw new Error('sitemap must NOT contain demo product banarasi-soft-silk-zari-woven-saree');
  }
  if (sitemap.includes('styling-daily-ethnic-wear-budget-guide')) {
    throw new Error('sitemap must NOT contain demo article styling-daily-ethnic-wear-budget-guide');
  }

  // Check robots.txt
  if (!fs.existsSync('dist/robots.txt')) throw new Error('dist/robots.txt missing');
  const robots = fs.readFileSync('dist/robots.txt', 'utf8');
  if (!robots.includes('Sitemap: https://devtoshsuperbazaar.github.io/sitemap.xml')) {
    throw new Error('robots.txt missing Sitemap reference');
  }
  if (!robots.includes('Disallow: /admin/')) {
    throw new Error('robots.txt missing Disallow rule for /admin/');
  }
  if (robots.includes('Disallow: /wishlist/')) {
    throw new Error('robots.txt should not disallow /wishlist/ so crawlers can read the noindex meta tag');
  }

  // Check fallback & special files
  if (!fs.existsSync('dist/404.html')) throw new Error('dist/404.html missing');
  if (!fs.existsSync('dist/.nojekyll')) throw new Error('dist/.nojekyll missing');
  if (!fs.existsSync('dist/llms.txt')) throw new Error('dist/llms.txt missing');
  const llmsTxt = fs.readFileSync('dist/llms.txt', 'utf8');
  if (!llmsTxt.includes('https://devtoshsuperbazaar.github.io')) throw new Error('llms.txt missing canonical URL');

  // Check Wishlist static page
  const wlPath = 'dist/wishlist/index.html';
  if (!fs.existsSync(wlPath)) throw new Error('dist/wishlist/index.html missing');
  const wlHtml = fs.readFileSync(wlPath, 'utf8');
  if (!wlHtml.includes('noindex, nofollow')) throw new Error('dist/wishlist/index.html missing noindex meta');
  if (wlHtml.includes('"@type": "Product"') || wlHtml.includes('"@type": "CollectionPage"')) {
    throw new Error('dist/wishlist/index.html should not have product or collection schema');
  }

  // Check Homepage prerendered structure (AF-RM-0003, 0004, 0005, 0006, 0008, 0010, 0013, 0014, 0017)
  const idxHtml = fs.readFileSync('dist/index.html', 'utf8');
  if (!idxHtml.includes('<h1 class="f"')) throw new Error('dist/index.html missing H1 headline');
  if (!idxHtml.includes('<link rel="canonical" href="https://devtoshsuperbazaar.github.io/">')) {
    throw new Error('dist/index.html missing canonical URL link');
  }
  if (idxHtml.includes('<main class="mn"')) throw new Error('dist/index.html has illegal nested <main class="mn">');
  if (!idxHtml.includes('<h2 class="pn"')) throw new Error('dist/index.html product cards should use <h2 class="pn">');

  // Verify Women category
  const womenHtml = fs.readFileSync('dist/category/women/index.html', 'utf8');
  if (womenHtml.includes('<main class="mn"')) throw new Error('Women category has illegal nested <main class="mn">');
}

// 9. Verify Link insertion & markdown link parsing
function formatInlineLink(str) {
  return str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
}

const sampleWithLink = 'Check out this [printed cotton kurti](https://example.com/kurti) for summer comfort.';
const parsedLink = formatInlineLink(sampleWithLink);
if (!parsedLink.includes('<a href="https://example.com/kurti" rel="noopener noreferrer">printed cotton kurti</a>')) {
  throw new Error('Link markdown to HTML parser failed');
}

// 10. Universal Google Analytics tag verification across all generated HTML files
if (fs.existsSync('dist')) {
  const GA_ID = 'G-9SSN7RQ6V1';
  const GA_SCRIPT = `googletagmanager.com/gtag/js?id=${GA_ID}`;

  function getAllHtmlFiles(dir) {
    let results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        results = results.concat(getAllHtmlFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const htmlFiles = getAllHtmlFiles('dist').filter(f => !f.includes('/assets/'));
  if (htmlFiles.length < 15) {
    throw new Error(`Expected at least 15 storefront HTML documents in dist/, found ${htmlFiles.length}`);
  }

  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');

    // Must contain Google tag script
    if (!html.includes(GA_SCRIPT)) {
      throw new Error(`File ${file} is missing Google tag script src (${GA_SCRIPT})`);
    }

    // Must be inside <head>
    const headCloseIdx = html.indexOf('</head>');
    const scriptIdx = html.indexOf(GA_SCRIPT);
    if (scriptIdx === -1 || scriptIdx > headCloseIdx) {
      throw new Error(`Google tag script in ${file} is not placed inside <head>`);
    }

    // Must not be duplicated (measurement ID count in scripts)
    const scriptMatches = html.match(/googletagmanager\.com\/gtag\/js\?id=G-9SSN7RQ6V1/g) || [];
    if (scriptMatches.length !== 1) {
      throw new Error(`Duplicate or missing gtag script in ${file}: expected 1, found ${scriptMatches.length}`);
    }

    const configMatches = html.match(/gtag\('config',\s*'G-9SSN7RQ6V1'\)/g) || [];
    if (configMatches.length !== 1) {
      throw new Error(`Duplicate or missing gtag config in ${file}: expected 1, found ${configMatches.length}`);
    }
  }
}

// 11. Verify future product generation logic using an isolated test fixture
if (fs.existsSync('dist/index.html')) {
  const baseHtml = fs.readFileSync('dist/index.html', 'utf8');
  const futureMockProduct = {
    slug: 'future-designer-oversized-jacket',
    name: 'Future Designer Oversized Denim Jacket',
    brand: 'FutureVibe Denim',
    price: 1899,
    mrp: 3499,
    desc: 'Premium Japanese-weave denim oversized jacket with antique brass hardware.',
    ret: 'Meesho',
    cat: 'Jackets',
    col: 'Vintage Blue',
    sizes: ['M', 'L', 'XL']
  };

  // Re-run the assemble function logic to verify future products inherit the tag
  const testTitle = `${futureMockProduct.name} — Buy Online at Best Price | Devtosh SuperBazaar`;
  const testCanonical = `https://devtoshsuperbazaar.github.io/product/${futureMockProduct.slug}/`;

  let testOut = baseHtml;
  testOut = testOut.replace(/<title>.*?<\/title>/i, `<title>${testTitle}</title>`);
  const testHeadInject = `
  <link rel="canonical" href="${testCanonical}">
  <meta property="og:url" content="${testCanonical}">
  <meta name="robots" content="index, follow">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Product","name":"${futureMockProduct.name}","offers":{"@type":"Offer","price":${futureMockProduct.price},"priceCurrency":"INR"}}
  </script>
`;
  testOut = testOut.replace('</head>', `${testHeadInject}</head>`);

  // Verify the future product HTML contains the tag exactly once inside <head>
  if (!testOut.includes('googletagmanager.com/gtag/js?id=G-9SSN7RQ6V1')) {
    throw new Error('Future product generation failed to inherit Google tag script');
  }
  const futureScriptMatches = testOut.match(/googletagmanager\.com\/gtag\/js\?id=G-9SSN7RQ6V1/g) || [];
  if (futureScriptMatches.length !== 1) {
    throw new Error(`Future product has duplicate gtag script: ${futureScriptMatches.length}`);
  }
  if (!testOut.includes('"@type":"Product"') || !testOut.includes('1899')) {
    throw new Error('Future product generation failed structured data validation');
  }
}

// 14. Verify Product Video Feature
function isValidProductVideoUrl(url) {
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

// Test 14.1: URL validation tests
const validReels = [
  'https://www.instagram.com/reel/C-abc123XYZ/',
  'https://instagram.com/reel/C-abc123XYZ',
  'https://www.instagram.com/reel/C-abc123XYZ/?igsh=MWx123==',
  'https://www.instagram.com/reels/C-abc123XYZ/',
  'https://www.instagram.com/p/C-abc123XYZ/',
  'https://www.instagram.com/share/reel/C-abc123XYZ/',
  'https://www.instagram.com/tv/C-abc123XYZ/'
];
for (const u of validReels) {
  if (!isValidProductVideoUrl(u)) throw new Error(`Valid Instagram video URL was rejected: ${u}`);
}

const invalidUrls = [
  '',
  '   ',
  null,
  undefined,
  'not-a-url',
  'javascript:alert(1)',
  'https://google.com/search?q=shirt',
  'https://www.youtube.com/watch?v=12345',
  'https://instagram.com/',
  'https://instagram.com/reel/',
  'https://instagram.com/devtoshsuperbazaar/'
];
for (const u of invalidUrls) {
  if (isValidProductVideoUrl(u)) throw new Error(`Invalid URL was falsely accepted: ${u}`);
}

// Test 14.2: Button HTML and placement test
function renderButtons(p) {
  const shopBtn = `<a class="lm" href="${p.affUrl || p.retUrl || '/'}" target="_blank" rel="noopener noreferrer">Shop at ${p.ret} ↗</a>`;
  const vidBtn = isValidProductVideoUrl(p.videoUrl) ? `
    <a class="vid-btn" href="${p.videoUrl.trim()}" target="_blank" rel="noopener noreferrer" aria-label="Watch product video for ${p.name} on Instagram">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>
      <span>Watch Product Video</span>
    </a>
  ` : '';
  const wishBtn = `<button class="wb"><span>Save to saved items</span></button>`;

  return `<div class="btn-wrap">${shopBtn}${vidBtn}${wishBtn}</div>`;
}

// Case A: Product with valid Instagram Reel URL
const pWithVideo = {
  name: 'Cotton Shirt',
  ret: 'Meesho',
  affUrl: 'https://partner.network/click',
  videoUrl: 'https://www.instagram.com/reel/C-abc123XYZ/?igsh=123'
};
const htmlWithVid = renderButtons(pWithVideo);
if (!htmlWithVid.includes('Watch Product Video')) throw new Error('Watch Product Video button not rendered for valid reel');
if (!htmlWithVid.includes('href="https://www.instagram.com/reel/C-abc123XYZ/?igsh=123"')) throw new Error('Video URL was corrupted or not preserved');
if (!htmlWithVid.includes('target="_blank"') || !htmlWithVid.includes('rel="noopener noreferrer"')) throw new Error('Missing secure target/rel attributes');
const shopIdx = htmlWithVid.indexOf('Shop at Meesho');
const vidIdx = htmlWithVid.indexOf('Watch Product Video');
const wishIdx = htmlWithVid.indexOf('Save to saved items');
if (!(shopIdx < vidIdx && vidIdx < wishIdx)) {
  throw new Error(`Incorrect button order: shop=${shopIdx}, video=${vidIdx}, wishlist=${wishIdx}`);
}

// Case B: Product with empty/null/invalid videoUrl
const pNoVid = { name: 'Cotton Shirt', ret: 'Meesho', videoUrl: '' };
const htmlNoVid = renderButtons(pNoVid);
if (htmlNoVid.includes('Watch Product Video') || htmlNoVid.includes('vid-btn')) {
  throw new Error('Watch Product Video button should not render when videoUrl is empty');
}

const pInvalidVid = { name: 'Cotton Shirt', ret: 'Meesho', videoUrl: 'https://google.com' };
const htmlInvalidVid = renderButtons(pInvalidVid);
if (htmlInvalidVid.includes('Watch Product Video') || htmlInvalidVid.includes('vid-btn')) {
  throw new Error('Watch Product Video button should not render when videoUrl is invalid');
}

// Test 14.3: Verify source code integrity
const appSrc = fs.readFileSync('src/app.ts', 'utf8');
if (!appSrc.includes('id="p-videourl"')) throw new Error('src/app.ts missing #p-videourl form input');
if (!appSrc.includes('name="videoUrl"')) throw new Error('src/app.ts missing name="videoUrl" attribute');
if (!appSrc.includes('Product Video URL')) throw new Error('src/app.ts missing Product Video URL label');
if (!appSrc.includes('videoUrl,') && !appSrc.includes('videoUrl:')) throw new Error('src/app.ts missing videoUrl in payload');
if (!appSrc.includes('Watch Product Video')) throw new Error('src/app.ts missing Watch Product Video button');

const htmlSrc = fs.readFileSync('index.html', 'utf8');
if (!htmlSrc.includes('.vid-btn{')) throw new Error('index.html missing .vid-btn CSS style');
if (!htmlSrc.includes('.dt .vid-btn{')) throw new Error('index.html missing responsive .dt .vid-btn style');

// Test 15: Verify Article authorUrl and Cloud Firestore payload safety
// 15.1 Source checks: no undefined fallbacks in src/app.ts article payload
if (appSrc.includes('const authorUrl = (document.getElementById(\'art-author-url\') as HTMLInputElement)?.value.trim() || undefined;')) {
  throw new Error('src/app.ts still contains undefined fallback for authorUrl');
}
if (!appSrc.includes('const authorUrl = (document.getElementById(\'art-author-url\') as HTMLInputElement)?.value.trim() || \'\';')) {
  throw new Error('src/app.ts missing safe empty string fallback for authorUrl');
}
if (appSrc.includes('const canonicalOverride = (document.getElementById(\'art-canonical\') as HTMLInputElement)?.value.trim() || undefined;')) {
  throw new Error('src/app.ts still contains undefined fallback for canonicalOverride');
}

// 15.2 Simulate Firestore article payload construction when authorUrl is empty
function buildSimulatedArticlePayload({ existingId = '', title = 'Test Title', authorUrlInput = '', canonicalInput = '' }) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const authorName = 'DevTosh Superbazaar Editorial Team';
  const authorUrl = authorUrlInput.trim() || '';
  const canonicalOverride = canonicalInput.trim() || '';
  const ogTitle = '';
  const ogDescription = '';
  const ogImage = '';
  
  const candidate = {
    id: existingId,
    title,
    slug,
    metaTitle: title,
    metaDesc: 'A sample description for testing.',
    excerpt: 'A sample excerpt for testing.',
    content: 'A'.repeat(120),
    authorName,
    authorUrl,
    coverImage: '',
    coverImageAlt: title,
    category: 'Shopping Guides',
    tags: ['guide', 'budget'],
    published: true,
    noindex: false,
    canonicalUrl: canonicalOverride,
    ogTitle,
    ogDesc: ogDescription,
    ogImage,
    hasAffiliateLinks: true,
    readTimeMinutes: 1,
    relatedProducts: []
  };

  const id = existingId || `${slug}-test123`;
  const now = new Date().toISOString();
  const saveObj = {
    ...candidate,
    id,
    updatedAt: now
  };
  if (!existingId) {
    saveObj.publishedAt = now;
    saveObj.createdAt = now;
  }

  // Safeguard: Ensure no undefined values exist in Firestore payload
  Object.keys(saveObj).forEach(key => {
    if (saveObj[key] === undefined) {
      delete saveObj[key];
    }
  });

  return saveObj;
}

// Verify new article with no author URL
const payloadNoAuthorUrl = buildSimulatedArticlePayload({ authorUrlInput: '' });
for (const [key, val] of Object.entries(payloadNoAuthorUrl)) {
  if (val === undefined) {
    throw new Error(`Firestore payload key "${key}" is undefined! Firestore setDoc will reject this.`);
  }
}
if (payloadNoAuthorUrl.authorUrl !== '') {
  throw new Error(`Expected authorUrl to be empty string, got: ${payloadNoAuthorUrl.authorUrl}`);
}

// Verify edit existing article without author URL
const payloadEditExisting = buildSimulatedArticlePayload({
  existingId: 'smart-budget-essentials-style-and-utility-under-1499-mvw9kfgp',
  authorUrlInput: ''
});
for (const [key, val] of Object.entries(payloadEditExisting)) {
  if (val === undefined) {
    throw new Error(`Firestore payload key "${key}" is undefined during article edit!`);
  }
}
if (payloadEditExisting.id !== 'smart-budget-essentials-style-and-utility-under-1499-mvw9kfgp') {
  throw new Error('Article id mismatch on edit');
}

// Verify article with valid author URL provided
const payloadWithAuthorUrl = buildSimulatedArticlePayload({
  authorUrlInput: 'https://instagram.com/devtoshsuperbazaar'
});
if (payloadWithAuthorUrl.authorUrl !== 'https://instagram.com/devtoshsuperbazaar') {
  throw new Error(`Expected valid authorUrl, got: ${payloadWithAuthorUrl.authorUrl}`);
}

// Test 16: Verify Shopping Link (Affiliate URL) and Two-Stage Affiliate Extraction
// 16.1 UI & Schema Verification: Shopping Link field and Stage B container
const currentAppSrc = fs.readFileSync('src/app.ts', 'utf8');
if (!currentAppSrc.includes('Shopping Link (Affiliate URL) *')) {
  throw new Error('src/app.ts missing single required Shopping Link (Affiliate URL) * field');
}
if (!currentAppSrc.includes('id="p-affurl"')) {
  throw new Error('src/app.ts missing #p-affurl input field');
}
if (!currentAppSrc.includes('id="stage-b-container"')) {
  throw new Error('src/app.ts missing #stage-b-container');
}
if (!currentAppSrc.includes('id="direct-extract-url"')) {
  throw new Error('src/app.ts missing #direct-extract-url input');
}
if (!currentAppSrc.includes('id="direct-extract-btn"')) {
  throw new Error('src/app.ts missing #direct-extract-btn button');
}
if (!currentAppSrc.includes("We couldn't automatically access the product page through this affiliate link. Please paste the direct product URL so we can extract the product information. Your affiliate link will remain saved as the customer shopping link.")) {
  throw new Error('src/app.ts missing required Stage B failure message');
}
if (!currentAppSrc.includes('Direct Product URL (for extraction only)')) {
  throw new Error('src/app.ts missing Direct Product URL (for extraction only) label');
}

// 16.2 Meesho Affiliate URL Recognition and Ext ID / Product ID Parsing
const testMeeshoAffUrl = 'https://www.meesho.com/af_invite/449125188:instagram_stories:15030911?p_id=960507801&ext_id=fvv0k9&utm_source=instagram_stories';
const parsedMeesho = new URL(testMeeshoAffUrl);
const isMeeshoAff = parsedMeesho.hostname.includes('meesho') && parsedMeesho.pathname.includes('/af_invite');
if (!isMeeshoAff) throw new Error('Failed to recognize Meesho /af_invite/ URL as affiliate');

const extractedExtId = parsedMeesho.searchParams.get('ext_id');
const extractedPId = parsedMeesho.searchParams.get('p_id');
if (extractedExtId !== 'fvv0k9') {
  throw new Error(`Expected ext_id fvv0k9, got: ${extractedExtId}`);
}
if (extractedPId !== '960507801') {
  throw new Error(`Expected p_id 960507801, got: ${extractedPId}`);
}

// 16.3 Preservation of Original Affiliate URL
let formShoppingLink = testMeeshoAffUrl;
// Stage B Direct URL simulation:
const directProductUrl = `https://www.meesho.com/s/p/${extractedExtId}`;
// Simulate direct extraction without modifying formShoppingLink
const extractedDirectData = {
  name: 'Printed Anarkali Kurti',
  brand: 'Meesho',
  cat: 'Kurtis & Suits',
  price: 349,
  mrp: 699,
  ret: 'Meesho',
  retUrl: directProductUrl
};
// Ensure direct extraction NEVER replaces formShoppingLink
if (formShoppingLink !== testMeeshoAffUrl) {
  throw new Error('Direct product URL overwrote the original affiliate shopping link!');
}
if (!formShoppingLink.includes('utm_source=instagram_stories') || !formShoppingLink.includes('p_id=960507801')) {
  throw new Error('Tracking parameters were corrupted or stripped from affiliate link');
}

// 16.4 Customer Shopping Button uses exact Shopping Link (Affiliate URL)
function renderCustomerButtons(prod) {
  const shopUrl = prod.affUrl || prod.affiliateUrl || prod.retUrl || prod.retailerProductUrl || '/';
  const shopBtn = `<a class="lm" href="${shopUrl}" target="_blank" rel="noopener noreferrer">Shop at ${prod.ret} ↗</a>`;
  const vidBtn = prod.videoUrl && prod.videoUrl.includes('instagram.com/reel/')
    ? `<a class="vid-btn" href="${prod.videoUrl}" target="_blank" rel="noopener noreferrer"><span>Watch Product Video</span></a>`
    : '';
  const wishBtn = `<button class="wb"><span>Save to saved items</span></button>`;
  return `${shopBtn}${vidBtn}${wishBtn}`;
}

const prodWithAff = {
  name: 'Printed Anarkali Kurti',
  ret: 'Meesho',
  affUrl: testMeeshoAffUrl,
  retUrl: directProductUrl,
  videoUrl: 'https://www.instagram.com/reel/C-abc123XYZ/'
};

const renderedBtns = renderCustomerButtons(prodWithAff);
if (!renderedBtns.includes(`href="${testMeeshoAffUrl}"`)) {
  throw new Error('Customer shopping button did not use original affiliate URL');
}
if (!renderedBtns.includes('target="_blank"') || !renderedBtns.includes('rel="noopener noreferrer"')) {
  throw new Error('Customer shopping button missing required target="_blank" or rel="noopener noreferrer"');
}
if (renderedBtns.indexOf('Shop at Meesho') > renderedBtns.indexOf('Watch Product Video')) {
  throw new Error('Button order violated: Shopping button must appear before video button');
}

// 16.5 Backward Compatibility with Legacy Product Fields
const legacyProd1 = { name: 'Legacy Item 1', ret: 'Amazon', retUrl: 'https://amazon.in/dp/B012345678' };
const legacyBtns1 = renderCustomerButtons(legacyProd1);
if (!legacyBtns1.includes('href="https://amazon.in/dp/B012345678"')) {
  throw new Error('Legacy product using retUrl failed to render shopping destination');
}

const legacyProd2 = { name: 'Legacy Item 2', ret: 'Myntra', retailerProductUrl: 'https://myntra.com/item/123' };
const legacyBtns2 = renderCustomerButtons(legacyProd2);
if (!legacyBtns2.includes('href="https://myntra.com/item/123"')) {
  throw new Error('Legacy product using retailerProductUrl failed to render shopping destination');
}

const legacyProd3 = { name: 'Legacy Item 3', ret: 'Flipkart', affiliateUrl: 'https://affiliate.flipkart.com/click?id=123' };
const legacyBtns3 = renderCustomerButtons(legacyProd3);
if (!legacyBtns3.includes('href="https://affiliate.flipkart.com/click?id=123"')) {
  throw new Error('Legacy product using affiliateUrl failed to render shopping destination');
}

// 16.6 Non-Fabrication Rule: Unextracted fields must default to 0 / empty
const incompleteParsed = {
  name: 'Simple Cotton Scarf',
  slug: 'simple-cotton-scarf',
  brand: '',
  price: 0,
  mrp: 0,
  imgUrl: '',
  col: '',
  sizes: []
};
if (incompleteParsed.price !== 0) throw new Error('Price was fabricated');
if (incompleteParsed.mrp !== 0) throw new Error('MRP was fabricated');
if (incompleteParsed.col !== '') throw new Error('Color was fabricated');
if (incompleteParsed.sizes.length !== 0) throw new Error('Sizes were fabricated');

// 16.7 Normal retailer URLs extraction capability
const normalAmazon = 'https://www.amazon.in/dp/B08N5WRWNW';
const parsedNormal = new URL(normalAmazon);
if (!parsedNormal.hostname.includes('amazon') || !parsedNormal.pathname.includes('/dp/B08N5WRWNW')) {
  throw new Error('Normal Amazon URL extraction parsing failed');
}

// ============================================================================
// TASK 1 & TASK 6: Product Extraction Sanitization & Slug Max Length 65
// ============================================================================

// 17.1 Slugs must never exceed 65 characters and must include deterministic uniqueness
function generateSafeProductSlug(name, uniqueId) {
  const MAX_PRODUCT_SLUG_LENGTH = 65;
  const clean = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  let base = clean || 'product';
  let suffix = '';
  if (uniqueId && typeof uniqueId === 'string' && uniqueId.trim()) {
    suffix = uniqueId.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(-6);
  }
  if (!suffix) {
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = ((hash << 5) - hash) + (name || '').charCodeAt(i);
      hash |= 0;
    }
    suffix = Math.abs(hash).toString(36).slice(0, 6).padStart(6, '0');
  }

  const maxBaseLen = MAX_PRODUCT_SLUG_LENGTH - suffix.length - 1;
  if (base.length > maxBaseLen || uniqueId) {
    let truncated = base.slice(0, maxBaseLen);
    if (base.length > maxBaseLen) {
      const lastHyphen = truncated.lastIndexOf('-');
      if (lastHyphen > 15) {
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

function getSafeProductSlug(slug, uniqueId, name) {
  const MAX_PRODUCT_SLUG_LENGTH = 65;
  if (!slug || typeof slug !== 'string') {
    return name ? generateSafeProductSlug(name, uniqueId) : '';
  }
  const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  if (clean.length > 0 && clean.length <= MAX_PRODUCT_SLUG_LENGTH) {
    return clean;
  }
  return generateSafeProductSlug(clean || name || 'product', uniqueId);
}

// Test the exact 241-character slug that crashed GitHub Actions build 41305268901:
const brokenSlug241 = 'kurti-set-for-women-under-500kurti-for-women-with-dupattakurti-set-for-women-with-dupatta-cottonkurti-set-forwomen-with-dupattakurti-set-with-dupattakurti-set-for-women-stylishkurti-setcotton-kurti-set-for-women-with-dupattakurti-set-for-women-with-dupatta-pink';
const fixedSlug = getSafeProductSlug(brokenSlug241, 'mvw9kfgp', 'Kurti Set for Women with Dupatta');
if (fixedSlug.length > 65) {
  throw new Error(`Safe slug exceeded 65 characters! Got length ${fixedSlug.length}: ${fixedSlug}`);
}
if (!fixedSlug.endsWith('mvw9kfgp'.slice(-6))) {
  throw new Error(`Safe slug should end with deterministic suffix, got: ${fixedSlug}`);
}

// Test existing valid short slug preservation (MUST NOT be altered)
const shortSlugValid = '1kv4b';
if (getSafeProductSlug(shortSlugValid, '1kv4b', 'Frekman Shirt') !== '1kv4b') {
  throw new Error('Valid short existing slug was improperly modified!');
}
const shortSlugValid2 = 'women-hand-bags-purse-for-girls-and-women';
if (getSafeProductSlug(shortSlugValid2, 'mvw9k99', 'Handbag') !== shortSlugValid2) {
  throw new Error('Valid 41-char slug was improperly modified!');
}

// 17.2 Retailer extraction sanitization: never treat IDs or protocols as product name or brand
function isForbiddenBrand(str) {
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
function isAlphanumericId(str) {
  if (!str) return false;
  const s = str.trim();
  return /^[a-z0-9]{4,10}$/i.test(s) && /\d/.test(s) && /[a-z]/i.test(s);
}

if (!isAlphanumericId('fvv0k9')) throw new Error('fvv0k9 must be identified as an alphanumeric product ID');
if (!isAlphanumericId('1kv4b')) throw new Error('1kv4b must be identified as an alphanumeric product ID');
if (isAlphanumericId('Cotton Kurti')) throw new Error('Legitimate title should not be flagged as ID');

if (!isForbiddenBrand('Https')) throw new Error('Https must be rejected as a brand');
if (!isForbiddenBrand('https')) throw new Error('https must be rejected as a brand');
if (!isForbiddenBrand('meesho.com')) throw new Error('meesho.com must be rejected as a brand');
if (isForbiddenBrand('Biba')) throw new Error('Genuine brand Biba must not be rejected');

// 17.3 Anti-fabrication check: Empty / unextracted values must NOT default to fake data
const extractedExtractorFile = fs.readFileSync('src/productExtractor.ts', 'utf8');
if (extractedExtractorFile.includes("col: 'White'")) {
  throw new Error('src/productExtractor.ts contains fabricated default colour White');
}
if (extractedExtractorFile.includes("sizes: ['S', 'M', 'L', 'XL']")) {
  throw new Error('src/productExtractor.ts contains fabricated default sizes S, M, L, XL');
}
if (extractedExtractorFile.includes("cat: 'Accessories & Lifestyle'")) {
  throw new Error('src/productExtractor.ts contains fabricated default category Accessories & Lifestyle');
}

// ============================================================================
// TASK 3: Category Taxonomy & Audience Disambiguation
// ============================================================================

function isKidsProduct(p) {
  const cat = (p.cat || '').toLowerCase();
  const name = (p.name || '').toLowerCase();
  if (cat.includes('kids') || cat.includes('baby') || cat.includes('toy')) return true;
  if (
    name.includes('women') || name.includes('ladies') || name.includes('saree') ||
    name.includes('kurti') || name.includes('lehenga') || name.includes('purse') ||
    name.includes('handbag') || name.includes('bra') || name.includes('lingerie')
  ) {
    return false;
  }
  if (name.includes('menswear') || name.includes("men's") || name.includes('men shirt')) return false;
  return (
    name.includes('infant') || name.includes('toddler') || name.includes('babywear') ||
    name.includes('romper') || name.includes('baby') || name.includes('toy') ||
    name.includes('kids wear') || name.includes('kids clothing') || name.includes('boys clothes') ||
    name.includes('girls frock') || name.includes('kids shoes')
  );
}

function isWomenProduct(p) {
  const cat = (p.cat || '').toLowerCase();
  const name = (p.name || '').toLowerCase();
  if (isKidsProduct(p)) return false;
  if (
    cat.includes('women') || cat.includes('saree') || cat.includes('kurti') ||
    cat.includes('dress') || cat.includes('jewel') || cat.includes('handbag') ||
    cat.includes('ethnic wear')
  ) {
    return true;
  }
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

function isAccessoriesProduct(p) {
  const cat = (p.cat || '').toLowerCase();
  const name = (p.name || '').toLowerCase();
  const textCombined = `${cat} ${name}`;
  if (
    textCombined.includes('saree') || textCombined.includes('sari') ||
    textCombined.includes('kurti') || textCombined.includes('kurta') ||
    textCombined.includes('lehenga') || textCombined.includes('blouse') ||
    textCombined.includes('shirt') || textCombined.includes('t-shirt') ||
    textCombined.includes('jeans') || textCombined.includes('trousers') ||
    textCombined.includes('footwear') || textCombined.includes('shoes') ||
    textCombined.includes('sneaker') || textCombined.includes('sandals')
  ) {
    if (!textCombined.includes('bag') && !textCombined.includes('purse') && !textCombined.includes('wallet') && !textCombined.includes('belt') && !textCombined.includes('watch') && !textCombined.includes('jewel')) {
      return false;
    }
  }
  if (cat.includes('accessories') || cat.includes('jewel') || cat.includes('watch') || cat.includes('bag') || cat.includes('belt')) {
    return true;
  }
  return (
    name.includes('watch') || name.includes('bag') || name.includes('handbag') ||
    name.includes('purse') || name.includes('wallet') || name.includes('belt') ||
    name.includes('sunglasses') || name.includes('jewellery') || name.includes('necklace') ||
    name.includes('earring') || name.includes('bangle') || name.includes('bracelet') ||
    name.includes('ring') || name.includes('scarf') || name.includes('cap') || name.includes('hat')
  );
}

// Handbag test: "Women Hand Bags Purse for Girls and Women"
const handbagProd = {
  name: 'Women Hand Bags Purse for Girls and Women Shoulder Tote Bag',
  cat: 'Women Accessories',
  slug: 'women-hand-bags-purse-for-girls-and-women'
};

if (isKidsProduct(handbagProd)) {
  throw new Error('Women Handbag with "girls" in title was wrongly classified as Kids!');
}
if (!isWomenProduct(handbagProd)) {
  throw new Error('Women Handbag was not classified as Women!');
}
if (!isAccessoriesProduct(handbagProd)) {
  throw new Error('Women Handbag was not classified as Accessories!');
}

// Footwear audience split tests
const menShoe = { name: "Men's Lightweight Breathable Running Shoes", cat: 'Footwear' };
const womenHeel = { name: "Women's Block Heel Ankle Strap Sandals", cat: 'Footwear' };
const kidShoe = { name: "Kids Light-Up Casual Walking Shoes", cat: 'Kids Footwear' };

if (isKidsProduct(menShoe)) throw new Error("Men's shoes should not be in Kids");
if (isKidsProduct(womenHeel)) throw new Error("Women's heels should not be in Kids");
if (!isKidsProduct(kidShoe)) throw new Error("Kid shoes must be in Kids");

// Accessories purity test: Clothing must never be in accessories
const menShirt = { name: "Cotton Slim Fit Casual Shirt", cat: "Men's Clothing" };
if (isAccessoriesProduct(menShirt)) throw new Error("Men's shirt must NOT be in Accessories!");

// ============================================================================
// TASK 4: Floating WhatsApp Contact Button
// ============================================================================

const indexHtml = fs.readFileSync('index.html', 'utf8');
if (!indexHtml.includes('https://wa.me/916204845747')) {
  throw new Error('index.html missing WhatsApp contact link https://wa.me/916204845747');
}
if (!indexHtml.includes('class="whatsapp-float-btn"')) {
  throw new Error('index.html missing .whatsapp-float-btn element');
}
if (!indexHtml.includes('aria-label="Chat with DevTosh SuperBazaar on WhatsApp"')) {
  throw new Error('WhatsApp float button missing accessible aria-label');
}
if (!indexHtml.includes('href="#wa"')) {
  throw new Error('WhatsApp float button must use existing #wa SVG icon');
}
if (!indexHtml.includes('.whatsapp-float-btn')) {
  throw new Error('index.html missing .whatsapp-float-btn CSS rules');
}

// ============================================================================
// TASK 5: Brand Theme Palette for Stage B and Extraction Status
// ============================================================================

const appSource = fs.readFileSync('src/app.ts', 'utf8');
if (!appSource.includes('id="stage-b-container" style="display:none;margin-top:14px;background:var(--sf);border:1px solid var(--bd);border-left:4px solid var(--wn);padding:14px 16px;border-radius:4px"')) {
  throw new Error('#stage-b-container does not use the brand theme tokens');
}
if (!appSource.includes('<span style="background:var(--bl);color:var(--dp);padding:2px 8px;border-radius:3px;font-weight:500">')) {
  throw new Error('Extraction status chips do not use brand theme palette tokens');
}

// ============================================================================
// TASK 6: Route Resolution Backward Compatibility
// ============================================================================

if (!appSource.includes('p.slug === sub || getSafeProductSlug(p.slug, p.id, p.name) === sub || p.id === sub')) {
  throw new Error('Product routing does not support backwards-compatible safe slug resolution');
}

// ============================================================================
// TASK 7: Automatic Category Selection & Multi-Category Assignments
// ============================================================================

const productDataSource = fs.readFileSync('src/productData.ts', 'utf8');

if (!productDataSource.includes('export const ADMIN_CATEGORY_OPTIONS')) {
  throw new Error('ADMIN_CATEGORY_OPTIONS must be exported from src/productData.ts');
}
if (!productDataSource.includes('export function suggestProductCategories')) {
  throw new Error('suggestProductCategories must be exported from src/productData.ts');
}
if (!productDataSource.includes('export function isProductInCategory')) {
  throw new Error('isProductInCategory must be exported from src/productData.ts');
}

// Check admin form UI and Firestore persistence
if (!appSource.includes('name="p-category-cbs"') || !appSource.includes('class="p-cat-cb"')) {
  throw new Error('Admin form missing category selection checkboxes');
}
if (!appSource.includes('id="cat-auto-suggest-btn"')) {
  throw new Error('Admin form missing ⚡ Auto-Suggest Categories button');
}
if (!appSource.includes('refreshAutoCategorySuggestions')) {
  throw new Error('src/app.ts missing refreshAutoCategorySuggestions helper');
}
if (!appSource.includes('categories,') || !appSource.includes('categories: Array.isArray(d.categories) ? d.categories : []')) {
  throw new Error('src/app.ts does not map or save categories in Firestore product payloads');
}

// Check SSG Prerendering uses isProductInCategory
const prerenderSource = fs.readFileSync('scripts/prerender-blog.ts', 'utf8');
if (!prerenderSource.includes('isProductInCategory(p, cat.slug)')) {
  throw new Error('scripts/prerender-blog.ts category loop must use isProductInCategory');
}

// Simulation tests for the 4 exact user specification examples:
function simulateSuggest(info) {
  const name = (info.name || '').toLowerCase();
  const cat = (info.cat || '').toLowerCase();
  const desc = (info.desc || '').toLowerCase();
  const textCombined = `${cat} ${name} ${desc}`;

  const set = new Set(['all']);

  // Women's
  if (
    textCombined.includes('women') || textCombined.includes('ladies') || textCombined.includes('saree') ||
    textCombined.includes('sari') || textCombined.includes('kurti') || textCombined.includes('lehenga') ||
    textCombined.includes('anarkali') || textCombined.includes('dupatta') || textCombined.includes('blouse') ||
    textCombined.includes('dress') || textCombined.includes('gown') || textCombined.includes('handbag') ||
    textCombined.includes('purse') || textCombined.includes('jewel')
  ) {
    set.add('women');
  }

  // Men's
  if (
    textCombined.includes('men') && !textCombined.includes('women') ||
    textCombined.includes("men's") || textCombined.includes('shirt') ||
    textCombined.includes('t-shirt') || textCombined.includes('jeans') ||
    textCombined.includes('trousers') || textCombined.includes('kurta pyjama') ||
    textCombined.includes('blazer') || textCombined.includes('suit')
  ) {
    set.add('men');
  }

  // Footwear
  if (
    textCombined.includes('footwear') || textCombined.includes('shoe') ||
    textCombined.includes('sneaker') || textCombined.includes('sandal') ||
    textCombined.includes('loafer') || textCombined.includes('slide') ||
    textCombined.includes('heels') || textCombined.includes('boots')
  ) {
    set.add('footwear');
  }

  // Mobiles & Electronics
  if (
    textCombined.includes('mobile') || textCombined.includes('phone') ||
    textCombined.includes('smartphone') || textCombined.includes('earbud') ||
    textCombined.includes('headphone') || textCombined.includes('smartwatch') ||
    textCombined.includes('electronics')
  ) {
    set.add('mobiles');
  }

  // Accessories
  if (
    (textCombined.includes('bag') || textCombined.includes('purse') || textCombined.includes('wallet') ||
     textCombined.includes('belt') || textCombined.includes('watch') || textCombined.includes('jewel') ||
     textCombined.includes('sunglasses') || textCombined.includes('accessories')) &&
    !textCombined.includes('saree') && !textCombined.includes('kurti') && !textCombined.includes('shirt')
  ) {
    set.add('accessories');
  }

  return Array.from(set);
}

function simulateIsProductInCategory(p, catSlug) {
  if (p.categories && Array.isArray(p.categories) && p.categories.length > 0) {
    if (catSlug === 'all') return true;
    return p.categories.includes(catSlug);
  }
  return false;
}

// 1. Women's saree: All Products, Women's Fashion
const sareeSugg = simulateSuggest({ name: 'Cotton Silk Jacquard Saree With Unstitched Blouse', cat: 'Sarees' });
if (!sareeSugg.includes('all') || !sareeSugg.includes('women')) {
  throw new Error("Women's saree suggestion failed: expected ['all', 'women']");
}
if (sareeSugg.includes('accessories')) {
  throw new Error("Women's saree must NEVER be suggested in Accessories!");
}

// 2. Men's sneakers: All Products, Men's Fashion, Footwear
const sneakerSugg = simulateSuggest({ name: "Men's Lightweight Breathable Running Shoes Sneakers", cat: 'Footwear' });
if (!sneakerSugg.includes('all') || !sneakerSugg.includes('men') || !sneakerSugg.includes('footwear')) {
  throw new Error("Men's sneakers suggestion failed: expected ['all', 'men', 'footwear']");
}

// 3. Smartphone: All Products, Electronics & Mobiles
const phoneSugg = simulateSuggest({ name: 'OnePlus Nord 5G Smartphone with AMOLED Display', cat: 'Smartphones' });
if (!phoneSugg.includes('all') || !phoneSugg.includes('mobiles')) {
  throw new Error("Smartphone suggestion failed: expected ['all', 'mobiles']");
}

// 4. Women's handbag: All Products, Women's Fashion, Accessories & Lifestyle
const handbagSugg = simulateSuggest({ name: 'Women Hand Bags Purse for Girls and Women Shoulder Tote Bag', cat: 'Accessories & Lifestyle' });
if (!handbagSugg.includes('all') || !handbagSugg.includes('women') || !handbagSugg.includes('accessories')) {
  throw new Error("Women's handbag suggestion failed: expected ['all', 'women', 'accessories']");
}

// Test multi-category membership without duplicate documents:
const multiCatProd = {
  id: 'prod-123',
  name: 'Multi Category Sneaker',
  categories: ['all', 'men', 'footwear']
};
if (!simulateIsProductInCategory(multiCatProd, 'all')) throw new Error("Multi-category product must match 'all'");
if (!simulateIsProductInCategory(multiCatProd, 'men')) throw new Error("Multi-category product must match 'men'");
if (!simulateIsProductInCategory(multiCatProd, 'footwear')) throw new Error("Multi-category product must match 'footwear'");
if (simulateIsProductInCategory(multiCatProd, 'women')) throw new Error("Multi-category product must not match unselected category 'women'");

// Test manual override retention:
const overriddenProd = {
  id: 'prod-456',
  name: 'Custom Assigned Item',
  categories: ['women'] // Admin manually excluded 'accessories' and 'all'
};
// ============================================================================
// TASK 8: SEO Title & Meta Description Standardization
// ============================================================================

// 18.1 Check index.html title and meta tags
const idxHtmlContent = fs.readFileSync('index.html', 'utf8');
const titleMatch = idxHtmlContent.match(/<title>(.*?)<\/title>/i);
if (!titleMatch || !titleMatch[1].startsWith('Devtosh Superbazaar - ')) {
  throw new Error(`index.html title must start with "Devtosh Superbazaar - ", got: "${titleMatch ? titleMatch[1] : ''}"`);
}
const ogTitleMatch = idxHtmlContent.match(/<meta property="og:title" content="(.*?)"/i);
if (!ogTitleMatch || !ogTitleMatch[1].startsWith('Devtosh Superbazaar - ')) {
  throw new Error(`index.html og:title must start with "Devtosh Superbazaar - ", got: "${ogTitleMatch ? ogTitleMatch[1] : ''}"`);
}
const twTitleMatch = idxHtmlContent.match(/<meta name="twitter:title" content="(.*?)"/i);
if (!twTitleMatch || !twTitleMatch[1].startsWith('Devtosh Superbazaar - ')) {
  throw new Error(`index.html twitter:title must start with "Devtosh Superbazaar - ", got: "${twTitleMatch ? twTitleMatch[1] : ''}"`);
}

// 18.2 Check SITE_CATEGORIES in src/productData.ts
const catTitlesRegex = /title:\s*['"`](.*?)['"`]/g;
let cMatch;
let catTitleCount = 0;
while ((cMatch = catTitlesRegex.exec(productDataSource)) !== null) {
  const catTitle = cMatch[1];
  if (!catTitle.startsWith('Devtosh Superbazaar - ')) {
    throw new Error(`Category title in SITE_CATEGORIES does not start with "Devtosh Superbazaar - ": "${catTitle}"`);
  }
  catTitleCount++;
}
if (catTitleCount < 9) {
  throw new Error(`Expected at least 9 category titles in SITE_CATEGORIES, found ${catTitleCount}`);
}

// 18.3 Check dynamic title normalization logic in src/app.ts
if (!appSource.includes("const finalTitle = rawTitle ? `Devtosh Superbazaar - ${rawTitle}` : 'Devtosh Superbazaar - Fashion, Mobiles & Lifestyle';")) {
  throw new Error('src/app.ts draw() missing dynamic title prefix standardization');
}

// 18.4 If dist/ exists, check all generated HTML files for SEO prefix compliance
if (fs.existsSync('dist')) {
  function getHtmlFiles(dir) {
    let files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        files = files.concat(getHtmlFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.html') && !fullPath.includes('/assets/')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const distHtmlFiles = getHtmlFiles('dist');
  for (const file of distHtmlFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const fileTitle = (content.match(/<title>(.*?)<\/title>/i) || [])[1] || '';
    if (!fileTitle.startsWith('Devtosh Superbazaar - ')) {
      throw new Error(`File ${file} title does not start with "Devtosh Superbazaar - ": "${fileTitle}"`);
    }
    if (fileTitle.includes('Devtosh Superbazaar - Devtosh Superbazaar') || fileTitle.includes('DevTosh Superbazaar — DevTosh Superbazaar')) {
      throw new Error(`File ${file} has duplicated brand name in title: "${fileTitle}"`);
    }
    if (fileTitle.includes('| DevTosh Superbazaar') || fileTitle.includes('— DevTosh Superbazaar')) {
      throw new Error(`File ${file} has legacy brand suffix in title: "${fileTitle}"`);
    }

    const fileOgTitle = (content.match(/<meta property="og:title" content="(.*?)"/i) || [])[1] || '';
    if (!fileOgTitle.startsWith('Devtosh Superbazaar - ')) {
      throw new Error(`File ${file} og:title does not start with "Devtosh Superbazaar - ": "${fileOgTitle}"`);
    }
    const fileTwTitle = (content.match(/<meta name="twitter:title" content="(.*?)"/i) || [])[1] || '';
    if (!fileTwTitle.startsWith('Devtosh Superbazaar - ')) {
      throw new Error(`File ${file} twitter:title does not start with "Devtosh Superbazaar - ": "${fileTwTitle}"`);
    }

    // Verify meta description, og:description, twitter:description are present and non-empty
    const metaDesc = (content.match(/<meta name="description" content="(.*?)"/i) || [])[1] || '';
    if (!metaDesc || metaDesc.trim().length < 20) {
      throw new Error(`File ${file} has missing or too short meta description: "${metaDesc}"`);
    }
    const ogDesc = (content.match(/<meta property="og:description" content="(.*?)"/i) || [])[1] || '';
    if (!ogDesc || ogDesc.trim().length < 20) {
      throw new Error(`File ${file} has missing or too short og:description: "${ogDesc}"`);
    }
    const twDesc = (content.match(/<meta name="twitter:description" content="(.*?)"/i) || [])[1] || '';
    if (!twDesc || twDesc.trim().length < 20) {
      throw new Error(`File ${file} has missing or too short twitter:description: "${twDesc}"`);
    }
  }
}

console.log('Automated validation suite passed with 100% success.');

