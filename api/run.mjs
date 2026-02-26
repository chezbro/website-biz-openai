import { ensureDirs } from '../src/paths.mjs';
import { checkEnv } from '../src/env.mjs';
import { listTemplates, addTemplate, setDefaultTemplate, deleteTemplate } from '../src/templates.mjs';
import { scrapeLeads } from '../src/scrape.mjs';
import { enrichLeads } from '../src/enrich.mjs';
import { generateWebsiteForLead } from '../src/generate.mjs';
import { sendOutreach } from '../src/outreach.mjs';
import { getStatus } from '../src/status.mjs';
import { setDailyTarget, runDaily } from '../src/daily.mjs';

export default async function handler(req, res) {
  process.env.WEBSITE_BIZ_DATA_DIR = process.env.WEBSITE_BIZ_DATA_DIR || '/tmp/website-biz';
  ensureDirs();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  const { action, params = {} } = req.body || {};
  try {
    let result;
    switch (action) {
      case 'check': result = checkEnv(); break;
      case 'status': result = getStatus(); break;
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
