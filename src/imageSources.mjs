function absUrl(base, maybe) {
  try { return new URL(maybe, base).toString(); } catch { return null; }
}

function pickImageCandidates(html = '', baseUrl = '') {
  const out = [];
  const add = (u) => { if (u && !out.includes(u)) out.push(u); };

  for (const m of html.matchAll(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/gi)) add(absUrl(baseUrl, m[1]));
  for (const m of html.matchAll(/<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/gi)) add(absUrl(baseUrl, m[1]));
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) add(absUrl(baseUrl, m[1]));

  return out.filter(Boolean).filter((u) => /^https?:\/\//i.test(u));
}

async function urlLoads(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    const ct = r.headers.get('content-type') || '';
    if (r.ok && ct.includes('image')) return true;
  } catch {}
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow' });
    const ct = r.headers.get('content-type') || '';
    return r.ok && ct.includes('image');
  } catch { return false; }
}

async function firstWorking(urls, limit = 8) {
  const picked = [];
  for (const u of urls.slice(0, limit)) {
    if (await urlLoads(u)) picked.push(u);
    if (picked.length >= 4) break;
  }
  return picked;
}

export async function resolveImageSet(lead) {
  const industry = lead.industry || 'business';
  const fallback = {
    heroImage: `https://source.unsplash.com/1600x1100/?${encodeURIComponent(industry)},office,professional`,
    supportImage: `https://source.unsplash.com/1200x900/?${encodeURIComponent(industry)},team,workspace`,
    gallery1: `https://source.unsplash.com/900x700/?${encodeURIComponent(industry)},modern,interior`,
    gallery2: `https://source.unsplash.com/900x700/?${encodeURIComponent(industry)},design,brand`,
  };

  if (!lead.website) return fallback;

  try {
    const res = await fetch(lead.website, { redirect: 'follow' });
    if (!res.ok) return fallback;
    const html = await res.text();
    const candidates = pickImageCandidates(html, lead.website)
      .filter((u) => !u.includes('logo') && !u.includes('icon'));
    const working = await firstWorking(candidates, 12);

    return {
      heroImage: working[0] || fallback.heroImage,
      supportImage: working[1] || working[0] || fallback.supportImage,
      gallery1: working[2] || working[0] || fallback.gallery1,
      gallery2: working[3] || working[1] || fallback.gallery2,
    };
  } catch {
    return fallback;
  }
}
