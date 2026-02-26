import path from 'path';
import { DATA_DIR, loadJson, saveJson } from './paths.mjs';

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
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    const url = `https://www.google.com/maps/search/${encodeURIComponent(`${query} in ${location}`)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);

    // Dismiss cookie dialogs when present
    for (const txt of ['Reject all', 'I agree', 'Accept all']) {
      const btn = page.getByRole('button', { name: txt });
      if (await btn.count()) {
        try { await btn.first().click({ timeout: 1000 }); } catch {}
      }
    }

    const collected = new Map();

    for (let i = 0; i < 20 && collected.size < maxResults; i++) {
      const cards = page.locator('a[href*="/maps/place/"]');
      const count = await cards.count();

      for (let c = 0; c < count && collected.size < maxResults; c++) {
        const card = cards.nth(c);
        const href = (await card.getAttribute('href')) || '';
        const name = ((await card.textContent()) || '').trim();
        if (!name || collected.has(`${name}|${href}`)) continue;

        try {
          await card.click({ timeout: 3000 });
          await page.waitForTimeout(1200 + Math.floor(Math.random() * 600));
        } catch {
          continue;
        }

        const data = await page.evaluate(() => {
          const txt = (sel) => document.querySelector(sel)?.textContent?.trim() || '';
          const allButtons = Array.from(document.querySelectorAll('button, a')).map((el) => (el.textContent || '').trim());
          const phone = allButtons.find((t) => /^\+?[0-9().\-\s]{7,}$/.test(t)) || '';
          const website = (document.querySelector('a[data-item-id="authority"]')?.getAttribute('href')) || '';
          const ratingRaw = txt('div[role="img"]');
          const ratingMatch = ratingRaw.match(/([0-9]+\.?[0-9]*)/);
          const reviewsMatch = ratingRaw.match(/([0-9,]+)\s*reviews?/i);
          const title = txt('h1');
          const addrCandidates = Array.from(document.querySelectorAll('button, div')).map((n) => (n.textContent || '').trim());
          const address = addrCandidates.find((t) => /\d+\s+.*(St|Street|Ave|Avenue|Rd|Road|Blvd|Drive|Dr|Ln|Way|Ct|Suite|Ste)/i.test(t)) || '';
          return {
            name: title,
            phone,
            website,
            address,
            rating: ratingMatch ? Number(ratingMatch[1]) : null,
            reviews: reviewsMatch ? Number(reviewsMatch[1].replace(/,/g, '')) : 0,
          };
        });

        const finalName = data.name || name;
        if (!finalName) continue;
        const key = `${finalName}|${data.address}`;
        collected.set(key, toLead({ ...data, name: finalName, query, location, id: href || key }));
      }

      await page.mouse.wheel(0, 2200);
      await page.waitForTimeout(900 + Math.floor(Math.random() * 500));
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
    if (process.env.VERCEL) {
      throw new Error('free_maps_scraper_requires_local_runtime: run scraper via local CLI/worker for Playwright support');
    }
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
  return {
    outFile,
    count: merged.length,
    newCount: merged.length - existing.length,
    source: !forceFree && process.env.GOOGLE_PLACES_API_KEY ? 'google_places_api' : 'playwright_maps_scraper',
  };
}
