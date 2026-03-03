#!/usr/bin/env node
import { execSync } from "node:child_process";

const SCOPE = process.env.VERCEL_SCOPE || "chezbros-projects";
const WINDOW_HOURS = Number(process.env.VERCEL_GUARD_WINDOW_HOURS || 24);
const SOFT_CAP = Number(process.env.VERCEL_GUARD_SOFT_CAP || 85);
const HARD_CAP = Number(process.env.VERCEL_GUARD_HARD_CAP || 95);
const ABS_CAP = Number(process.env.VERCEL_GUARD_ABS_CAP || 100);
const FORCE = String(process.env.VERCEL_GUARD_FORCE || "0") === "1";

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function parseJson(stdout) {
  const i = stdout.indexOf("{");
  if (i < 0) throw new Error(`No JSON found in output: ${stdout.slice(0, 200)}`);
  return JSON.parse(stdout.slice(i));
}

function vercelJson(args) {
  const out = run(`vercel ${args} --format json`);
  return parseJson(out);
}

function countRecentDeploys(projectName, cutoffMs) {
  let count = 0;
  let next = null;

  while (true) {
    const pageArgs = ["list", projectName, "--scope", SCOPE, "--yes"];
    if (next) pageArgs.push("--next", String(next));
    const data = vercelJson(pageArgs.join(" "));
    const deps = Array.isArray(data.deployments) ? data.deployments : [];
    if (!deps.length) break;

    const created = deps.map((d) => Number(d.createdAt || 0));
    count += created.filter((ts) => ts >= cutoffMs).length;

    const oldest = Math.min(...created);
    const nxt = data?.pagination?.next;
    if (!nxt || oldest < cutoffMs) break;
    next = nxt;
  }

  return count;
}

const now = Date.now();
const cutoff = now - WINDOW_HOURS * 60 * 60 * 1000;

const projectsData = vercelJson(`projects ls --scope ${SCOPE}`);
const projects = Array.isArray(projectsData.projects) ? projectsData.projects : [];

const byProject = {};
let total = 0;

for (const p of projects) {
  const name = String(p.name || "");
  if (!name) continue;
  const c = countRecentDeploys(name, cutoff);
  if (c > 0) {
    byProject[name] = c;
    total += c;
  }
}

console.log(`[vercel-guard] ${WINDOW_HOURS}h deployments: ${total}/${ABS_CAP}`);
console.log(`[vercel-guard] Breakdown: ${JSON.stringify(byProject)}`);

if (total >= ABS_CAP) {
  console.error(`[vercel-guard] BLOCKED: reached absolute cap (${total}/${ABS_CAP}).`);
  process.exit(1);
}

if (total >= HARD_CAP && !FORCE) {
  console.error(`[vercel-guard] BLOCKED: above hard cap (${total}/${HARD_CAP}). Set VERCEL_GUARD_FORCE=1 for emergency deploy.`);
  process.exit(1);
}

if (total >= SOFT_CAP) {
  console.warn(`[vercel-guard] WARNING: above soft cap (${total}/${SOFT_CAP}).`);
}

console.log("[vercel-guard] OK to deploy.");
