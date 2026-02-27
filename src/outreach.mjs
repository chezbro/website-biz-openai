import nodemailer from 'nodemailer';
import crypto from 'crypto';
import path from 'path';
import { loadJson, saveJson, OUTREACH_LOG_FILE } from './paths.mjs';
import { dbUpsertOutreach, dbWriteArtifact } from './db.mjs';
import { ensureTemplates } from './templates.mjs';

const sub = (txt, vars) => Object.entries(vars).reduce((s,[k,v]) => s.replaceAll(`{{${k}}}`, v || ''), txt);

export async function sendOutreach(leadsFile) {
  const leads = loadJson(leadsFile, []);
  const templates = ensureTemplates();
  const template = templates.find((t) => t.is_default) || templates[0];
  const log = loadJson(OUTREACH_LOG_FILE, []);
  const today = new Date().toISOString().slice(0,10);
  const sentToday = log.filter((x) => x.sent_at?.startsWith(today)).length;
  const dailyLimit = Number(process.env.SMTP_DAILY_LIMIT || 25);
  const remaining = Math.max(0, dailyLimit - sentToday);
  const already = new Set(log.map((x) => x.email));
  const eligible = leads.filter((l) => l.email && l.website_url && !already.has(l.email)).slice(0, remaining);

  const tx = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_PORT || '587') === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });

  let sent = 0;
  for (const lead of eligible) {
    const vars = { business_name: lead.name, city: lead.city, industry: lead.industry, website_url: lead.website_url, phone: lead.phone || '', rating: String(lead.rating || ''), reviews: String(lead.reviews || ''), sender_name: process.env.SENDER_NAME || 'Founder' };
    const subject = sub(template.subject, vars);
    const text = sub(template.body, vars);
    const entry = { id: crypto.randomUUID(), email: lead.email, business_name: lead.name, template_id: template.id, sent_at: null, status: 'failed', error: null };
    try { await tx.sendMail({ from: process.env.SMTP_FROM, to: lead.email, subject, text }); entry.status='sent'; entry.sent_at = new Date().toISOString(); sent++; }
    catch (e) { entry.error = e.message; }
    log.push(entry);
  }
  saveJson(OUTREACH_LOG_FILE, log);
  try { await dbUpsertOutreach(log, path.basename(leadsFile)); } catch {}
  try { await dbWriteArtifact('outreach', path.basename(leadsFile), { total: log.length, sample: log.slice(-100) }); } catch {}
  return { sent, attempted: eligible.length, remaining: Math.max(0, remaining - sent) };
}
