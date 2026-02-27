import fs from 'fs';
import path from 'path';
import { DATA_DIR, SITES_DIR, OUTREACH_LOG_FILE, TEMPLATES_FILE, DAILY_STATE_FILE, loadJson } from './paths.mjs';
import { ensureTemplates } from './templates.mjs';
import { hasSupabase, dbListLeads, dbListWebsites, dbListOutreach } from './db.mjs';

export function getStatus() {
  const leadsFiles = fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR).filter((f) => f.startsWith('leads-') && f.endsWith('.json')) : [];
  const leadsSummary = leadsFiles.map((f) => {
    const rows = loadJson(path.join(DATA_DIR, f), []);
    return { file: f, total: rows.length, withEmail: rows.filter((x)=>x.email).length, enriched: rows.filter((x)=>x.enriched).length, websites: rows.filter((x)=>x.website_url).length };
  });
  const sites = loadJson(path.join(SITES_DIR, 'index.json'), []);
  const logs = loadJson(OUTREACH_LOG_FILE, []);
  const templates = fs.existsSync(TEMPLATES_FILE) ? loadJson(TEMPLATES_FILE, []) : ensureTemplates();
  const daily = loadJson(DAILY_STATE_FILE, null);
  return { leadsSummary, websites: sites.length, outreachTotal: logs.filter((x)=>x.status==='sent').length, templates: templates.length, defaultTemplate: templates.find((x)=>x.is_default)?.name || null, daily };
}

export async function getHistory(limitPerFile = 20) {
  if (hasSupabase()) {
    try {
      const [leadsRows, websites, outreach] = await Promise.all([
        dbListLeads(300),
        dbListWebsites(300),
        dbListOutreach(300),
      ]);

      const byFile = new Map();
      for (const r of (leadsRows || [])) {
        const file = r.source_file || 'unknown';
        if (!byFile.has(file)) byFile.set(file, []);
        byFile.get(file).push(r);
      }

      const leads = Array.from(byFile.entries()).map(([file, rows]) => ({
        file,
        total: rows.length,
        sample: rows.slice(0, limitPerFile).map((r) => ({
          name: r.name,
          industry: r.industry,
          city: r.city,
          email: r.email || null,
          phone: r.phone || null,
          website_url: r.website_url || null,
          enriched: !!r.enriched,
        })),
      }));

      return { leads, websites: websites || [], outreach: outreach || [], source: 'supabase' };
    } catch {}
  }

  const leadsFiles = fs.existsSync(DATA_DIR)
    ? fs.readdirSync(DATA_DIR).filter((f) => f.startsWith('leads-') && f.endsWith('.json')).sort().reverse()
    : [];

  const leads = leadsFiles.map((file) => {
    const rows = loadJson(path.join(DATA_DIR, file), []);
    return {
      file,
      total: rows.length,
      sample: rows.slice(0, limitPerFile).map((r) => ({
        name: r.name,
        industry: r.industry,
        city: r.city,
        email: r.email || null,
        phone: r.phone || null,
        website_url: r.website_url || null,
        enriched: !!r.enriched,
      })),
    };
  });

  const websites = loadJson(path.join(SITES_DIR, 'index.json'), []);
  const outreach = loadJson(OUTREACH_LOG_FILE, []);

  return { leads, websites, outreach, source: 'local' };
}
