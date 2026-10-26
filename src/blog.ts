import { Article, ArticleRelatedProduct, SEED_ARTICLES, calculateReadTime, formatBlogDate } from './blogData.js';

function esc(str: string = ''): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inr(n: number): string {
  return '₹' + Number(n).toLocaleString('en-IN');
}

export function parseMarkdownToHtml(md: string): string {
  if (!md) return '';
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

export function generateArticleSlug(title: string): string {
  return (title || 'article')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'new-article';
}

export function validateArticle(
  art: Partial<Article>,
  allArticles: Article[],
  currentId?: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const title = (art.title || '').trim();
  if (!title) {
    errors.push('Article title is required.');
  } else if (title.length < 5) {
    errors.push('Article title should be at least 5 characters.');
  }

  const slug = (art.slug || '').trim().toLowerCase();
  if (!slug) {
    errors.push('URL slug is required.');
  } else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    errors.push('URL slug must contain only lowercase letters, numbers, and single hyphens (no spaces or special characters).');
  } else {
    const isDup = allArticles.some(a => a.slug.toLowerCase() === slug && a.id !== currentId);
    if (isDup) {
      errors.push(`The slug "${slug}" is already used by another article. Please provide a unique slug.`);
    }
  }

  const content = (art.content || '').trim();
  if (!content) {
    errors.push('Article content is required.');
  } else if (content.length < 100) {
    errors.push('Article content is too short (minimum 100 characters).');
  }

  const coverImage = (art.coverImage || '').trim();
  const coverImageAlt = (art.coverImageAlt || '').trim();
  if (coverImage) {
    if (!/^https?:\/\//i.test(coverImage)) {
      errors.push('Cover image URL must be a valid absolute URL starting with http:// or https://');
    }
    if (!coverImageAlt) {
      errors.push('Please provide descriptive alt text for the cover image (essential for Google Images and accessibility).');
    }
  }

  const authorName = (art.authorName || '').trim();
  if (!authorName) {
    errors.push('Author name is required.');
  }

  const authorUrl = (art.authorUrl || '').trim();
  if (authorUrl && !/^https?:\/\//i.test(authorUrl)) {
    errors.push('Author profile URL must be a valid absolute URL starting with http:// or https://');
  }

  const canonicalUrl = (art.canonicalUrl || '').trim();
  if (canonicalUrl && !/^https?:\/\//i.test(canonicalUrl)) {
    errors.push('Canonical URL override must be a valid absolute URL starting with http:// or https://');
  }

  if (art.published && !art.metaDesc && !art.excerpt) {
    errors.push('Published articles must have a meta description or excerpt for Google search snippets.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// --------------------------------------------------------------------------
// Public Views
// --------------------------------------------------------------------------

export function renderBlogIndex(
  selectedCategory: string = '',
  q: string = '',
  articles: Article[] = SEED_ARTICLES
) {
  // Public readers see published articles only
  let items = articles.filter(a => a.published && !a.noindex);

  if (selectedCategory && selectedCategory !== 'all') {
    items = items.filter(a => a.category.toLowerCase() === selectedCategory.toLowerCase());
  }

  if (q) {
    const query = q.toLowerCase();
    items = items.filter(a =>
      a.title.toLowerCase().includes(query) ||
      a.excerpt.toLowerCase().includes(query) ||
      a.category.toLowerCase().includes(query) ||
      a.tags.some(t => t.toLowerCase().includes(query))
    );
  }

  // Sort newest first
  items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const allCategories = Array.from(new Set(articles.filter(a => a.published).map(a => a.category))).sort();
  const featured = items[0];
  const listItems = featured ? items.slice(1) : [];

  return {
    title: selectedCategory ? `${selectedCategory} Guides` : 'Editorial Blog & Style Guides',
    navKey: 'blog',
    html: `
      <section class="w pgs wide">
        <nav class="bc" aria-label="Breadcrumb">
          <a href="#/home">Home</a> / <span aria-current="page">Editorial Blog</span>
        </nav>

        <div class="tt">
          <h1 class="f" tabindex="-1">Editorial Blog &amp; Guides</h1>
          <span class="mu">${items.length} published guides</span>
        </div>
        <p class="lead">Curated styling inspiration, practical marketplace shopping advice, and daily wardrobe essentials by Devtosh SuperBazaar.</p>

        <!-- Topic Pills Bar -->
        <div style="display:flex;gap:8px;overflow-x:auto;padding:16px 0 20px;border-bottom:1px solid var(--bd);margin-bottom:32px;scrollbar-width:none">
          <a href="#/blog" class="dept-pill ${!selectedCategory || selectedCategory === 'all' ? 'active' : ''}">All Topics</a>
          ${allCategories.map(c => `
            <a href="#/blog?cat=${encodeURIComponent(c)}" class="dept-pill ${selectedCategory.toLowerCase() === c.toLowerCase() ? 'active' : ''}">${esc(c)}</a>
          `).join('')}
        </div>

        ${featured ? `
          <!-- Featured Hero Article -->
          <article class="art-container" style="margin-top:0;margin-bottom:36px;padding:clamp(16px,3vw,32px)">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:28px;align-items:center">
              ${featured.coverImage ? `
                <a href="#/blog/${featured.slug}" style="display:block;border-radius:4px;overflow:hidden;border:1px solid var(--bd);aspect-ratio:16/10">
                  <img src="${esc(featured.coverImage)}" alt="${esc(featured.coverImageAlt || featured.title)}" style="width:100%;height:100%;object-fit:cover;transition:transform .4s ease" loading="eager" />
                </a>
              ` : ''}
              <div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                  <span class="tag">${esc(featured.category)}</span>
                  <span class="mu" style="font-size:12px">${featured.readTimeMinutes || 5} min read</span>
                </div>
                <h2 class="f" style="font-size:clamp(22px,2.5vw,30px);margin:4px 0 10px;line-height:1.2">
                  <a href="#/blog/${featured.slug}" style="color:inherit;text-decoration:none">${esc(featured.title)}</a>
                </h2>
                <p class="mu" style="font-size:14.5px;line-height:1.55;margin:0 0 16px">${esc(featured.excerpt)}</p>
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
                  <span class="mu" style="font-size:12.5px">By <b>${esc(featured.authorName)}</b> · ${formatBlogDate(featured.publishedAt)}</span>
                  <a href="#/blog/${featured.slug}" class="lm" style="text-decoration:none;padding:0 20px;height:38px;font-size:12.5px">Read Guide →</a>
                </div>
              </div>
            </div>
          </article>
        ` : ''}

        ${listItems.length ? `
          <div class="g" style="margin-top:0">
            ${listItems.map(art => `
              <article class="pc" style="background:var(--sf);border:1px solid var(--bd);border-radius:4px;overflow:hidden">
                ${art.coverImage ? `
                  <a href="#/blog/${art.slug}" class="ph" style="aspect-ratio:16/9;border:0;border-bottom:1px solid var(--bd)">
                    <img src="${esc(art.coverImage)}" alt="${esc(art.coverImageAlt || art.title)}" style="width:100%;height:100%;object-fit:cover" loading="lazy" />
                  </a>
                ` : ''}
                <div class="pi" style="padding:16px">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <span class="rt" style="color:var(--wn)">${esc(art.category)}</span>
                    <span class="mu" style="font-size:11.5px">${art.readTimeMinutes || 5} min read</span>
                  </div>
                  <h3 class="pn" style="font-size:16px;font-weight:600;line-height:1.3;margin-bottom:8px">
                    <a href="#/blog/${art.slug}">${esc(art.title)}</a>
                  </h3>
                  <p class="mu" style="font-size:13px;line-height:1.5;margin:0 0 14px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc(art.excerpt)}</p>
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:10px;border-top:1px solid var(--bd);font-size:12px">
                    <span class="mu">By <b>${esc(art.authorName)}</b></span>
                    <a href="#/blog/${art.slug}" class="vp" style="font-size:12.5px">Read Guide →</a>
                  </div>
                </div>
              </article>
            `).join('')}
          </div>
        ` : ''}

        ${!items.length ? `
          <div class="em" role="status">
            <h2 class="f">No articles found</h2>
            <p class="mu">There are no published articles in this category yet. Check back soon for new style edits.</p>
            <p style="margin-top:16px"><a href="#/blog" class="lm" style="text-decoration:none">View All Guides</a></p>
          </div>
        ` : ''}
      </section>
    `
  };
}

export function renderArticleDetail(
  slug: string,
  articles: Article[] = SEED_ARTICLES,
  isAdminUser: boolean = false
) {
  const art = articles.find(a => a.slug === slug);
  if (!art || (!art.published && !isAdminUser)) {
    return {
      title: 'Article Not Found',
      navKey: 'blog',
      html: `
        <section class="w pgs">
          <nav class="bc" aria-label="Breadcrumb">
            <a href="#/home">Home</a> / <a href="#/blog">Editorial Blog</a> / <span>Not Found</span>
          </nav>
          <div class="em" style="text-align:center;padding:60px 0">
            <h1 class="f">Article Not Found</h1>
            <p class="mu">The requested guide could not be located or may currently be in draft status.</p>
            <p style="margin-top:20px"><a href="#/blog" class="lm" style="text-decoration:none">← Return to Editorial Blog</a></p>
          </div>
        </section>
      `
    };
  }

  const readTime = art.readTimeMinutes || calculateReadTime(art.content);
  const pubDateStr = formatBlogDate(art.publishedAt);
  const modDateStr = formatBlogDate(art.updatedAt || art.publishedAt);
  const canonicalUrl = art.canonicalUrl || `https://devtoshsuperbazaar.github.io/blog/${art.slug}/`;

  const renderedContent = parseMarkdownToHtml(art.content);

  const relatedArticles = articles
    .filter(a => a.slug !== art.slug && a.published && !a.noindex)
    .sort((a, b) => (b.category === art.category ? 1 : 0) - (a.category === art.category ? 1 : 0))
    .slice(0, 3);

  const shareTitle = encodeURIComponent(art.title);
  const shareUrl = encodeURIComponent(canonicalUrl);

  const relatedProductsHtml = (art.relatedProducts && art.relatedProducts.length > 0) ? `
    <section class="art-prods-box" aria-label="Curated recommendations">
      <div style="margin-bottom:16px">
        <span class="art-prods-tag">Curated Recommendations</span>
        <h3 class="f" style="margin:4px 0 0;font-size:20px">Featured in This Guide</h3>
        <p class="mu" style="font-size:12.5px;margin:4px 0 0">Handpicked merchant partner deals curated by Devtosh SuperBazaar.</p>
      </div>
      <div class="g" style="margin-top:0">
        ${art.relatedProducts.map(p => `
          <div class="pc" style="background:var(--sf);border:1px solid var(--bd);border-radius:4px;padding:12px">
            ${p.imgUrl ? `<div class="ph" style="aspect-ratio:1;max-height:180px;border-radius:3px;overflow:hidden;margin-bottom:10px"><img src="${esc(p.imgUrl)}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover" loading="lazy" /></div>` : ''}
            <div class="rt">${esc(p.ret || 'Partner Retailer')}</div>
            <h4 style="font-size:14px;font-weight:600;margin:4px 0 6px;line-height:1.3">${esc(p.name)}</h4>
            <div class="pr" style="margin-bottom:10px">
              <b>${p.price ? inr(p.price) : 'Check Price'}</b>
              ${p.mrp && p.price && p.mrp > p.price ? `<s>${inr(p.mrp)}</s>` : ''}
            </div>
            <a href="${esc(p.affUrl || p.retUrl || '#/home')}" target="_blank" rel="noopener noreferrer" class="lm" style="display:block;text-align:center;min-height:36px;font-size:12px;padding:0 12px;text-decoration:none">Shop at ${esc(p.ret || 'Store')} ↗</a>
          </div>
        `).join('')}
      </div>
    </section>
  ` : '';

  return {
    title: art.title,
    navKey: 'blog',
    html: `
      <section class="w pgs wide art-view">
        ${!art.published ? `
          <div style="background:var(--bl);border:1px solid var(--bd);border-left:4px solid var(--wn);padding:12px 16px;border-radius:4px;margin-bottom:20px;font-size:13px;color:var(--tx)">
            <strong style="color:var(--wn)">⚠️ Admin Preview:</strong> This article is currently saved as a <b>Draft</b> and is marked <code>noindex</code>. It is invisible to public visitors and search engine crawlers.
          </div>
        ` : ''}

        <nav class="bc" aria-label="Breadcrumb">
          <a href="#/home">Home</a> / <a href="#/blog">Editorial Blog</a> / <a href="#/blog?cat=${encodeURIComponent(art.category)}">${esc(art.category)}</a> / <span aria-current="page">${esc(art.title)}</span>
        </nav>

        <article class="art-container">
          <header class="art-header">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
              <span class="tag">${esc(art.category)}</span>
              <span class="mu" style="font-size:12px">${readTime} min read</span>
              ${isAdminUser ? `<a href="#/admin/blog/edit/${art.id}" class="adm-btn-sm" style="margin-left:auto;text-decoration:none">✏️ Edit Article</a>` : ''}
            </div>

            <h1 class="f art-h1" tabindex="-1">${esc(art.title)}</h1>
            <p class="lead art-lead">${esc(art.excerpt)}</p>

            <div class="art-byline">
              <div style="display:flex;align-items:center;gap:12px">
                <div class="art-avatar" aria-hidden="true">${art.authorName.charAt(0)}</div>
                <div>
                  <div style="font-size:13.5px;font-weight:600">
                    ${art.authorUrl ? `<a href="${esc(art.authorUrl)}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline">${esc(art.authorName)}</a>` : esc(art.authorName)}
                  </div>
                  <div class="mu" style="font-size:12px">
                    Published on <time datetime="${art.publishedAt}">${pubDateStr}</time>
                    ${art.updatedAt !== art.publishedAt ? ` · Updated <time datetime="${art.updatedAt}">${modDateStr}</time>` : ''}
                  </div>
                </div>
              </div>

              <!-- Quick Top Social Share -->
              <div style="display:flex;gap:6px;align-items:center">
                <a class="sh-btn wa" href="https://api.whatsapp.com/send?text=${shareTitle}%20${shareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp" style="min-height:30px;padding:0 8px;font-size:11.5px">
                  <svg aria-hidden="true" width="13" height="13"><use href="#wa"/></svg>
                  <span>Share</span>
                </a>
              </div>
            </div>
          </header>

          ${art.coverImage ? `
            <figure class="art-cover-fig">
              <img class="art-cover-img" src="${esc(art.coverImage)}" alt="${esc(art.coverImageAlt)}" loading="eager" />
              ${art.coverImageAlt ? `<figcaption class="art-cover-cap">${esc(art.coverImageAlt)}</figcaption>` : ''}
            </figure>
          ` : ''}

          ${art.hasAffiliateLinks ? `
            <aside class="art-disclosure" role="note">
              <strong>Editorial &amp; Affiliate Disclosure:</strong> Devtosh SuperBazaar curates independent style recommendations. This article contains verified merchant partner links. When you purchase through links in this guide, we may earn a small referral commission at no extra cost to you.
            </aside>
          ` : ''}

          <div class="art-content">
            ${renderedContent}
          </div>

          ${relatedProductsHtml}

          <!-- Social Share Bar -->
          <div class="sh-bar" role="region" aria-label="Share this guide" style="margin-top:40px">
            <span class="sh-lbl">Share Guide:</span>
            <a class="sh-btn wa" href="https://api.whatsapp.com/send?text=${shareTitle}%20${shareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp">
              <svg aria-hidden="true" width="15" height="15"><use href="#wa"/></svg>
              <span>WhatsApp</span>
            </a>
            <a class="sh-btn tg" href="https://t.me/share/url?url=${shareUrl}&text=${shareTitle}" target="_blank" rel="noopener noreferrer" aria-label="Share on Telegram">
              <svg aria-hidden="true" width="15" height="15"><use href="#tg"/></svg>
              <span>Telegram</span>
            </a>
            <a class="sh-btn" href="https://twitter.com/intent/tweet?text=${shareTitle}&url=${shareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on X">
              <span>X / Twitter</span>
            </a>
            <button type="button" class="sh-btn" data-a="copy-prod-link" data-url="${esc(canonicalUrl)}" aria-label="Copy article link">
              <svg aria-hidden="true" width="15" height="15"><use href="#cp"/></svg>
              <span class="cp-text">Copy Link</span>
            </button>
          </div>

          <!-- Article Tags -->
          ${art.tags && art.tags.length > 0 ? `
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:24px">
              <span class="mu" style="font-size:12px;font-weight:600">Tags:</span>
              ${art.tags.map(t => `<span style="font-size:11.5px;background:var(--sf);border:1px solid var(--bd);padding:3px 10px;border-radius:12px;color:var(--mu)">#${esc(t)}</span>`).join('')}
            </div>
          ` : ''}

          <div style="margin-top:40px;padding-top:20px;border-top:1px solid var(--bd);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
            <a href="#/blog" class="vp">← Back to all style guides</a>
            <a href="#/home" class="vp">Explore collections catalogue →</a>
          </div>
        </article>

        ${relatedArticles.length ? `
          <h2 class="f rh" style="margin-top:48px">More Style Edits</h2>
          <div class="g" style="margin-top:20px">
            ${relatedArticles.map(r => `
              <article class="pc" style="background:var(--sf);border:1px solid var(--bd);border-radius:4px;overflow:hidden">
                ${r.coverImage ? `
                  <a href="/blog/${r.slug}/" class="ph" style="aspect-ratio:16/9;border:0;border-bottom:1px solid var(--bd)">
                    <img src="${esc(r.coverImage)}" alt="${esc(r.coverImageAlt || r.title)}" style="width:100%;height:100%;object-fit:cover" loading="lazy" />
                  </a>
                ` : ''}
                <div class="pi" style="padding:14px">
                  <span class="rt" style="color:var(--wn)">${esc(r.category)}</span>
                  <h3 class="pn" style="font-size:15px;margin-bottom:6px">
                    <a href="/blog/${r.slug}/">${esc(r.title)}</a>
                  </h3>
                  <a href="/blog/${r.slug}/" class="vp" style="font-size:12px">Read Guide →</a>
                </div>
              </article>
            `).join('')}
          </div>
        ` : ''}
      </section>
    `
  };
}

// --------------------------------------------------------------------------
// Admin Views
// --------------------------------------------------------------------------

export function renderAdminArticles(
  articles: Article[] = SEED_ARTICLES,
  filter: { q: string; status: string; category: string } = { q: '', status: 'all', category: 'all' },
  sort: string = 'newest'
) {
  let items = [...articles];

  if (filter.status === 'published') items = items.filter(a => a.published);
  if (filter.status === 'draft') items = items.filter(a => !a.published);
  if (filter.category && filter.category !== 'all') items = items.filter(a => a.category === filter.category);
  if (filter.q) {
    const query = filter.q.toLowerCase();
    items = items.filter(a =>
      a.title.toLowerCase().includes(query) ||
      a.slug.toLowerCase().includes(query) ||
      a.category.toLowerCase().includes(query) ||
      a.authorName.toLowerCase().includes(query)
    );
  }

  if (sort === 'newest') {
    items.sort((a, b) => new Date(b.updatedAt || b.publishedAt).getTime() - new Date(a.updatedAt || a.publishedAt).getTime());
  } else if (sort === 'oldest') {
    items.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
  } else if (sort === 'title-asc') {
    items.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === 'title-desc') {
    items.sort((a, b) => b.title.localeCompare(a.title));
  }

  const allCategories = Array.from(new Set(articles.map(a => a.category).filter(Boolean))).sort();
  const totalCount = articles.length;
  const publishedCount = articles.filter(a => a.published).length;
  const draftCount = totalCount - publishedCount;

  return {
    title: 'Blog Article Management',
    navKey: 'admin',
    html: `
      <div class="adm-wrap">
        <header class="adm-hdr">
          <div class="adm-hdr-title">
            <img class="lg-mark" src="/favicon-48x48.png" srcset="/favicon-48x48.png 1x, /apple-touch-icon.png 2x" style="width:28px;height:28px;border-radius:6px;object-fit:cover;flex:none;display:block" width="28" height="28" alt="" aria-hidden="true" />
            <div>
              <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--wn);font-weight:600">Devtosh SuperBazaar CMS</div>
              <h1 style="font-size:18px;margin:0;font-weight:600;font-family:'Bodoni Moda',serif">Blog Article Management</h1>
            </div>
          </div>
          <div class="adm-hdr-actions">
            <a href="#/admin/blog/new" class="lm" style="height:36px;padding:0 16px;text-decoration:none;font-size:12.5px">+ Write New Article</a>
            <a href="/" class="adm-btn-sec" style="text-decoration:none">View Store →</a>
          </div>
        </header>

        <div class="adm-body">
          <!-- KPI Stats Bar -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
            <div style="background:var(--bg);border:1px solid var(--bd);padding:12px 14px;border-radius:3px">
              <div class="mu" style="font-size:11px;text-transform:uppercase;letter-spacing:.05em">Total Articles</div>
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
              <div style="font-size:22px;font-weight:700;color:var(--tx);font-family:'Bodoni Moda',serif">${allCategories.length}</div>
            </div>
          </div>

          <!-- Controls Bar -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:12px">
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <input type="search" id="adm-art-q" placeholder="Search title, slug, author…" value="${esc(filter.q)}" class="adm-input" style="max-width:220px;height:38px;font-size:13px" />
              
              <select id="adm-art-status" class="adm-input" style="width:auto;height:38px;font-size:13px">
                <option value="all" ${filter.status === 'all' ? 'selected' : ''}>All Status</option>
                <option value="published" ${filter.status === 'published' ? 'selected' : ''}>Published Only</option>
                <option value="draft" ${filter.status === 'draft' ? 'selected' : ''}>Drafts Only</option>
              </select>

              <select id="adm-art-cat" class="adm-input" style="width:auto;height:38px;font-size:13px">
                <option value="all">All Categories</option>
                ${allCategories.map(c => `<option value="${esc(c)}" ${filter.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
              </select>

              <select id="adm-art-sort" class="adm-input" style="width:auto;height:38px;font-size:13px">
                <option value="newest" ${sort === 'newest' ? 'selected' : ''}>Newest First</option>
                <option value="oldest" ${sort === 'oldest' ? 'selected' : ''}>Oldest First</option>
                <option value="title-asc" ${sort === 'title-asc' ? 'selected' : ''}>Title A-Z</option>
                <option value="title-desc" ${sort === 'title-desc' ? 'selected' : ''}>Title Z-A</option>
              </select>
            </div>

            <a href="#/admin/blog/new" class="lm" style="height:38px;padding:0 18px;text-decoration:none;font-size:13px">+ New Article</a>
          </div>

          <!-- Articles List -->
          <div class="adm-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--bd);padding-bottom:10px">
              <div style="font-size:12.5px;color:var(--mu)">
                Showing <b>${items.length}</b> of ${totalCount} articles
                ${filter.q ? ` · matching "<b>${esc(filter.q)}</b>"` : ''}
              </div>
            </div>

            ${items.length ? `
              <div class="adm-prod-list">
                ${items.map(art => `
                  <div class="adm-prod-card" id="art-row-${art.id}">
                    <div style="display:flex;gap:14px;align-items:flex-start">
                      ${art.coverImage ? `
                        <img src="${esc(art.coverImage)}" alt="" style="width:90px;height:65px;object-fit:cover;border:1px solid var(--bd);border-radius:2px;flex:none" loading="lazy" />
                      ` : `
                        <div style="width:90px;height:65px;background:var(--bl);display:grid;place-items:center;font-size:10px;color:var(--wn);border:1px solid var(--bd);border-radius:2px;flex:none">NO IMG</div>
                      `}
                      <div style="flex:1;min-width:0">
                        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                          <span class="adm-badge ${art.published ? 'pub' : 'draft'}">${art.published ? 'Published' : 'Draft'}</span>
                          <span style="font-size:11px;background:${art.noindex ? '#FFEBEE' : '#E8F5E9'};color:${art.noindex ? '#C62828' : '#2E7D32'};padding:1px 6px;border-radius:2px;font-weight:600">${art.noindex ? 'noindex' : 'index'}</span>
                          <span class="mu" style="font-size:11.5px;font-weight:500">${esc(art.category)}</span>
                          <span class="mu" style="font-size:11px">· ${formatBlogDate(art.publishedAt)}</span>
                        </div>
                        <h3 style="font-size:15px;margin:5px 0 3px;font-weight:600">
                          <a href="#/admin/blog/edit/${art.id}" style="color:inherit;text-decoration:none">${esc(art.title)}</a>
                        </h3>
                        <div class="mu" style="font-size:12px;margin-top:2px">
                          By <b>${esc(art.authorName)}</b> · Slug: <code>/blog/${esc(art.slug)}/</code> · ${art.readTimeMinutes || 5} min read
                        </div>
                      </div>
                    </div>

                    <div class="adm-card-actions">
                      <a href="#/admin/blog/edit/${art.id}" class="adm-btn-sm" style="font-weight:600;background:var(--bl);border-color:var(--wn);color:var(--wn)">Edit</a>
                      <button class="adm-btn-sm" data-a="adm-toggle-art-pub" data-id="${art.id}" data-val="${!art.published}">
                        ${art.published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button class="adm-btn-sm del" data-a="adm-del-art" data-id="${art.id}" data-title="${esc(art.title)}">
                        Delete
                      </button>
                      <a href="/blog/${art.slug}/" class="adm-btn-sm" target="_blank" title="View live article in new tab">View Preview ↗</a>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div style="text-align:center;padding:48px 0;color:var(--mu)">
                <p style="font-size:15px;margin-bottom:8px">No articles match your search or filter.</p>
                <a href="#/admin/blog/new" class="lm" style="display:inline-block;margin-top:8px;text-decoration:none">+ Create First Article</a>
              </div>
            `}
          </div>
        </div>

        <nav class="adm-nav" aria-label="Admin Navigation">
          <div class="adm-nav-inner">
            <a href="#/admin/dashboard" class="adm-tab">
              <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              <span>Overview</span>
            </a>
            <a href="#/admin/products" class="adm-tab">
              <svg viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              <span>Products</span>
            </a>
            <a href="#/admin/blog" class="adm-tab active">
              <svg viewBox="0 0 24 24"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/><path d="M6 14h6"/></svg>
              <span>Blog</span>
            </a>
            <a href="#/admin/products/new" class="adm-tab">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
              <span>+ Add</span>
            </a>
            <a href="#/admin/categories" class="adm-tab">
              <svg viewBox="0 0 24 24"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
              <span>Categories</span>
            </a>
            <a href="#/admin/settings" class="adm-tab">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
              <span>Settings</span>
            </a>
          </div>
        </nav>
      </div>
    `
  };
}

export function renderArticleForm(
  art?: Article,
  editId?: string,
  allArticles: Article[] = SEED_ARTICLES,
  availableProducts: any[] = []
) {
  const isEdit = !!art;
  const title = isEdit ? `Edit Article: ${art!.title}` : 'Write New Article';

  const currentSlug = art?.slug || '';
  const currentTitle = art?.title || '';
  const currentMetaTitle = art?.metaTitle || '';
  const currentMetaDesc = art?.metaDesc || '';
  const currentExcerpt = art?.excerpt || '';
  const currentContent = art?.content || '';
  const currentAuthorName = art?.authorName || 'Devtosh Editorial Team';
  const currentAuthorUrl = art?.authorUrl || '';
  const currentCover = art?.coverImage || '';
  const currentAlt = art?.coverImageAlt || '';
  const currentCategory = art?.category || 'Style Guides';
  const currentTags = (art?.tags || []).join(', ');
  const isPublished = art ? art.published : true;
  const isNoindex = art ? !!art.noindex : false;
  const currentCanonical = art?.canonicalUrl || '';
  const currentOgTitle = art?.ogTitle || '';
  const currentOgDesc = art?.ogDesc || '';
  const currentOgImage = art?.ogImage || '';
  const hasAffiliate = art ? art.hasAffiliateLinks : true;
  const existingRelIds = new Set((art?.relatedProducts || []).map(p => p.id || p.name));

  return {
    title,
    navKey: 'admin',
    html: `
      <div class="adm-wrap">
        <header class="adm-hdr">
          <div class="adm-hdr-title">
            <img class="lg-mark" src="/favicon-48x48.png" srcset="/favicon-48x48.png 1x, /apple-touch-icon.png 2x" style="width:28px;height:28px;border-radius:6px;object-fit:cover;flex:none;display:block" width="28" height="28" alt="" aria-hidden="true" />
            <div>
              <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--wn);font-weight:600">Devtosh SuperBazaar Blog Editor</div>
              <h1 style="font-size:18px;margin:0;font-weight:600;font-family:'Bodoni Moda',serif">${esc(title)}</h1>
            </div>
          </div>
          <div class="adm-hdr-actions">
            <a href="#/admin/articles" class="adm-btn-sec" style="text-decoration:none">← All Articles</a>
          </div>
        </header>

        <div class="adm-body" style="max-width:880px;margin:0 auto">
          <!-- Client Help Banner -->
          <div style="background:var(--sf);border:1px solid var(--bd);border-left:4px solid var(--wn);padding:14px 18px;border-radius:4px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div>
              <strong style="color:var(--dp);font-size:14px">Simple Blog Writer</strong>
              <p class="mu" style="margin:2px 0 0;font-size:12.5px">Enter your title, write your story, and use the <b>🔗 Add Link</b> button to insert links anywhere in your text. Google SEO and website links are prepared automatically!</p>
            </div>
            <div style="display:flex;gap:8px">
              <span class="adm-badge ${isPublished ? 'pub' : 'draft'}">${isPublished ? 'Live on Store' : 'Draft Only'}</span>
            </div>
          </div>

          <form id="article-edit-form">
            <input type="hidden" id="art-id" value="${art?.id || ''}" />
            <input type="hidden" id="art-created-at" value="${art?.createdAt || art?.publishedAt || new Date().toISOString()}" />

            <!-- Card 1: Article Basics -->
            <div class="adm-card" style="padding:22px;margin-bottom:20px">
              <h2 style="font-size:16px;margin:0 0 16px;font-weight:700;color:var(--dp);display:flex;align-items:center;gap:8px">
                <span>1. Article Basics</span>
              </h2>

              <div class="adm-field">
                <label for="art-title" style="font-size:13.5px">Article Title *</label>
                <input type="text" id="art-title" required value="${esc(currentTitle)}" class="adm-input" placeholder="e.g. 5 Easy Ways to Style Ethnic Kurtis for Daily Comfort" style="font-size:15px;font-weight:600;height:46px" />
              </div>

              <!-- Friendly Website Link Preview -->
              <div style="background:var(--bg);border:1px solid var(--bd);padding:10px 14px;border-radius:4px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                <div style="font-size:12.5px;color:var(--mu);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                  <span>Web Link:</span>
                  <code id="art-slug-preview-text" style="color:var(--dp);font-weight:600;background:var(--sf);border:1px solid var(--bd);padding:2px 8px;border-radius:3px">https://devtoshsuperbazaar.github.io/blog/${currentSlug || 'article-slug'}/</code>
                </div>
                <button type="button" id="art-toggle-slug-btn" style="background:none;border:none;color:var(--wn);font-size:12px;font-weight:600;cursor:pointer;text-decoration:underline">
                  Customize web link
                </button>
              </div>

              <!-- Hidden/Collapsible Slug Field -->
              <div id="art-slug-wrap" style="display:none;margin-bottom:16px;background:var(--sf);border:1px solid var(--bd);padding:12px;border-radius:4px">
                <label for="art-slug" style="font-size:12px;font-weight:600;margin-bottom:4px;display:block">URL Slug (Letters, numbers, and hyphens only)</label>
                <div style="display:flex;gap:8px">
                  <input type="text" id="art-slug" value="${esc(currentSlug)}" class="adm-input" placeholder="e.g. styling-ethnic-kurtis" style="font-size:13px;height:38px" />
                  <button type="button" id="art-slug-sync" class="adm-btn-sec" style="height:38px;white-space:nowrap;font-size:12px">Auto-generate</button>
                </div>
              </div>

              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-bottom:16px">
                <div class="adm-field" style="margin:0">
                  <label for="art-category">Category *</label>
                  <select id="art-category" class="adm-input" style="height:42px;font-size:13.5px">
                    <option value="Style Guides" ${currentCategory === 'Style Guides' ? 'selected' : ''}>Style Guides &amp; Inspiration</option>
                    <option value="Shopping Tips" ${currentCategory === 'Shopping Tips' ? 'selected' : ''}>Shopping Tips &amp; Fabric Advice</option>
                    <option value="Ethnic Wear" ${currentCategory === 'Ethnic Wear' ? 'selected' : ''}>Ethnic Wear &amp; Sarees</option>
                    <option value="Footwear &amp; Shoes" ${currentCategory === 'Footwear &amp; Shoes' ? 'selected' : ''}>Footwear &amp; Shoes</option>
                    <option value="Accessories &amp; Lifestyle" ${currentCategory === 'Accessories &amp; Lifestyle' ? 'selected' : ''}>Accessories &amp; Lifestyle</option>
                    <option value="Electronics &amp; Mobiles" ${currentCategory === 'Electronics &amp; Mobiles' ? 'selected' : ''}>Electronics &amp; Mobiles</option>
                    <option value="Everyday Deals" ${currentCategory === 'Everyday Deals' ? 'selected' : ''}>Everyday Budget Deals</option>
                  </select>
                </div>

                <div class="adm-field" style="margin:0">
                  <label for="art-author">Author / Curator Name</label>
                  <input type="text" id="art-author" value="${esc(currentAuthorName)}" class="adm-input" placeholder="Devtosh Editorial Team" style="height:42px;font-size:13.5px" />
                </div>
              </div>

              <div class="adm-field" style="margin-bottom:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <label for="art-excerpt" style="margin:0">Short Article Summary *</label>
                  <span class="mu" style="font-size:11.5px">Shown on article cards &amp; Google previews</span>
                </div>
                <textarea id="art-excerpt" rows="2" class="adm-input" placeholder="A brief, engaging 1-2 sentence overview of what readers will learn in this post...">${esc(currentExcerpt)}</textarea>
              </div>

              <!-- Cover Image Picker with Instant Preview -->
              <div class="adm-field" style="margin-bottom:0">
                <label for="art-cover">Cover Photo URL (Optional)</label>
                <div style="display:flex;gap:12px;align-items:flex-start">
                  <div style="flex:1">
                    <input type="url" id="art-cover" value="${esc(currentCover)}" class="adm-input" placeholder="Paste image link, e.g. https://images.unsplash.com/..." style="font-size:13px" />
                    <input type="text" id="art-cover-alt" value="${esc(currentAlt)}" class="adm-input" placeholder="Description of image (e.g. Traditional yellow printed kurti)" style="margin-top:6px;font-size:12px;height:36px" />
                  </div>
                  <div id="art-cover-preview-box" style="width:110px;height:82px;border:1px dashed var(--bd);border-radius:4px;display:grid;place-items:center;background:var(--bg);overflow:hidden;flex-shrink:0">
                    ${currentCover ? `<img src="${esc(currentCover)}" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='<span style=\\'font-size:10px;color:#c62828\\'>Invalid img</span>'" />` : '<span class="mu" style="font-size:11px;text-align:center;padding:4px">Photo Preview</span>'}
                  </div>
                </div>
              </div>
            </div>

            <!-- Card 2: Article Writing Area with Interactive Toolbar & Add Link Modal -->
            <div class="adm-card" style="padding:22px;margin-bottom:20px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
                <h2 style="font-size:16px;margin:0;font-weight:700;color:var(--dp)">2. Article Story &amp; Content</h2>
                <!-- Write / Preview Mode Switcher -->
                <div style="display:inline-flex;border:1px solid var(--bd);border-radius:4px;overflow:hidden">
                  <button type="button" id="art-mode-write" class="adm-tab-btn active" style="padding:6px 14px;border:none;background:var(--wn);color:#fff;font-size:12px;font-weight:600;cursor:pointer">
                    ✍️ Write
                  </button>
                  <button type="button" id="art-mode-preview" class="adm-tab-btn" style="padding:6px 14px;border:none;background:var(--sf);color:var(--tx);font-size:12px;font-weight:600;cursor:pointer">
                    👁️ Preview Live
                  </button>
                </div>
              </div>

              <!-- Visual Toolbar with prominent "Add Link" button -->
              <div class="art-toolbar" style="background:var(--bl);border:1px solid var(--bd);border-bottom:none;border-radius:4px 4px 0 0;padding:10px;display:flex;align-items:center;flex-wrap:wrap;gap:8px">
                <!-- PRIMARY LINK BUTTON -->
                <button type="button" id="art-btn-open-link" style="background:var(--wn);color:#fff;border:1px solid var(--wn);border-radius:3px;padding:6px 14px;font-size:12.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 1px 3px rgba(0,0,0,0.1)" title="Add a link to the selected text or insert a new web link">
                  <span>🔗 Add Link</span>
                </button>

                <!-- QUICK PRODUCT LINK SHORTCUT -->
                <button type="button" id="art-btn-open-prod-link" style="background:var(--sf);color:var(--wn);border:1px solid var(--wn);border-radius:3px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px" title="Insert an affiliate product recommendation link">
                  <span>🛍️ Link Store Product</span>
                </button>

                <div style="width:1px;height:24px;background:var(--bd);margin:0 4px"></div>

                <!-- TEXT FORMATTING BUTTONS (High contrast with brand palette) -->
                <button type="button" class="art-tb-btn" data-art-action="bold" title="Bold text (**text**)" style="font-weight:700;padding:6px 12px;background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:3px;cursor:pointer">B</button>
                <button type="button" class="art-tb-btn" data-art-action="italic" title="Italic text (*text*)" style="font-style:italic;padding:6px 12px;background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:3px;cursor:pointer">I</button>
                <button type="button" class="art-tb-btn" data-art-action="h2" title="Section Heading 2" style="font-weight:600;padding:6px 12px;background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:3px;cursor:pointer">H2 Heading</button>
                <button type="button" class="art-tb-btn" data-art-action="h3" title="Subheading 3" style="font-weight:600;padding:6px 12px;background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:3px;cursor:pointer">H3 Subheading</button>
                <button type="button" class="art-tb-btn" data-art-action="list" title="Bullet List" style="padding:6px 12px;background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:3px;cursor:pointer">• Bullet List</button>
                <button type="button" class="art-tb-btn" data-art-action="quote" title="Quote Callout" style="padding:6px 12px;background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:3px;cursor:pointer">❝ Quote</button>
                <button type="button" class="art-tb-btn" data-art-action="disclosure" title="Affiliate Notice" style="padding:6px 12px;background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:3px;cursor:pointer">⚖️ Disclosure</button>
              </div>

              <!-- Main Writing Textarea -->
              <div id="art-write-container">
                <textarea id="art-content" required rows="18" class="adm-input" style="border-radius:0 0 4px 4px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.65;padding:14px" placeholder="Start writing your article here...&#10;&#10;Tip: Highlight any word and click '🔗 Add Link' to turn it into a clickable web link or product link.&#10;&#10;Use 'H2 Heading' for main sections to give your article clean structure for Google and your readers.">${esc(currentContent)}</textarea>
              </div>

              <!-- Live Formatted Preview Pane (Hidden until 'Preview' clicked) -->
              <div id="art-preview-pane" style="display:none;min-height:360px;max-height:550px;overflow-y:auto;background:var(--sf);border:1px solid var(--bd);border-radius:0 0 4px 4px;padding:24px;color:var(--tx)" class="art-content">
                <!-- Live rendered HTML will be placed here -->
              </div>

              <!-- Word Count & Read Time -->
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:12px;color:var(--mu)">
                <span id="art-word-count">0 words</span>
                <span id="art-read-estimate">~1 min read</span>
              </div>
            </div>

            <!-- Card 3: Recommended Store Products (Easy Checkbox Selection) -->
            <div class="adm-card" style="padding:22px;margin-bottom:20px">
              <h2 style="font-size:16px;margin:0 0 6px;font-weight:700;color:var(--dp)">3. Recommend Store Products (Optional)</h2>
              <p class="mu" style="font-size:12.5px;margin:0 0 16px">Check any items you'd like to show at the bottom of this article with affiliate links:</p>

              <div id="art-product-picker" style="max-height:220px;overflow-y:auto;border:1px solid var(--bd);border-radius:4px;padding:8px 12px;background:var(--bg)">
                ${availableProducts && availableProducts.length > 0 ? availableProducts.map(p => `
                  <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--bd);cursor:pointer;font-size:13px">
                    <div style="display:flex;align-items:center;gap:10px;min-width:0">
                      <input type="checkbox" class="art-rel-prod-cb" value="${esc(p.id)}" data-name="${esc(p.name)}" data-price="${p.price}" data-url="${esc(p.affUrl || p.retUrl || '')}" data-img="${esc(p.imgUrl || '')}" data-ret="${esc(p.ret || '')}" ${existingRelIds.has(p.id) || existingRelIds.has(p.name) ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--wn)" />
                      <span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--tx)">${esc(p.name)}</span>
                    </div>
                    <span style="font-size:12px;color:var(--wn);font-weight:600;white-space:nowrap">₹${Number(p.price || 0).toLocaleString('en-IN')}</span>
                  </label>
                `).join('') : `
                  <div style="text-align:center;padding:16px;font-size:12.5px;color:var(--mu)">
                    No products found in catalogue. You can link any product inside your text using the <b>🔗 Add Link</b> button above.
                  </div>
                `}
              </div>
            </div>

            <!-- Card 4: Publication Status & Submission (Styled with Devtosh SuperBazaar Brand Palette) -->
            <div class="adm-card" style="padding:22px;margin-bottom:20px">
              <h2 style="font-size:16px;margin:0 0 14px;font-weight:700;color:var(--dp)">4. Publish Status</h2>

              <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:20px">
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:600;font-size:13.5px;background:${isPublished ? 'var(--bl)' : 'var(--sf)'};color:var(--tx);padding:12px 18px;border-radius:4px;border:1.5px solid ${isPublished ? 'var(--wn)' : 'var(--bd)'};transition:all .15s">
                  <input type="radio" name="art-status-radio" value="published" ${isPublished ? 'checked' : ''} style="accent-color:var(--wn);width:17px;height:17px" />
                  <span style="color:var(--tx);font-weight:600">🟢 Publish Live on Store</span>
                </label>
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:600;font-size:13.5px;background:${!isPublished ? 'var(--bl)' : 'var(--sf)'};color:var(--tx);padding:12px 18px;border-radius:4px;border:1.5px solid ${!isPublished ? 'var(--wn)' : 'var(--bd)'};transition:all .15s">
                  <input type="radio" name="art-status-radio" value="draft" ${!isPublished ? 'checked' : ''} style="accent-color:var(--wn);width:17px;height:17px" />
                  <span style="color:var(--tx);font-weight:600">🟡 Save as Private Draft</span>
                </label>
              </div>

              <!-- Collapsible Advanced SEO Box (Keeps UI Simple for Non-Technical Clients) -->
              <details style="border:1px solid var(--bd);background:var(--bg);border-radius:4px;padding:12px;margin-bottom:20px">
                <summary style="font-size:13px;font-weight:600;color:var(--wn);cursor:pointer">
                  ⚙️ Advanced Google SEO &amp; Sharing Settings (Optional)
                </summary>
                <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--bd)">
                  <p class="mu" style="font-size:12px;margin:0 0 14px">
                    All SEO metadata is automatically created from your Title and Summary. Edit these only if you want specific custom keywords.
                  </p>

                  <div class="adm-field">
                    <label for="art-meta-title">Custom Search Title</label>
                    <input type="text" id="art-meta-title" value="${esc(currentMetaTitle)}" class="adm-input" placeholder="Defaults to Article Title" style="font-size:13px" />
                    <span id="art-title-counter" style="font-size:11px;color:var(--mu);margin-top:2px;display:block">Recommended: 45–60 characters</span>
                  </div>

                  <div class="adm-field">
                    <label for="art-meta-desc">Custom Search Meta Description</label>
                    <textarea id="art-meta-desc" rows="2" class="adm-input" placeholder="Defaults to Article Summary" style="font-size:13px">${esc(currentMetaDesc)}</textarea>
                    <span id="art-desc-counter" style="font-size:11px;color:var(--mu);margin-top:2px;display:block">Recommended: 140–160 characters</span>
                  </div>

                  <div class="adm-field">
                    <label for="art-tags">Tags (comma-separated)</label>
                    <input type="text" id="art-tags" value="${esc(currentTags)}" class="adm-input" placeholder="kurtis, ethnic wear, styling tips" style="font-size:13px" />
                  </div>

                  <div class="adm-field">
                    <label for="art-canonical">Canonical URL Override</label>
                    <input type="url" id="art-canonical" value="${esc(currentCanonical)}" class="adm-input" placeholder="https://devtoshsuperbazaar.github.io/blog/..." style="font-size:13px" />
                  </div>

                  <div class="adm-field">
                    <label for="art-author-url">Author Profile URL</label>
                    <input type="url" id="art-author-url" value="${esc(currentAuthorUrl)}" class="adm-input" placeholder="https://instagram.com/..." style="font-size:13px" />
                  </div>

                  <div class="adm-field" style="margin-bottom:0">
                    <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer">
                      <input type="checkbox" id="art-noindex" ${isNoindex ? 'checked' : ''} style="width:16px;height:16px" />
                      <span>Block search engines from indexing this page (noindex)</span>
                    </label>
                  </div>
                </div>
              </details>

              <!-- Error Alert Box Styled with Brand Theme -->
              <div id="art-form-errors" style="display:none;background:var(--bl);border:1px solid var(--wn);border-left:4px solid var(--wn);color:var(--tx);padding:14px 18px;border-radius:4px;margin-bottom:16px;font-size:13px"></div>

              <!-- Main Submission Buttons -->
              <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
                <button type="submit" id="art-submit-btn" class="lm" style="height:46px;padding:0 32px;font-size:14.5px;font-weight:700">
                  ${isEdit ? '✓ Update Article' : '⚡ Publish Article'}
                </button>
                <a href="#/admin/articles" class="adm-btn-sec" style="height:46px;padding:0 22px;text-decoration:none">
                  Cancel
                </a>
              </div>
            </div>
          </form>
        </div>
      </div>

      <!-- ======================================================== -->
      <!-- Interactive Modal: Insert Link Inside Text                -->
      <!-- ======================================================== -->
      <div id="art-link-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;place-items:center;padding:16px;backdrop-filter:blur(2px)">
        <div style="background:var(--sf);border:1px solid var(--bd);border-radius:6px;max-width:480px;width:100%;padding:24px;box-shadow:0 16px 40px rgba(0,0,0,0.25);position:relative">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid var(--bd);padding-bottom:12px">
            <h3 style="margin:0;font-size:17px;font-weight:700;color:var(--dp);display:flex;align-items:center;gap:8px">
              <span>🔗 Add Link Inside Text</span>
            </h3>
            <button type="button" id="art-link-modal-close" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--mu);padding:4px" title="Close">✕</button>
          </div>

          <div class="adm-field">
            <label for="art-modal-link-text" style="font-size:13px">Text to Click on *</label>
            <input type="text" id="art-modal-link-text" class="adm-input" placeholder="e.g. view this cotton kurti" style="font-size:13.5px" />
            <span class="mu" style="font-size:11.5px;margin-top:3px;display:block">This is the word or sentence that readers can click on.</span>
          </div>

          <div class="adm-field">
            <label for="art-modal-link-url" style="font-size:13px">Web Link (URL) *</label>
            <input type="url" id="art-modal-link-url" class="adm-input" placeholder="https://..." style="font-size:13.5px" />
          </div>

          <!-- Quick Store Product Picker Dropdown Styled with Brand Palette -->
          <div style="background:var(--bl);border:1px dashed var(--wn);border-radius:4px;padding:12px 14px;margin-bottom:16px">
            <label for="art-modal-prod-select" style="font-size:12px;font-weight:600;color:var(--dp);display:block;margin-bottom:6px">
              ⚡ Or link to an item from your store catalogue:
            </label>
            <select id="art-modal-prod-select" class="adm-input" style="height:38px;font-size:13px;background:var(--sf);color:var(--tx);border:1px solid var(--bd)">
              <option value="">-- Choose a store product --</option>
              ${availableProducts && availableProducts.length > 0 ? availableProducts.map(p => `
                <option value="${esc(p.affUrl || p.retUrl || `/product/${p.slug}/`)}" data-name="${esc(p.name)}">
                  ${esc(p.name)} (₹${p.price || 0})
                </option>
              `).join('') : ''}
            </select>
          </div>

          <div id="art-modal-link-error" style="display:none;color:#C62828;font-size:12px;margin-bottom:12px;font-weight:600"></div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;border-top:1px solid var(--bd);padding-top:14px">
            <button type="button" id="art-modal-cancel-btn" class="adm-btn-sec" style="height:38px;padding:0 16px">Cancel</button>
            <button type="button" id="art-modal-insert-btn" class="lm" style="height:38px;padding:0 22px;font-weight:700">✓ Insert Link</button>
          </div>
        </div>
      </div>
    `
  };
}
