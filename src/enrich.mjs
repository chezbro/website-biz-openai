import path from 'path';
import { loadJson, saveJson } from './paths.mjs';
import { dbUpsertLeads, dbWriteArtifact } from './db.mjs';
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, timeout = 8000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try { const r = await fetch(url, { signal: c.signal, headers: { 'User-Agent': 'Mozilla/5.0' } }); clearTimeout(t); return r.ok ? await r.text() : ''; }
  catch { clearTimeout(t); return ''; }
}

function extractEmails(html='') {
  const mailto = [...html.matchAll(/mailto:([^\s"'<>?#,]+)/gi)].map((m) => m[1].toLowerCase());
  const plain = [...html.matchAll(/\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g)].map((m) => m[0].toLowerCase());
  return [...new Set([...mailto, ...plain])].filter((e) => !e.includes('example.') && !e.includes('.png') && !e.includes('.jpg'));
}

function extractSocials(html='') {
  const pats = { instagram:/instagram\.com\/([\w.]+)/i, facebook:/facebook\.com\/([\w.]+)/i, linkedin:/linkedin\.com\/(?:company|in)\/([\w-]+)/i, tiktok:/tiktok\.com\/@([\w.]+)/i };
  const s = {};
  for (const [k, re] of Object.entries(pats)) {
    const m = html.match(re); if (m?.[1]) s[k] = `https://${k}.com/${m[1]}`;
  }
  return s;
}

export async function enrichLeads(leadsFile) {
  const leads = loadJson(leadsFile, []);
  let touched = 0;
  for (const lead of leads) {
    if (lead.enriched && lead.email_status !== 'pending') continue;
    touched++;
    let html = '';
    if (lead.website) html = await fetchText(lead.website);
    const emails = extractEmails(html);
    lead.email = emails[0] || '';
    lead.email_secondary = emails[1] || '';
    lead.email_status = emails.length ? 'scraped' : 'not_found';
    lead.socials = { ...(lead.socials || {}), ...extractSocials(html) };
    lead.enriched = true;
    await delay(300);
  }
  saveJson(leadsFile, leads);
  try { await dbUpsertLeads(path.basename(leadsFile), leads); } catch {}
  try { await dbWriteArtifact('leads', path.basename(leadsFile), { total: leads.length, sample: leads.slice(0, 50) }); } catch {}
  return { total: leads.length, processed: touched, withEmail: leads.filter((x) => x.email).length };
}
