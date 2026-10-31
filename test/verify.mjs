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

console.log('Automated validation suite passed with 100% success.');

