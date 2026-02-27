function esc(v = '') {
  return String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function leadVars(lead) {
  const industry = lead.industry || 'local services';
  const o = lead.imageOverrides || {};
  return {
    name: esc(lead.name || 'Local Business'),
    city: esc(lead.city || 'Your City'),
    phone: esc(lead.phone || '(000) 000-0000'),
    email: esc(lead.email || 'hello@example.com'),
    address: esc(lead.address || 'Serving your area'),
    rating: esc(String(lead.rating || '4.9')),
    reviews: esc(String(lead.reviews || '120')),
    industry: esc(industry),
    service1: esc(`Consultation & strategy`),
    service2: esc(`${industry} execution`),
    service3: esc(`Priority support`),
    heroImage: o.heroImage || `https://source.unsplash.com/1600x1100/?${encodeURIComponent(industry)},office,professional`,
    supportImage: o.supportImage || `https://source.unsplash.com/1200x900/?${encodeURIComponent(industry)},team,workspace`,
    gallery1: o.gallery1 || `https://source.unsplash.com/900x700/?${encodeURIComponent(industry)},modern,interior`,
    gallery2: o.gallery2 || `https://source.unsplash.com/900x700/?${encodeURIComponent(industry)},design,brand`,
  };
}

function neoGlass(v) {
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${v.name} — ${v.city}</title><style>
:root{--bg:#070b16;--card:rgba(17,28,52,.58);--stroke:rgba(173,198,255,.23);--text:#e8f0ff;--muted:#a9bcde;--accent:#7ee0ff;--accent2:#92f6cc}
*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui;background:radial-gradient(1200px 800px at 10% -20%,#1f3f8a 0%,transparent 55%),radial-gradient(1000px 700px at 100% 0,#0f6f7c 0%,transparent 45%),var(--bg);color:var(--text)}
.wrap{max-width:1140px;margin:0 auto;padding:24px}.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:18px;align-items:stretch}.panel{background:var(--card);backdrop-filter:blur(14px);border:1px solid var(--stroke);border-radius:22px;padding:28px}.k{display:inline-block;border:1px solid var(--stroke);border-radius:999px;padding:5px 10px;color:var(--muted);font-size:12px}
h1{font-size:clamp(2rem,4vw,3.4rem);line-height:1.04;margin:14px 0}.muted{color:var(--muted)}.cta{display:inline-block;margin-top:14px;padding:12px 16px;border-radius:12px;background:linear-gradient(120deg,var(--accent),var(--accent2));color:#032626;text-decoration:none;font-weight:700}
.heroimg{border-radius:20px;overflow:hidden;border:1px solid var(--stroke)}.heroimg img{width:100%;height:100%;min-height:360px;object-fit:cover;display:block}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:16px}.card{background:var(--card);border:1px solid var(--stroke);border-radius:16px;padding:16px}.gallery{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.gallery img{width:100%;height:220px;object-fit:cover;border-radius:14px;border:1px solid var(--stroke)}
@media (max-width:900px){.hero{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.gallery{grid-template-columns:1fr}}
</style></head><body><div class="wrap"><section class="hero"><div class="panel"><span class="k">2026 Signature Experience</span><h1>${v.name}</h1><p class="muted">Premium ${v.industry} in ${v.city}. Frictionless process. White-glove results.</p><div class="grid"><div class="card"><strong>${v.rating} ★</strong><div class="muted">Client rating</div></div><div class="card"><strong>${v.reviews}+</strong><div class="muted">Verified reviews</div></div><div class="card"><strong>24/7</strong><div class="muted">Fast response</div></div></div><a class="cta" href="tel:${v.phone}">Call ${v.phone}</a></div><div class="heroimg"><img src="${v.heroImage}" alt="${v.name}"/></div></section><section class="panel" style="margin-top:14px"><h2>Services</h2><div class="grid"><div class="card"><strong>${v.service1}</strong></div><div class="card"><strong>${v.service2}</strong></div><div class="card"><strong>${v.service3}</strong></div></div><div class="gallery"><img src="${v.gallery1}" alt="work sample"/><img src="${v.gallery2}" alt="work sample"/></div></section><section class="panel" style="margin-top:14px"><h2>Contact</h2><p class="muted">${v.address}<br/>${v.email}</p></section></div></body></html>`;
}

function minimalLuxe(v) {
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${v.name}</title><style>
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui;color:#0f172a;background:#f7f8fb}.wrap{max-width:1100px;margin:0 auto;padding:20px}
.top{display:grid;grid-template-columns:1fr 1fr;gap:16px}.blk{background:#fff;border:1px solid #e7eaf1;border-radius:18px;padding:24px}h1{font-size:clamp(2rem,5vw,3.5rem);margin:10px 0}.btn{display:inline-block;background:#0f172a;color:#fff;padding:11px 14px;border-radius:10px;text-decoration:none;font-weight:700}.muted{color:#51607a}
.band{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px}.stat{background:#111827;color:#f7fbff;border-radius:14px;padding:14px}.hero{border-radius:18px;overflow:hidden}.hero img{width:100%;height:100%;min-height:420px;object-fit:cover}
.split{display:grid;grid-template-columns:1.1fr .9fr;gap:14px;margin-top:14px}.support{width:100%;height:100%;min-height:300px;object-fit:cover;border-radius:14px}
@media(max-width:900px){.top,.split{grid-template-columns:1fr}.band{grid-template-columns:1fr}}
</style></head><body><div class="wrap"><section class="top"><div class="blk"><div class="muted">${v.city} · ${v.industry}</div><h1>${v.name}</h1><p class="muted">Elegant, conversion-focused experience designed for trust and clarity.</p><a class="btn" href="tel:${v.phone}">Book a Call</a><div class="band"><div class="stat">${v.rating}★<div class="muted">Rating</div></div><div class="stat">${v.reviews}+<div class="muted">Reviews</div></div><div class="stat">Same-day<div class="muted">Response</div></div></div></div><div class="hero"><img src="${v.heroImage}" alt="${v.name}"/></div></section><section class="split"><div class="blk"><h2>What clients love</h2><p class="muted">• Clear communication<br/>• Reliable delivery<br/>• Premium quality standards</p><p><strong>Address:</strong> ${v.address}<br/><strong>Email:</strong> ${v.email}</p></div><img class="support" src="${v.supportImage}" alt="team"/></section></div></body></html>`;
}

function boldEditorial(v) {
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${v.name}</title><style>
*{box-sizing:border-box}body{margin:0;font-family:Manrope,Inter,system-ui;background:#05070c;color:#f2f6ff}.wrap{max-width:1200px;margin:0 auto;padding:20px}
.hero{border:1px solid #22304f;border-radius:22px;overflow:hidden;background:#0a1120}.hero img{width:100%;height:420px;object-fit:cover;display:block;filter:contrast(1.05)}.in{padding:20px}
h1{font-size:clamp(2.1rem,5vw,4rem);margin:8px 0}.sub{color:#b1bfdc}.cta{display:inline-block;margin-top:12px;background:#7c3aed;color:white;padding:12px 16px;border-radius:12px;text-decoration:none;font-weight:700}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px}.card{background:#0d162a;border:1px solid #27395c;border-radius:14px;padding:14px}
@media(max-width:900px){.cards{grid-template-columns:1fr}}
</style></head><body><div class="wrap"><section class="hero"><img src="${v.heroImage}" alt="${v.name}"/><div class="in"><div class="sub">${v.city} · ${v.industry}</div><h1>${v.name}</h1><p class="sub">High-impact service experience built for speed, trust, and conversion.</p><a class="cta" href="mailto:${v.email}">Get Proposal</a></div></section><section class="cards"><article class="card"><h3>Premium Outcomes</h3><p class="sub">Designed to impress clients on desktop and mobile.</p></article><article class="card"><h3>${v.rating} ★ Trust Score</h3><p class="sub">Based on ${v.reviews} public reviews.</p></article><article class="card"><h3>Direct Contact</h3><p class="sub">${v.phone}<br/>${v.address}</p></article></section></div></body></html>`;
}

function injuryAuthority(v) {
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${v.name} | ${v.city} Personal Injury Lawyers</title><style>
:root{--nav:#0a1428;--bg:#f4f7fc;--ink:#091226;--muted:#5a6b89;--accent:#ce1f27;--gold:#f3c76b;--line:#d9e1ef}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui;background:var(--bg);color:var(--ink)}
.top{background:var(--nav);color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.top .cta{background:var(--accent);color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:800}
.hero{position:relative;min-height:540px;display:grid;place-items:center;background:#081327;overflow:hidden}.hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(.45)}.overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,12,26,.1),rgba(6,12,26,.75))}
.hero-inner{position:relative;max-width:1180px;width:100%;padding:28px;display:grid;grid-template-columns:1.1fr .9fr;gap:20px}.headline h1{font-size:clamp(2.1rem,4.8vw,4.2rem);line-height:1.02;margin:0 0 12px;color:#fff}.headline p{color:#d8e4ff;max-width:640px}
.badges{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}.badge{border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;padding:6px 10px;border-radius:999px;font-size:12px}
.form{background:#fff;border-radius:16px;padding:18px;border:1px solid var(--line);box-shadow:0 20px 50px rgba(3,9,24,.25)}.form h3{margin:0 0 10px}.form input,.form textarea{width:100%;padding:10px;border:1px solid #cfd8ea;border-radius:8px;margin-bottom:8px;font:inherit}.form button{width:100%;border:0;background:var(--accent);color:#fff;font-weight:800;padding:12px;border-radius:9px;cursor:pointer}
.wrap{max-width:1180px;margin:0 auto;padding:22px}.trust{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.tile{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px}.tile strong{display:block;font-size:1.3rem}
.section{margin-top:16px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.card{border:1px solid #dbe3f1;border-radius:12px;padding:14px;background:#fff}.result{background:#0d1d3a;color:#f3f7ff;border-color:#253f74}.result .amt{font-size:1.7rem;font-weight:900;color:var(--gold)}
.media{display:grid;grid-template-columns:1fr 1fr;gap:12px}.media img{width:100%;height:260px;object-fit:cover;border-radius:12px;border:1px solid #d8e1ee}
footer{margin-top:18px;background:#0b162d;color:#d5e0f8;padding:20px}
@media(max-width:980px){.hero-inner{grid-template-columns:1fr}.trust{grid-template-columns:1fr 1fr}.grid3{grid-template-columns:1fr}.media{grid-template-columns:1fr}}
</style></head><body>
<div class="top"><div><strong>${v.name}</strong> · ${v.city}</div><a class="cta" href="tel:${v.phone}">Call ${v.phone}</a></div>
<section class="hero"><img src="${v.heroImage}" alt="${v.name}"/><div class="overlay"></div><div class="hero-inner"><div class="headline"><h1>Injured? Get Maximum Compensation With ${v.name}</h1><p>Trial-ready representation with relentless negotiation. No fee unless we win your case.</p><div class="badges"><span class="badge">${v.rating}★ Rating</span><span class="badge">${v.reviews}+ Reviews</span><span class="badge">Free Consultation</span><span class="badge">No Win, No Fee</span></div></div><aside class="form"><h3>Free Case Review</h3><input placeholder="Full Name"/><input placeholder="Phone"/><input placeholder="Email"/><textarea rows="3" placeholder="Tell us about your accident"></textarea><button>Request Consultation</button><div style="margin-top:8px;color:#5a6b89;font-size:12px">By submitting, you agree to be contacted by ${v.name}.</div></aside></div></section>
<div class="wrap"><section class="trust"><article class="tile"><strong>$2.4M+</strong>Recent Auto Settlement</article><article class="tile"><strong>$1.8M+</strong>Premises Liability Win</article><article class="tile"><strong>24/7</strong>Attorney Access</article><article class="tile"><strong>${v.rating}★</strong>Client Satisfaction</article></section>
<section class="section"><h2>Practice Areas</h2><div class="grid3"><article class="card"><h3>Car & Truck Accidents</h3><p>Rapid evidence capture and insurer pressure from day one.</p></article><article class="card"><h3>Slip & Fall</h3><p>Property negligence claims backed by expert documentation.</p></article><article class="card"><h3>Wrongful Death</h3><p>Compassionate litigation for families facing devastating loss.</p></article></div></section>
<section class="section"><h2>Case Results</h2><div class="grid3"><article class="card result"><div class="amt">$2,400,000</div><div>Highway collision settlement</div></article><article class="card result"><div class="amt">$1,125,000</div><div>Spinal injury verdict</div></article><article class="card result"><div class="amt">$860,000</div><div>Premises liability recovery</div></article></div></section>
<section class="section"><h2>Client Experience</h2><div class="media"><img src="${v.gallery1}" alt="client success"/><img src="${v.gallery2}" alt="legal team"/></div></section>
</div><footer><div class="wrap"><strong>${v.name}</strong><div>${v.address} · ${v.email}</div></div></footer></body></html>`;
}

export const TEMPLATE_STYLES = ['injury-authority','neo-glass', 'minimal-luxe', 'bold-editorial', 'ai-premium'];

export function buildWebsiteTemplate(style, lead) {
  const v = leadVars(lead);
  switch (style) {
    case 'injury-authority': return injuryAuthority(v);
    case 'minimal-luxe': return minimalLuxe(v);
    case 'bold-editorial': return boldEditorial(v);
    case 'neo-glass':
    default:
      return neoGlass(v);
  }
}
