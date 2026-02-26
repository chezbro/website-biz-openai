import fs from 'fs';
import path from 'path';

export const ROOT = process.cwd();
export const DATA_DIR = path.join(ROOT, 'website-biz');
export const IMAGES_DIR = path.join(DATA_DIR, 'images');
export const SITES_DIR = path.join(DATA_DIR, 'websites');
export const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');
export const OUTREACH_LOG_FILE = path.join(DATA_DIR, 'outreach-log.json');
export const DAILY_STATE_FILE = path.join(DATA_DIR, 'daily-state.json');

export function ensureDirs() {
  for (const p of [DATA_DIR, IMAGES_DIR, SITES_DIR]) fs.mkdirSync(p, { recursive: true });
}

export function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
