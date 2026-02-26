#!/usr/bin/env node
import { ensureDirs } from './paths.mjs';
import { processNextJob } from './jobs.mjs';

ensureDirs();
const INTERVAL = Number(process.env.WORKER_POLL_MS || 3000);

console.log(`[worker] started (poll ${INTERVAL}ms)`);
for (;;) {
  const r = await processNextJob();
  if (!r.idle) {
    console.log('[worker]', JSON.stringify({ ok: r.ok, jobId: r.job?.id, status: r.job?.status, type: r.job?.type }, null, 2));
  }
  await new Promise((res) => setTimeout(res, INTERVAL));
}
