#!/usr/bin/env node
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureDirs } from './paths.mjs';
import runHandler from '../api/run.mjs';
import workerHandler from '../api/worker.mjs';

const app = express();
const port = Number(process.env.PORT || 8787);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

process.env.WEBSITE_BIZ_DATA_DIR = process.env.WEBSITE_BIZ_DATA_DIR || path.join(root, 'website-biz');
ensureDirs();

app.use(express.json({ limit: '2mb' }));
app.use(express.static(root));

app.post('/api/run', (req, res) => runHandler(req, res));
app.post('/api/worker', (req, res) => workerHandler(req, res));
app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(port, () => {
  console.log(`[server] http://localhost:${port}`);
});
