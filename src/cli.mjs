#!/usr/bin/env node
import { ensureDirs } from './paths.mjs';
import { checkEnv } from './env.mjs';
import { listTemplates, addTemplate, setDefaultTemplate, deleteTemplate } from './templates.mjs';
import { scrapeLeads } from './scrape.mjs';
import { enrichLeads } from './enrich.mjs';
import { generateWebsiteForLead } from './generate.mjs';
import { sendOutreach } from './outreach.mjs';
import { getStatus } from './status.mjs';
import { setDailyTarget, runDaily } from './daily.mjs';

ensureDirs();
const [,, cmd, ...args] = process.argv;

try {
  if (cmd === 'check') {
    const r = checkEnv();
    if (!r.ok) { console.log('MISSING:', r.missing.join(', ')); process.exit(1); }
    console.log('All required keys present.');
  } else if (cmd === 'scrape') {
    const [query, ...loc] = args;
    const location = loc.join(' ');
    const r = await scrapeLeads({ query, location, maxResults: Number(process.env.MAX_RESULTS || 60) });
    console.log(JSON.stringify(r, null, 2));
  } else if (cmd === 'enrich') {
    const [leadsFile] = args;
    console.log(JSON.stringify(await enrichLeads(leadsFile), null, 2));
  } else if (cmd === 'generate-site') {
    const [leadsFile, index] = args;
    console.log(JSON.stringify(await generateWebsiteForLead(leadsFile, Number(index)), null, 2));
  } else if (cmd === 'send') {
    const [leadsFile] = args;
    console.log(JSON.stringify(await sendOutreach(leadsFile), null, 2));
  } else if (cmd === 'template-list') {
    console.log(JSON.stringify(listTemplates(), null, 2));
  } else if (cmd === 'template-add') {
    const [name, subject, body] = args;
    addTemplate(name, subject, body); console.log('ok');
  } else if (cmd === 'template-default') {
    const [name] = args; setDefaultTemplate(name); console.log('ok');
  } else if (cmd === 'template-delete') {
    const [name] = args; deleteTemplate(name); console.log('ok');
  } else if (cmd === 'daily-set') {
    const [query, ...loc] = args; console.log(JSON.stringify(setDailyTarget(query, loc.join(' ')), null, 2));
  } else if (cmd === 'daily-run') {
    console.log(JSON.stringify(await runDaily(), null, 2));
  } else if (cmd === 'status') {
    console.log(JSON.stringify(getStatus(), null, 2));
  } else {
    console.log('Commands: check | scrape <industry> <city..> | enrich <leadsFile> | generate-site <leadsFile> <index> | send <leadsFile> | template-list | template-add <name> <subject> <body> | template-default <name> | template-delete <name> | daily-set <industry> <city..> | daily-run | status');
    process.exit(1);
  }
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
}
