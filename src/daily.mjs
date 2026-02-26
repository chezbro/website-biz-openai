import { DAILY_STATE_FILE, loadJson, saveJson } from './paths.mjs';
import { scrapeLeads } from './scrape.mjs';
import { enrichLeads } from './enrich.mjs';
import { sendOutreach } from './outreach.mjs';

export function setDailyTarget(query, location) {
  const s = loadJson(DAILY_STATE_FILE, { daily_limits: { scrape: 60, generate: 25, email: 25 } });
  s.query = query; s.location = location;
  saveJson(DAILY_STATE_FILE, s);
  return s;
}

export async function runDaily() {
  const today = new Date().toISOString().slice(0,10);
  const s = loadJson(DAILY_STATE_FILE, null);
  if (!s?.query || !s?.location) throw new Error('daily_target_not_set');
  if (s.last_run !== today) {
    s.last_run = today;
    s.leads_scraped_today = 0; s.websites_generated_today = 0; s.emails_sent_today = 0;
  }
  const scrape = await scrapeLeads({ query: s.query, location: s.location, maxResults: s.daily_limits?.scrape || 60 });
  s.leads_scraped_today = scrape.newCount;
  const enrich = await enrichLeads(scrape.outFile);
  const outreach = await sendOutreach(scrape.outFile);
  s.emails_sent_today += outreach.sent;
  saveJson(DAILY_STATE_FILE, s);
  return { scrape, enrich, outreach, state: s };
}
