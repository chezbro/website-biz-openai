import { ensureDirs } from '../src/paths.mjs';
import { processNextJob } from '../src/jobs.mjs';

export default async function handler(req, res) {
  process.env.WEBSITE_BIZ_DATA_DIR = process.env.WEBSITE_BIZ_DATA_DIR || '/tmp/website-biz';
  ensureDirs();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  const token = req.headers['x-worker-token'] || req.query?.token;
  if (process.env.WORKER_TOKEN && token !== process.env.WORKER_TOKEN) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  const result = await processNextJob();
  return res.status(200).json(result);
}
