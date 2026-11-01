import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

import fs from 'fs';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'save-firebase-config-plugin',
        configureServer(server) {
          server.middlewares.use('/api/save-firebase-config', (req, res) => {
            if (req.method === 'POST') {
              let body = '';
              req.on('data', (chunk) => { body += chunk; });
              req.on('end', () => {
                try {
                  const data = JSON.parse(body);
                  const configPath = path.resolve(import.meta.dirname, 'firebase-applet-config.json');
                  let current: any = {};
                  if (fs.existsSync(configPath)) {
                    current = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                  }
                  const updated = { ...current, ...data };
                  fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf-8');
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, config: updated }));
                } catch (e: any) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: e?.message }));
                }
              });
              return;
            }
            res.statusCode = 405;
            res.end('Method not allowed');
          });

          // Product metadata extraction endpoint
          server.middlewares.use('/api/extract-product', (req, res) => {
            if (req.method === 'POST') {
              let body = '';
              req.on('data', (chunk) => { body += chunk; });
              req.on('end', async () => {
                try {
                  const { url, text } = JSON.parse(body || '{}');
                  const product: any = {};

                  // 1. Text Parsing if provided
                  if (text && typeof text === 'string') {
                    const cleanText = text.trim();
                    const nameM = cleanText.match(/(?:Name|Product Name|Title|Item)\s*[:\-]\s*([^\n\r]+)/i);
                    if (nameM) product.name = nameM[1].trim();

                    const priceM = cleanText.match(/(?:Price|Selling Price|Offer Price|Rs\.?|₹)\s*[:\-]?\s*₹?\s*([0-9,]+)/i);
                    if (priceM) product.price = Number(priceM[1].replace(/,/g, ''));

                    const mrpM = cleanText.match(/(?:MRP|Original Price|Strike Price|M\.R\.P\.?)\s*[:\-]?\s*₹?\s*([0-9,]+)/i);
                    if (mrpM) product.mrp = Number(mrpM[1].replace(/,/g, ''));

                    const colM = cleanText.match(/(?:Color|Colour)\s*[:\-]\s*([^\n\r]+)/i);
                    if (colM) product.col = colM[1].trim();

                    const sizeM = cleanText.match(/(?:Sizes?|Available Sizes?)\s*[:\-]\s*([^\n\r]+)/i);
                    if (sizeM) {
                      product.sizes = sizeM[1].split(/[,/|]/).map(s => s.replace(/\([^)]*\)/g, '').trim()).filter(Boolean);
                    }

                    const imgM = cleanText.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^\s"'<>]*)?/i) ||
                                cleanText.match(/https?:\/\/images[a-z0-9.-]*\.meesho\.com\/[^\s"'<>]+/i);
                    if (imgM) product.imgUrl = imgM[0].trim();
                  }

                  // 2. URL Parsing & Page Scraping
                  if (url && typeof url === 'string') {
                    try {
                      const parsed = new URL(url.trim());
                      const isMeesho = parsed.hostname.includes('meesho');
                      const isAmazon = parsed.hostname.includes('amazon') || parsed.hostname.includes('amzn');
                      const isFlipkart = parsed.hostname.includes('flipkart') || parsed.hostname.includes('fkrt');
                      const isMyntra = parsed.hostname.includes('myntra');
                      const isAjio = parsed.hostname.includes('ajio');

                      let fetchTarget = url.trim();
                      let isAffiliateInvite = false;
                      let extId = '';
                      let pId = '';

                      if (isMeesho) {
                        product.ret = 'Meesho';
                        if (parsed.pathname.includes('/af_invite')) {
                          isAffiliateInvite = true;
                          extId = parsed.searchParams.get('ext_id') || '';
                          pId = parsed.searchParams.get('p_id') || parsed.searchParams.get('product_id') || '';
                          if (extId) {
                            fetchTarget = `https://www.meesho.com/s/p/${extId}`;
                            product.retUrl = fetchTarget;
                          }
                        } else {
                          product.retUrl = parsed.origin + parsed.pathname;
                          const m = parsed.pathname.match(/\/([^/]+)\/p\/([a-zA-Z0-9_-]+)/);
                          if (m && m[1] !== 's' && m[1] !== 'products' && m[1].includes('-') && m[1].length > 3) {
                            if (!product.name) {
                              product.name = m[1].replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()).trim();
                            }
                            if (!product.slug) {
                              product.slug = m[1].toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 65);
                            }
                          }
                        }
                      } else if (isAmazon) {
                        product.ret = 'Amazon';
                        const asinMatch = parsed.pathname.match(/\/(?:dp|gp\/product)\/([a-zA-Z0-9]{10})/i);
                        product.retUrl = asinMatch ? `https://www.amazon.in/dp/${asinMatch[1]}` : (parsed.origin + parsed.pathname);
                        fetchTarget = product.retUrl;
                        const slugMatch = parsed.pathname.match(/\/([^/]+)\/(?:dp|gp\/product)/i);
                        if (slugMatch && slugMatch[1] && slugMatch[1] !== 'gp' && slugMatch[1] !== 'dp' && slugMatch[1].includes('-')) {
                          if (!product.name) product.name = slugMatch[1].replace(/[-_+]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()).trim();
                        }
                      } else if (isFlipkart) {
                        product.ret = 'Flipkart';
                        product.retUrl = parsed.origin + parsed.pathname;
                        fetchTarget = product.retUrl;
                        const m = parsed.pathname.match(/\/([^/]+)\/p\//i);
                        if (m && m[1] && m[1].includes('-')) {
                          if (!product.name) product.name = m[1].replace(/[-_+]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()).trim();
                        }
                      } else if (isMyntra) {
                        product.ret = 'Myntra';
                        product.retUrl = parsed.origin + parsed.pathname;
                        fetchTarget = product.retUrl;
                        const segs = parsed.pathname.split('/').filter(Boolean);
                        if (segs.length >= 2 && !product.name && segs[segs.length - 2].includes('-')) {
                          product.name = segs[segs.length - 2].replace(/[-_+]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()).trim();
                        }
                      } else if (isAjio) {
                        product.ret = 'Ajio';
                        product.retUrl = parsed.origin + parsed.pathname;
                        fetchTarget = product.retUrl;
                        const m = parsed.pathname.match(/\/([^/]+)\/p\//i);
                        if (m && m[1] && m[1].includes('-') && !product.name) {
                          product.name = m[1].replace(/[-_+]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()).trim();
                        }
                      } else {
                        const hostParts = parsed.hostname.replace('www.', '').split('.');
                        let rName = hostParts[0].charAt(0).toUpperCase() + hostParts[0].slice(1);
                        if (rName.toLowerCase() === 'https' || rName.toLowerCase() === 'http') rName = 'Partner Retailer';
                        product.ret = rName;
                        product.retUrl = url.trim();
                      }

                      // Attempt to fetch page HTML
                      const controller = new AbortController();
                      const timeout = setTimeout(() => controller.abort(), 4000);
                      let fetchSuccess = false;
                      try {
                        const response = await fetch(fetchTarget, {
                          signal: controller.signal,
                          headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.9'
                          }
                        });
                        clearTimeout(timeout);

                        if (response.ok) {
                          fetchSuccess = true;
                          const html = await response.text();

                          // Extract og:title
                          const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                                          html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i);
                          if (ogTitle && ogTitle[1] && (!product.name || product.name.includes('Curated'))) {
                            product.name = ogTitle[1].replace(/\|.*$/, '').replace(/ - .*$/, '').trim();
                          }

                          // Extract og:image
                          const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                                        html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
                          if (ogImg && ogImg[1] && !product.imgUrl) {
                            product.imgUrl = ogImg[1].trim();
                          }

                          // Extract og:description
                          const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
                          if (ogDesc && ogDesc[1] && !product.desc) {
                            product.desc = ogDesc[1].trim();
                          }

                          // Extract price & brand from Schema.org JSON-LD
                          const jsonLdMatches = html.match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi);
                          if (jsonLdMatches) {
                            for (const tag of jsonLdMatches) {
                              try {
                                const content = tag.replace(/<\/?script[^>]*>/gi, '');
                                const parsedLd = JSON.parse(content);
                                const item = Array.isArray(parsedLd) ? parsedLd[0] : parsedLd;
                                if (item && (item['@type'] === 'Product' || item.offers)) {
                                  if (item.name && !product.name) product.name = item.name;
                                  if (item.brand) {
                                    const bName = typeof item.brand === 'string' ? item.brand : item.brand.name;
                                    if (bName && typeof bName === 'string' && !['https', 'http'].includes(bName.toLowerCase())) {
                                      product.brand = bName.trim();
                                    }
                                  }
                                  if (item.image && !product.imgUrl) {
                                    product.imgUrl = Array.isArray(item.image) ? item.image[0] : (item.image.url || item.image);
                                  }
                                  const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
                                  if (offers && offers.price && !product.price) {
                                    product.price = Number(offers.price);
                                  }
                                }
                              } catch (_) {}
                            }
                          }
                        }
                      } catch (fetchErr) {
                        clearTimeout(timeout);
                      }

                      // Sanitize any invalid values
                      if (product.brand && (product.brand.toLowerCase() === 'https' || product.brand.toLowerCase() === 'http')) {
                        delete product.brand;
                      }
                      if (product.name && !product.name.includes(' ') && /^[a-z0-9_-]{3,20}$/i.test(product.name)) {
                        delete product.name;
                      }

                      // If page was blocked or details could not be accessed
                      if (!fetchSuccess && !product.name) {
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({
                          success: false,
                          blocked: true,
                          requiresDirectUrl: true,
                          message: "The retailer server blocked automated access. Please paste the direct product URL or copy-paste product details into the form.",
                          retailer: product.ret,
                          extId,
                          pId
                        }));
                        return;
                      }
                    } catch (_) {}
                  }

                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, product }));
                } catch (e: any) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: e?.message }));
                }
              });
              return;
            }
            res.statusCode = 405;
            res.end('Method not allowed');
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
