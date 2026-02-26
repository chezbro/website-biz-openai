import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths.mjs';
import { scrapeLeads } from './scrape.mjs';
import { enrichLeads } from './enrich.mjs';
import { generateWebsiteForLead } from './generate.mjs';
import { sendOutreach } from './outreach.mjs';
import { runDaily, setDailyTarget } from './daily.mjs';

const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');

function loadJobs() { try { return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8')); } catch { return []; } }
function saveJobs(rows) { fs.writeFileSync(JOBS_FILE, JSON.stringify(rows, null, 2)); }

export function createJob(type, payload = {}) {
  const rows = loadJobs();
  const job = { id: crypto.randomUUID(), type, payload, status: 'queued', createdAt: new Date().toISOString(), startedAt: null, finishedAt: null, error: null, result: null };
  rows.unshift(job);
  saveJobs(rows);
  return job;
}

export function getJob(id) { return loadJobs().find((j) => j.id === id) || null; }
export function listJobs(limit = 25) { return loadJobs().slice(0, limit); }

function patchJob(id, patch) {
  const rows = loadJobs();
  const i = rows.findIndex((j) => j.id === id);
  if (i === -1) return null;
  rows[i] = { ...rows[i], ...patch };
  saveJobs(rows);
  return rows[i];
}

export async function processNextJob() {
  const rows = loadJobs();
  const next = rows.find((j) => j.status === 'queued');
  if (!next) return { ok: true, idle: true };

  patchJob(next.id, { status: 'running', startedAt: new Date().toISOString() });

  try {
    let result;
    switch (next.type) {
      case 'scrape':
        result = await scrapeLeads(next.payload);
        break;
      case 'enrich':
        result = await enrichLeads(next.payload.leadsFile);
        break;
      case 'generate-site':
        result = await generateWebsiteForLead(next.payload.leadsFile, Number(next.payload.index));
        break;
      case 'send':
        result = await sendOutreach(next.payload.leadsFile);
        break;
      case 'daily-set':
        result = setDailyTarget(next.payload.query, next.payload.location);
        break;
      case 'daily-run':
        result = await runDaily();
        break;
      default:
        throw new Error(`unknown_job_type:${next.type}`);
    }

    const done = patchJob(next.id, { status: 'done', finishedAt: new Date().toISOString(), result });
    return { ok: true, idle: false, job: done };
  } catch (e) {
    const failed = patchJob(next.id, { status: 'failed', finishedAt: new Date().toISOString(), error: e.message || 'unknown_error' });
    return { ok: false, idle: false, job: failed };
  }
}
