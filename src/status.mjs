import fs from 'fs';
import path from 'path';
import { DATA_DIR, SITES_DIR, OUTREACH_LOG_FILE, TEMPLATES_FILE, DAILY_STATE_FILE, loadJson } from './paths.mjs';
import { ensureTemplates } from './templates.mjs';
import { hasSupabase, dbListLeads, dbListWebsites, dbListOutreach, dbListJobs } from './db.mjs';

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
      const [leadsRows, websitesRaw, outreach] = await Promise.all([
        dbListLeads(300),
        dbListWebsites(1000),
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

      const websitesMap = new Map();
      for (const w of (websitesRaw || [])) {
        const key = w.slug || w.business_name || w.file_path;
        if (!key || websitesMap.has(key)) continue;
        websitesMap.set(key, w);
      }
      const websites = Array.from(websitesMap.values());

      return { leads, websites, outreach: outreach || [], source: 'supabase' };
    } catch {}

    // Fallback: persist/read artifacts from website_biz_jobs when dedicated tables are unavailable.
    try {
      const jobs = await dbListJobs(500);
      const artifactJobs = (jobs || []).filter((j) => String(j.type || '').startsWith('artifact:'));

      const latestLeadsByFile = new Map();
      const websitesMap = new Map();
      const outreach = [];

      for (const j of artifactJobs) {
        const kind = String(j.type).split(':')[1] || '';
        const p = j.payload || {};
        if (kind === 'leads' && p.key) {
          latestLeadsByFile.set(p.key, p.data || {});
        } else if (kind === 'website' && p.data) {
          const w = p.data;
          const key = w.slug || w.business_name || w.file_path || p.key;
          if (key && !websitesMap.has(key)) websitesMap.set(key, w);
        } else if (kind === 'outreach' && p.data?.sample) {
          outreach.push(...p.data.sample);
        }
      }

      const leads = Array.from(latestLeadsByFile.entries()).map(([file, data]) => ({
        file,
        total: Number(data.total || 0),
        sample: Array.isArray(data.sample) ? data.sample.slice(0, limitPerFile).map((r) => ({
          name: r.name,
          industry: r.industry,
          city: r.city,
          email: r.email || null,
          phone: r.phone || null,
          website_url: r.website_url || null,
          enriched: !!r.enriched,
        })) : [],
      }));

      const websites = Array.from(websitesMap.values());
      return { leads, websites, outreach, source: 'supabase_jobs_artifacts' };
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

export async function getWebsiteHtml({ slug, filePath } = {}) {
  if (hasSupabase() && slug) {
    try {
      const jobs = await dbListJobs(1000);
      const hit = (jobs || []).find((j) => j.type === 'artifact:website' && j.payload?.key === slug && j.payload?.data?.html);
      if (hit?.payload?.data?.html) return { html: hit.payload.data.html, source: 'supabase_jobs_artifacts' };
    } catch {}
  }

  const fp = filePath || (slug ? path.join(SITES_DIR, `${slug}.html`) : null);
  if (fp && fs.existsSync(fp)) {
    return { html: fs.readFileSync(fp, 'utf8'), source: 'local_file' };
  }

  throw new Error('website_html_not_found');
}
