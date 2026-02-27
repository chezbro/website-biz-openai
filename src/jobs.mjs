import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths.mjs';
import { scrapeLeads } from './scrape.mjs';
import { enrichLeads } from './enrich.mjs';
import { generateWebsiteForLead } from './generate.mjs';
import { sendOutreach } from './outreach.mjs';
import { runDaily, setDailyTarget } from './daily.mjs';
import { hasSupabase, dbInsertJob, dbGetJob, dbListJobs, dbNextQueuedJob, dbPatchJob } from './db.mjs';

const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');

function loadJobs() { try { return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8')); } catch { return []; } }
function saveJobs(rows) { fs.writeFileSync(JOBS_FILE, JSON.stringify(rows, null, 2)); }

function mapJob(job) {
  return {
    id: job.id,
    type: job.type,
    payload: job.payload || {},
    status: job.status,
    createdAt: job.createdAt || new Date().toISOString(),
    startedAt: job.startedAt || null,
    finishedAt: job.finishedAt || null,
    error: job.error || null,
    result: job.result || null,
  };
}

export async function createJob(type, payload = {}) {
  const job = mapJob({ id: crypto.randomUUID(), type, payload, status: 'queued' });
  if (hasSupabase()) {
    try { await dbInsertJob(job); return job; } catch {}
  }
  const rows = loadJobs();
  rows.unshift(job);
  saveJobs(rows);
  return job;
}

export async function getJob(id) {
  if (hasSupabase()) {
    try { const row = await dbGetJob(id); if (row) return row; } catch {}
  }
  return loadJobs().find((j) => j.id === id) || null;
}

export async function listJobs(limit = 25) {
  if (hasSupabase()) {
    try { const rows = await dbListJobs(limit); if (rows) return rows; } catch {}
  }
  return loadJobs().slice(0, limit);
}

async function patchJob(id, patch) {
  if (hasSupabase()) {
    try {
      const next = await dbPatchJob(id, patch);
      if (next) return mapJob({
        id: next.id,
        type: next.type,
        payload: next.payload,
        status: next.status,
        createdAt: next.created_at,
        startedAt: next.started_at,
        finishedAt: next.finished_at,
        error: next.error,
        result: next.result,
      });
    } catch {}
  }
  const rows = loadJobs();
  const i = rows.findIndex((j) => j.id === id);
  if (i === -1) return null;
  rows[i] = { ...rows[i], ...patch };
  saveJobs(rows);
  return rows[i];
}

async function nextQueued() {
  if (hasSupabase()) {
    try { const row = await dbNextQueuedJob(); if (row) return row; } catch {}
  }
  return loadJobs().find((j) => j.status === 'queued') || null;
}

export async function processNextJob() {
  const next = await nextQueued();
  if (!next) return { ok: true, idle: true };

  await patchJob(next.id, { status: 'running', startedAt: new Date().toISOString() });

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
        result = await generateWebsiteForLead(next.payload.leadsFile, Number(next.payload.index), next.payload.templateStyle || 'neo-glass', next.payload.forceRegenerate !== false);
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

    const done = await patchJob(next.id, { status: 'done', finishedAt: new Date().toISOString(), result });
    return { ok: true, idle: false, job: done };
  } catch (e) {
    const failed = await patchJob(next.id, { status: 'failed', finishedAt: new Date().toISOString(), error: e.message || 'unknown_error' });
    return { ok: false, idle: false, job: failed };
  }
}
