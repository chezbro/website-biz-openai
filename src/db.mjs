const hasSupabase = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

function headers() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

async function sfetch(path, init = {}) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1${path}`, { ...init, headers: { ...headers(), ...(init.headers || {}) } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`supabase_${res.status}_${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function dbInsertJob(job) {
  if (!hasSupabase()) return null;
  const rows = await sfetch('/website_biz_jobs', { method: 'POST', body: JSON.stringify({
    id: job.id,
    type: job.type,
    payload: job.payload || {},
    status: job.status,
    created_at: job.createdAt,
    started_at: job.startedAt,
    finished_at: job.finishedAt,
    error: job.error,
    result: job.result,
  }) });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function dbPatchJob(id, patch) {
  if (!hasSupabase()) return null;
  const rows = await sfetch(`/website_biz_jobs?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({
    status: patch.status,
    started_at: patch.startedAt,
    finished_at: patch.finishedAt,
    error: patch.error,
    result: patch.result,
  }) });
  return Array.isArray(rows) ? rows[0] : rows;
}

function mapRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    type: r.type,
    payload: r.payload || {},
    status: r.status,
    createdAt: r.created_at,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    error: r.error || null,
    result: r.result || null,
  };
}

export async function dbGetJob(id) {
  if (!hasSupabase()) return null;
  const rows = await sfetch(`/website_biz_jobs?id=eq.${encodeURIComponent(id)}&select=*`);
  return mapRow(Array.isArray(rows) ? rows[0] : rows);
}

export async function dbListJobs(limit = 25) {
  if (!hasSupabase()) return null;
  const rows = await sfetch(`/website_biz_jobs?select=*&order=created_at.desc&limit=${Number(limit)}`);
  return Array.isArray(rows) ? rows.map(mapRow) : [];
}

export async function dbNextQueuedJob() {
  if (!hasSupabase()) return null;
  const rows = await sfetch('/website_biz_jobs?status=eq.queued&select=*&order=created_at.asc&limit=1');
  return mapRow(Array.isArray(rows) ? rows[0] : rows);
}

export { hasSupabase };
