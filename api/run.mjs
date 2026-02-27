import { ensureDirs } from '../src/paths.mjs';
import { checkEnv } from '../src/env.mjs';
import { listTemplates, addTemplate, setDefaultTemplate, deleteTemplate } from '../src/templates.mjs';
import { scrapeLeads } from '../src/scrape.mjs';
import { enrichLeads } from '../src/enrich.mjs';
import { generateWebsiteForLead } from '../src/generate.mjs';
import { sendOutreach } from '../src/outreach.mjs';
import { getStatus, getHistory } from '../src/status.mjs';
import { setDailyTarget, runDaily } from '../src/daily.mjs';
import { createJob, getJob, listJobs } from '../src/jobs.mjs';

export default async function handler(req, res) {
  process.env.WEBSITE_BIZ_DATA_DIR = process.env.WEBSITE_BIZ_DATA_DIR || '/tmp/website-biz';
  ensureDirs();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  const { action, params = {}, async: isAsync = false } = req.body || {};
  try {
    if (action === 'job-get') {
      return res.status(200).json({ ok: true, result: await getJob(params.id) });
    }
    if (action === 'job-list') {
      return res.status(200).json({ ok: true, result: await listJobs(Number(params.limit || 25)) });
    }

    const queueable = new Set(['scrape','enrich','generate-site','send','daily-set','daily-run']);
    if (isAsync && queueable.has(action)) {
      const job = await createJob(action, params);
      return res.status(200).json({ ok: true, queued: true, job });
    }

    // In Vercel serverless, free browser scraping is unreliable due missing system libs.
    // Auto-queue scrape jobs so they can be processed by a local/remote worker runtime.
    if (action === 'scrape' && process.env.VERCEL) {
      const job = await createJob('scrape', params);
      return res.status(200).json({
        ok: true,
        queued: true,
        job,
        note: 'Scrape is queued on hosted runtime. Process it with local worker (`npm run worker`) for Playwright compatibility.'
      });
    }

    let result;
    switch (action) {
      case 'check': result = checkEnv(); break;
      case 'status': result = getStatus(); break;
      case 'history': result = await getHistory(Number(params.limitPerFile || 20)); break;
      case 'scrape': result = await scrapeLeads({ query: params.query, location: params.location, maxResults: Number(params.maxResults || 60) }); break;
      case 'enrich': result = await enrichLeads(params.leadsFile); break;
      case 'generate-site': result = await generateWebsiteForLead(params.leadsFile, Number(params.index)); break;
      case 'send': result = await sendOutreach(params.leadsFile); break;
      case 'template-list': result = listTemplates(); break;
      case 'template-add': addTemplate(params.name, params.subject, params.body); result = { ok: true }; break;
      case 'template-default': setDefaultTemplate(params.name); result = { ok: true }; break;
      case 'template-delete': deleteTemplate(params.name); result = { ok: true }; break;
      case 'daily-set': result = setDailyTarget(params.query, params.location); break;
      case 'daily-run': result = await runDaily(); break;
      default: return res.status(400).json({ ok: false, error: 'unknown_action' });
    }
    return res.status(200).json({ ok: true, result });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'unknown_error' });
  }
}
