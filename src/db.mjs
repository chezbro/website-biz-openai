import crypto from 'crypto';

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

export async function dbUpsertLeads(sourceFile, leads = []) {
  if (!hasSupabase() || !Array.isArray(leads) || !leads.length) return null;
  const rows = leads.map((l) => ({
    source_file: sourceFile,
    lead_key: `${l.name || ''}|${l.address || ''}`,
    name: l.name || '',
    industry: l.industry || null,
    city: l.city || null,
    address: l.address || null,
    phone: l.phone || null,
    email: l.email || null,
    email_status: l.email_status || null,
    website: l.website || null,
    website_url: l.website_url || null,
    rating: l.rating ?? null,
    reviews: Number(l.reviews || 0),
    enriched: !!l.enriched,
    socials: l.socials || {},
    raw: l,
    updated_at: new Date().toISOString(),
  }));
  return sfetch('/website_biz_leads?on_conflict=source_file,lead_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
}

export async function dbUpsertWebsite(row) {
  if (!hasSupabase() || !row?.slug) return null;
  return sfetch('/website_biz_websites?on_conflict=slug', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{
      slug: row.slug,
      source_file: row.source_file || null,
      business_name: row.business_name || null,
      city: row.city || null,
      industry: row.industry || null,
      file_path: row.file_path || null,
      created_at: row.created_at || new Date().toISOString(),
      raw: row.raw || row,
    }]),
  });
}

export async function dbListLeads(limit = 200) {
  if (!hasSupabase()) return null;
  return sfetch(`/website_biz_leads?select=*&order=updated_at.desc&limit=${Number(limit)}`);
}

export async function dbListWebsites(limit = 200) {
  if (!hasSupabase()) return null;
  return sfetch(`/website_biz_websites?select=*&order=created_at.desc&limit=${Number(limit)}`);
}

export async function dbListOutreach(limit = 200) {
  if (!hasSupabase()) return null;
  return sfetch(`/website_biz_outreach?select=*&order=created_at.desc&limit=${Number(limit)}`);
}

export async function dbWriteArtifact(kind, key, data) {
  if (!hasSupabase()) return null;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  return dbInsertJob({
    id,
    type: `artifact:${kind}`,
    payload: { key, data },
    status: 'done',
    createdAt: now,
    startedAt: now,
    finishedAt: now,
    error: null,
    result: { ok: true },
  });
}

export async function dbUpsertOutreach(entries = [], sourceFile = null) {
  if (!hasSupabase() || !Array.isArray(entries) || !entries.length) return null;
  const rows = entries.map((e) => ({
    id: e.id,
    source_file: sourceFile,
    email: e.email || null,
    business_name: e.business_name || null,
    template_id: e.template_id || null,
    sent_at: e.sent_at || null,
    status: e.status || null,
    error: e.error || null,
    raw: e,
  }));
  return sfetch('/website_biz_outreach?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
}

export { hasSupabase };
