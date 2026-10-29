/**
 * DevTosh SuperBazaar — Comprehensive Sitemap Audit & URL Verification Suite
 * Verifies sitemap.xml against static dist/ artifacts, canonical tags, and routing standards.
 */

import fs from 'fs';
import path from 'path';

const DIST_DIR = 'dist';
const SITEMAP_PATH = path.join(DIST_DIR, 'sitemap.xml');
const BASE_ORIGIN = 'https://devtoshsuperbazaar.github.io';

console.log('='.repeat(70));
console.log('DevTosh SuperBazaar — Sitemap Audit & URL Integrity Verification');
console.log('='.repeat(70));

if (!fs.existsSync(SITEMAP_PATH)) {
  console.error(`FAIL: Sitemap file not found at ${SITEMAP_PATH}. Run 'npm run build' first.`);
  process.exit(1);
}

const sitemapContent = fs.readFileSync(SITEMAP_PATH, 'utf8');

// 1. XML Root & Schema Validation
if (!sitemapContent.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
  console.error('FAIL: Missing XML declaration');
  process.exit(1);
}
if (!sitemapContent.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')) {
  console.error('FAIL: Missing or invalid <urlset> declaration');
  process.exit(1);
}

// 2. Extract and Validate All URLs
const locRegex = /<loc>(.*?)<\/loc>/g;
const urls = [];
let match;
while ((match = locRegex.exec(sitemapContent)) !== null) {
  urls.push(match[1]);
}

console.log(`\n[✓] Total URLs indexed in sitemap.xml: ${urls.length}`);

// 3. Duplicate URL Check
const urlSet = new Set();
const duplicates = [];
for (const u of urls) {
  if (urlSet.has(u)) {
    duplicates.push(u);
  }
  urlSet.add(u);
}
if (duplicates.length > 0) {
  console.error(`FAIL: Duplicate URLs detected in sitemap:\n  ${duplicates.join('\n  ')}`);
  process.exit(1);
}
console.log('[✓] Zero duplicate URLs detected (100% unique slugs)');

// 4. Domain & Trailing Slash Consistency
for (const u of urls) {
  if (!u.startsWith(BASE_ORIGIN)) {
    console.error(`FAIL: URL does not start with origin ${BASE_ORIGIN}: ${u}`);
    process.exit(1);
  }
  if (!u.endsWith('/')) {
    console.error(`FAIL: URL missing required trailing slash: ${u}`);
    process.exit(1);
  }
}
console.log('[✓] All URLs strictly follow origin and trailing slash format');

// 5. Exclusions Check (noindex / private routes)
const forbiddenSubstrings = ['/wishlist/', '/404', '/admin', '/go/', 'undefined'];
for (const u of urls) {
  for (const forbidden of forbiddenSubstrings) {
    if (u.includes(forbidden)) {
      console.error(`FAIL: Forbidden or private path present in sitemap: ${u}`);
      process.exit(1);
    }
  }
}
console.log('[✓] Private/noindex routes (wishlist, admin, 404) properly excluded');

// 6. 1-to-1 Mapping to On-Disk Static HTML files
let missingFiles = 0;
let canonicalMismatches = 0;

const sectionCounts = {
  home: 0,
  categories: 0,
  products: 0,
  blogIndex: 0,
  blogArticles: 0,
  infoPages: 0
};

for (const u of urls) {
  const relativePath = u.replace(BASE_ORIGIN, '').replace(/^\//, '').replace(/\/$/, '');
  const expectedDiskPath = relativePath === ''
    ? path.join(DIST_DIR, 'index.html')
    : path.join(DIST_DIR, relativePath, 'index.html');

  if (!fs.existsSync(expectedDiskPath)) {
    console.error(`FAIL: Sitemap URL ${u} has no matching file on disk: ${expectedDiskPath}`);
    missingFiles++;
  } else {
    // Verify canonical tag inside the HTML file
    const html = fs.readFileSync(expectedDiskPath, 'utf8');
    const hasCanonical = html.includes(`<link rel="canonical" href="${u}">`) ||
                         html.includes(`<link rel="canonical" href="${u}" />`);
    if (!hasCanonical) {
      console.warn(`WARN: Canonical tag in ${expectedDiskPath} does not match sitemap <loc> precisely`);
      canonicalMismatches++;
    }
  }

  // Tally sections
  if (relativePath === '') sectionCounts.home++;
  else if (relativePath.startsWith('category/')) sectionCounts.categories++;
  else if (relativePath.startsWith('product/')) sectionCounts.products++;
  else if (relativePath === 'blog') sectionCounts.blogIndex++;
  else if (relativePath.startsWith('blog/')) sectionCounts.blogArticles++;
  else sectionCounts.infoPages++;
}

if (missingFiles > 0) {
  console.error(`FAIL: ${missingFiles} sitemap URLs lack on-disk prerendered HTML!`);
  process.exit(1);
}
console.log('[✓] 1-to-1 On-Disk Match: Every single sitemap URL corresponds to a real static HTML file');

if (canonicalMismatches === 0) {
  console.log('[✓] Canonical tags inside all HTML documents match sitemap URLs precisely');
}

// 7. Breakdown Audit Table
console.log('\n--- Sitemap URL Inventory by Section ---');
console.table([
  { Section: 'Homepage', Count: sectionCounts.home, Pattern: '/' },
  { Section: 'Category Collections', Count: sectionCounts.categories, Pattern: '/category/<slug>/' },
  { Section: 'Product Detail Pages', Count: sectionCounts.products, Pattern: '/product/<slug>/' },
  { Section: 'Blog Index', Count: sectionCounts.blogIndex, Pattern: '/blog/' },
  { Section: 'Blog Editorial Guides', Count: sectionCounts.blogArticles, Pattern: '/blog/<slug>/' },
  { Section: 'Informational & Policies', Count: sectionCounts.infoPages, Pattern: '/<slug>/ (about, contact, etc.)' }
]);

console.log(`\nTOTAL INDEXED STOREFRONT PAGES: ${urls.length}`);
console.log('SITEMAP AUDIT COMPLETED SUCCESSFULLY: PASS\n');
