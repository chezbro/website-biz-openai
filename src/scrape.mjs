import path from 'path';
import { DATA_DIR, loadJson, saveJson } from './paths.mjs';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function scrapeLeads({ query, location, maxResults = 60 }) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const slug = `${query}-${location}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const outFile = path.join(DATA_DIR, `leads-${slug}.json`);
  const existing = loadJson(outFile, []);
  const existingNames = new Set(existing.map((x) => x.name));
  const leads = [...existing];

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

  let token = null;
  let page = 0;
  while (leads.length < maxResults) {
    if (page > 0) await delay(2500);
    const data = await fetchPage(token);
    if (!['OK', 'ZERO_RESULTS'].includes(data.status)) break;
    for (const place of (data.results || [])) {
      if (leads.length >= maxResults) break;
      if (existingNames.has(place.name)) continue;
      const d = await details(place.place_id);
      await delay(300);
      const name = d.name || place.name;
      leads.push({
        id: place.place_id,
        name,
        address: d.formatted_address || place.formatted_address || '',
        phone: d.formatted_phone_number || '',
        website: d.website || '',
        rating: d.rating || place.rating || null,
        reviews: d.user_ratings_total || place.user_ratings_total || 0,
        industry: query,
        city: location,
        slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-${location.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,
        email: '', email_status: 'pending', socials: {}, website_url: '', enriched: false
      });
      existingNames.add(name);
    }
    token = data.next_page_token;
    if (!token) break;
    page++;
  }

  saveJson(outFile, leads);
  return { outFile, count: leads.length, newCount: leads.length - existing.length };
}
