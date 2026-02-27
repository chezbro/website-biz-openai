import path from 'path';
import { DATA_DIR, loadJson, saveJson } from './paths.mjs';
import { dbUpsertLeads } from './db.mjs';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function toLead({ name, address = '', phone = '', website = '', rating = null, reviews = 0, query, location, id }) {
  return {
    id: id || `${name}-${address}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    address,
    phone,
    website,
    rating,
    reviews,
    industry: query,
    city: location,
    slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${location.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    email: '',
    email_status: 'pending',
    socials: {},
    website_url: '',
    enriched: false,
  };
}

async function scrapeViaGooglePlacesApi({ query, location, maxResults }) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return [];

  async function fetchPage(pageToken) {
    const u = pageToken
      ? `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${pageToken}&key=${key}`
      : `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' in ' + location)}&key=${key}`;
    return fetch(u).then((r) => r.json());
  }

  async function details(placeId) {
    const u = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_phone_number,website,formatted_address,rating,user_ratings_total&key=${key}`;
    const j = await fetch(u).then((r) => r.json());
    return j.result || {};
  }

  const rows = [];
  let token = null;
  let page = 0;
  while (rows.length < maxResults) {
    if (page > 0) await delay(2500);
    const data = await fetchPage(token);
    if (!['OK', 'ZERO_RESULTS'].includes(data.status)) break;
    for (const place of (data.results || [])) {
      if (rows.length >= maxResults) break;
      const d = await details(place.place_id);
      rows.push(toLead({
        id: place.place_id,
        name: d.name || place.name,
        address: d.formatted_address || place.formatted_address || '',
        phone: d.formatted_phone_number || '',
        website: d.website || '',
        rating: d.rating || place.rating || null,
        reviews: d.user_ratings_total || place.user_ratings_total || 0,
        query,
        location,
      }));
      await delay(250);
    }
    token = data.next_page_token;
    if (!token) break;
    page++;
  }
  return rows;
}

async function scrapeViaPlaywright({ query, location, maxResults }) {
  const { chromium } = await import('playwright');

  let launchOptions = { headless: true };
  if (process.env.VERCEL) {
    const chromiumPack = await import('@sparticuz/chromium');
    const executablePath = await chromiumPack.default.executablePath();
    const hardenedArgs = (chromiumPack.default.args || []).filter((a) => a !== '--single-process');
    launchOptions = {
      headless: true,
      executablePath,
      args: hardenedArgs,
      chromiumSandbox: false,
    };
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'en-US',
  });
  const page = await context.newPage();

  try {
    const url = `https://www.google.com/maps/search/${encodeURIComponent(`${query} in ${location}`)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3500);

    for (const txt of ['Reject all', 'I agree', 'Accept all']) {
      const btn = page.getByRole('button', { name: txt });
      if (await btn.count()) {
        try { await btn.first().click({ timeout: 1200 }); } catch {}
      }
    }

    const seen = new Set();
    const candidates = [];

    for (let i = 0; i < 14 && candidates.length < maxResults * 3; i++) {
      const rows = await page.$$eval('a.hfpxzc, a[href*="/maps/place/"]', (els) =>
        els.map((el) => ({
          href: el.getAttribute('href') || '',
          name: (el.getAttribute('aria-label') || el.textContent || '').trim(),
        }))
      );

      for (const r of rows) {
        if (!r.href || !r.href.includes('/maps/place/')) continue;
        const key = `${r.name}|${r.href}`;
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push(r);
      }

      const feed = page.locator('div[role="feed"]').first();
      if (await feed.count()) {
        await feed.evaluate((el) => { el.scrollBy(0, 1800); });
      } else {
        await page.mouse.wheel(0, 1800);
      }
      await page.waitForTimeout(1000 + Math.floor(Math.random() * 500));
    }

    const collected = new Map();
    for (const c of candidates.slice(0, maxResults * 2)) {
      if (collected.size >= maxResults) break;
      const detail = await context.newPage();
      try {
        await detail.goto(c.href, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await detail.waitForTimeout(1400);
        const data = await detail.evaluate(() => {
          const txt = (sel) => document.querySelector(sel)?.textContent?.trim() || '';
          const title = txt('h1');

          const addr = document.querySelector('button[data-item-id="address"] .fontBodyMedium, button[data-item-id="address"]')?.textContent?.trim() || '';
          const phone = document.querySelector('button[data-item-id^="phone"] .fontBodyMedium, button[data-item-id^="phone"]')?.textContent?.trim() || '';
          const website = document.querySelector('a[data-item-id="authority"]')?.getAttribute('href') || '';

          const ratingNode = document.querySelector('div[role="img"][aria-label*="stars"], div[role="img"][aria-label*="star"]');
          const ratingRaw = ratingNode?.getAttribute('aria-label') || '';
          const ratingMatch = ratingRaw.match(/([0-9]+\.?[0-9]*)/);
          const reviewsMatch = ratingRaw.match(/([0-9,]+)\s*reviews?/i);

          return {
            name: title,
            address: addr,
            phone,
            website,
            rating: ratingMatch ? Number(ratingMatch[1]) : null,
            reviews: reviewsMatch ? Number(reviewsMatch[1].replace(/,/g, '')) : 0,
          };
        });

        const name = data.name || c.name || '';
        if (!name) continue;
        const dedupe = `${name}|${data.address || ''}`;
        if (collected.has(dedupe)) continue;
        collected.set(dedupe, toLead({ ...data, name, query, location, id: c.href }));
      } catch {
        // ignore single-detail failures
      } finally {
        await detail.close();
      }
      await page.waitForTimeout(250 + Math.floor(Math.random() * 250));
    }

    return Array.from(collected.values()).slice(0, maxResults);
  } finally {
    await context.close();
    await browser.close();
  }
}

export async function scrapeLeads({ query, location, maxResults = 60 }) {
  const slug = `${query}-${location}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const outFile = path.join(DATA_DIR, `leads-${slug}.json`);
  const existing = loadJson(outFile, []);
  const existingKeys = new Set(existing.map((x) => `${x.name}|${x.address}`));

  const forceFree = String(process.env.FREE_MAPS_SCRAPER || 'true').toLowerCase() === 'true';
  let scraped = [];

  if (!forceFree && process.env.GOOGLE_PLACES_API_KEY) {
    scraped = await scrapeViaGooglePlacesApi({ query, location, maxResults });
  } else {
    scraped = await scrapeViaPlaywright({ query, location, maxResults });
  }

  const merged = [...existing];
  for (const row of scraped) {
    const k = `${row.name}|${row.address}`;
    if (existingKeys.has(k)) continue;
    merged.push(row);
    existingKeys.add(k);
  }

  saveJson(outFile, merged);
  try { await dbUpsertLeads(path.basename(outFile), merged); } catch {}
  return {
    outFile,
    count: merged.length,
    newCount: merged.length - existing.length,
    source: !forceFree && process.env.GOOGLE_PLACES_API_KEY ? 'google_places_api' : 'playwright_maps_scraper',
  };
}
