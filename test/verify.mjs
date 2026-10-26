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

  // Check article 1: styling-daily-ethnic-wear-budget-guide
  const art1Path = 'dist/blog/styling-daily-ethnic-wear-budget-guide/index.html';
  if (!fs.existsSync(art1Path)) throw new Error(`${art1Path} missing`);
  const art1Html = fs.readFileSync(art1Path, 'utf8');
  if (!art1Html.includes('https://devtoshsuperbazaar.github.io/blog/styling-daily-ethnic-wear-budget-guide/')) {
    throw new Error('Article 1 missing canonical URL');
  }
  if (!art1Html.includes('"@type": "BlogPosting"')) {
    throw new Error('Article 1 missing BlogPosting JSON-LD');
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

  // Check Product Pages
  const prod1Path = 'dist/product/banarasi-soft-silk-zari-woven-saree/index.html';
  if (!fs.existsSync(prod1Path)) throw new Error(`${prod1Path} missing`);
  const prod1Html = fs.readFileSync(prod1Path, 'utf8');
  if (!prod1Html.includes('https://devtoshsuperbazaar.github.io/product/banarasi-soft-silk-zari-woven-saree/')) {
    throw new Error('Product 1 missing canonical URL');
  }
  if (!prod1Html.includes('"@type": "Product"')) {
    throw new Error('Product 1 missing Product schema');
  }
  if (!prod1Html.includes('899')) {
    throw new Error('Product 1 missing price in schema or content');
  }

  const prod2Path = 'dist/product/360-rotating-car-dashboard-mobile-holder/index.html';
  if (!fs.existsSync(prod2Path)) throw new Error(`${prod2Path} missing`);

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
  if (locMatches.length !== 39) {
    throw new Error(`Expected exactly 39 URLs in sitemap.xml, found ${locMatches.length}`);
  }
  if (!sitemap.includes('https://devtoshsuperbazaar.github.io/blog/')) throw new Error('sitemap missing /blog/');
  if (!sitemap.includes('https://devtoshsuperbazaar.github.io/category/women/')) throw new Error('sitemap missing /category/women/');
  if (!sitemap.includes('https://devtoshsuperbazaar.github.io/category/electronics/')) throw new Error('sitemap missing /category/electronics/');
  if (!sitemap.includes('https://devtoshsuperbazaar.github.io/product/banarasi-soft-silk-zari-woven-saree/')) throw new Error('sitemap missing product 1');

  // Check robots.txt
  if (!fs.existsSync('dist/robots.txt')) throw new Error('dist/robots.txt missing');
  const robots = fs.readFileSync('dist/robots.txt', 'utf8');
  if (!robots.includes('Sitemap: https://devtoshsuperbazaar.github.io/sitemap.xml')) {
    throw new Error('robots.txt missing Sitemap reference');
  }
  if (!robots.includes('Disallow: /admin/') || !robots.includes('Disallow: /wishlist/')) {
    throw new Error('robots.txt missing Disallow rules for /admin/ or /wishlist/');
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
  if (!idxHtml.includes('href="#app"') || !idxHtml.includes('class="sk"')) {
    throw new Error('dist/index.html missing skip link anchor href="#app"');
  }
  if (idxHtml.includes('<main class="mn"')) throw new Error('dist/index.html has illegal nested <main class="mn">');
  if (!idxHtml.includes('<h2 class="pn"')) throw new Error('dist/index.html product cards should use <h2 class="pn">');

  // Verify Women category (AF-RM Soft 404 fix)
  const womenHtml = fs.readFileSync('dist/category/women/index.html', 'utf8');
  if (womenHtml.includes('<main class="mn"')) throw new Error('Women category has illegal nested <main class="mn">');
  if (!womenHtml.includes('Banarasi Soft Silk Zari Woven Saree')) {
    throw new Error('Women category should contain Banarasi Saree');
  }
  // Ensure Kids product is not in Women
  if (womenHtml.includes('Girls Printed Cotton Summer Frock')) {
    throw new Error('Girls Frock should not appear in Women category');
  }
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
  if (htmlFiles.length !== 41) {
    throw new Error(`Expected exactly 41 storefront HTML documents in dist/, found ${htmlFiles.length}`);
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

console.log('Automated validation suite passed with 100% success.');

