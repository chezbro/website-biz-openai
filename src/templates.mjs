import crypto from 'crypto';
import { TEMPLATES_FILE, loadJson, saveJson } from './paths.mjs';

export function ensureTemplates() {
  const templates = loadJson(TEMPLATES_FILE, null);
  if (templates) return templates;
  const seeded = [{
    id: 'default',
    name: 'Cold intro',
    subject: 'I built something for {{business_name}}',
    body: 'Hey,\n\nI noticed {{business_name}} in {{city}} could use a stronger web presence.\n\nI put together a free preview — no commitment:\n{{website_url}}\n\nIf you like it, I can get it live on a real domain for you.\n\nBest,\n{{sender_name}}',
    is_default: true,
    created_at: new Date().toISOString()
  }];
  saveJson(TEMPLATES_FILE, seeded);
  return seeded;
}

export function listTemplates() { return ensureTemplates(); }

export function addTemplate(name, subject, body) {
  const rows = ensureTemplates();
  rows.push({ id: crypto.randomUUID(), name, subject, body, is_default: false, created_at: new Date().toISOString() });
  saveJson(TEMPLATES_FILE, rows);
}

export function setDefaultTemplate(name) {
  const rows = ensureTemplates();
  let found = false;
  for (const r of rows) {
    r.is_default = r.name.toLowerCase() === name.toLowerCase();
    if (r.is_default) found = true;
  }
  if (!found) throw new Error(`template_not_found: ${name}`);
  saveJson(TEMPLATES_FILE, rows);
}

export function deleteTemplate(name) {
  const rows = ensureTemplates();
  const filtered = rows.filter((r) => r.name.toLowerCase() !== name.toLowerCase());
  if (!filtered.length) throw new Error('cannot_delete_last_template');
  if (!filtered.some((x) => x.is_default)) filtered[0].is_default = true;
  saveJson(TEMPLATES_FILE, filtered);
}
