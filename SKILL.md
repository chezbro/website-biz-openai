---
name: website-biz
description: Run a fully automated website agency business — no subscriptions required. Finds local businesses on Google Maps, generates a custom AI website with real images for each one, enriches leads with emails and social profiles, manages outreach templates, sends personalized cold emails via SMTP, and supports daily automation mode. Bring your own API keys. Use when the user wants to find leads, build websites, send outreach emails, manage templates, run daily automation, or run the full pipeline.
metadata:
  version: "1.0"
  requires:
    env:
      - OPENAI_API_KEY
      - GOOGLE_PLACES_API_KEY
      - REPLICATE_API_TOKEN
      - SMTP_HOST
      - SMTP_USER
      - SMTP_PASS
      - SMTP_FROM
---

# Website Business — Full Automation Skill

You help the user run a **complete automated website agency business** from end to end:

1. **Scrape** local businesses from Google Maps
2. **Enrich** each lead (email + social profiles via web scraping)
3. **Generate** a custom AI website with real images per lead
4. **Manage** outreach templates with variable substitution
5. **Send** personalized cold emails via SMTP
6. **Automate** the whole pipeline on a daily schedule

All data is stored locally in `./website-biz/`. No subscription needed — users bring their own API keys.

---

## Setup Check

**Before any action**, verify these environment variables exist. If any are missing, stop and give the user the exact setup instructions below.

### Required Keys

| Variable | Purpose | How to get it |
|---|---|---|
| `OPENAI_API_KEY` | Website generation | platform.openai.com → API keys |
| `GOOGLE_PLACES_API_KEY` | Google Maps scraping | console.cloud.google.com → APIs → Places API → Credentials ($200/mo free credit) |
| `REPLICATE_API_TOKEN` | AI image generation (Seedream 4.5) | replicate.com/account → API tokens (~$0.003/image) |
| `SMTP_HOST` | Email sending | Your email provider (Gmail: smtp.gmail.com) |
| `SMTP_USER` | SMTP username | Your email address |
| `SMTP_PASS` | SMTP password | Gmail: myaccount.google.com → Security → App Passwords |
| `SMTP_FROM` | From address | Your display name + email, e.g. "Alex <alex@gmail.com>" |

### Optional Keys

| Variable | Purpose | How to get it |
|---|---|---|
| `HUNTER_API_KEY` | Email enrichment fallback | hunter.io → API (25 free searches/month) |
| `SMTP_DAILY_LIMIT` | Max emails per day | Default: 25 (Gmail hard limit) |
| `SENDER_NAME` | Name in outreach emails | Default: extracted from SMTP_FROM |

**Setup check script** — run this first if the user asks you to check setup:
```js
// Run with: node --input-type=module
const required = ['OPENAI_API_KEY','GOOGLE_PLACES_API_KEY','REPLICATE_API_TOKEN','SMTP_HOST','SMTP_USER','SMTP_PASS','SMTP_FROM'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) { console.log('MISSING:', missing.join(', ')); process.exit(1); }
else console.log('All required keys present.');
```

---

## Commands

Users can invoke any of these naturally:

| What they say | What you do |
|---|---|
| "scrape [industry] in [city]" | Lead scraping workflow |
| "enrich leads" or "find emails" | Lead enrichment workflow |
| "generate websites" | Website generation workflow |
| "add/list/edit/delete template" | Template management workflow |
| "send outreach" or "send emails" | Email outreach workflow |
| "run daily" or "automate" | Daily automation workflow |
| "set daily target [industry] in [city]" | Save daily automation config |
| "show status" | Summarize all files in `./website-biz/` |
| "full pipeline [industry] in [city]" | Run all steps end to end |

---

## Workflow 1: Lead Scraping

Write and run a Node.js script that hits the Google Places Text Search API:

```js
// google-scrape.mjs — run with: node google-scrape.mjs
import fs from 'fs';
import path from 'path';

const QUERY = process.env.QUERY; // e.g. "plumbers"
const LOCATION = process.env.LOCATION; // e.g. "Austin TX"
const KEY = process.env.GOOGLE_PLACES_API_KEY;
const MAX_RESULTS = parseInt(process.env.MAX_RESULTS || '60');

const slug = `${QUERY}-${LOCATION}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const outDir = './website-biz';
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `leads-${slug}.json`);

// Load existing leads to avoid re-scraping
let existing = [];
if (fs.existsSync(outFile)) {
  existing = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  console.log(`Found ${existing.length} existing leads, will append new ones`);
}
const existingNames = new Set(existing.map(l => l.name));

async function fetchPage(pageToken) {
  const url = pageToken
    ? `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${pageToken}&key=${KEY}`
    : `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(QUERY + ' in ' + LOCATION)}&key=${KEY}`;
  const res = await fetch(url);
  return res.json();
}

async function getPlaceDetails(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_phone_number,website,formatted_address,rating,user_ratings_total&key=${KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.result || {};
}

const leads = [...existing];
let pageToken = null;
let page = 0;

while (leads.length < MAX_RESULTS) {
  if (page > 0) await new Promise(r => setTimeout(r, 2500)); // wait between pages
  const data = await fetchPage(pageToken);
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error('API error:', data.status, data.error_message);
    break;
  }
  for (const place of (data.results || [])) {
    if (leads.length >= MAX_RESULTS) break;
    if (existingNames.has(place.name)) continue;
    // Get details (phone + website) for each place
    const details = await getPlaceDetails(place.place_id);
    await new Promise(r => setTimeout(r, 300));
    const nameSlug = (details.name || place.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const citySlug = LOCATION.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    leads.push({
      id: place.place_id,
      name: details.name || place.name,
      address: details.formatted_address || place.formatted_address || '',
      phone: details.formatted_phone_number || '',
      website: details.website || '',
      rating: details.rating || place.rating || null,
      reviews: details.user_ratings_total || place.user_ratings_total || 0,
      industry: QUERY,
      city: LOCATION,
      slug: `${nameSlug}-${citySlug}`,
      email: '',
      email_status: 'pending',
      socials: {},
      website_url: '',
      enriched: false,
    });
    existingNames.add(place.name);
    console.log(`  [${leads.length}] ${details.name || place.name}`);
  }
  pageToken = data.next_page_token;
  if (!pageToken) break;
  page++;
}

fs.writeFileSync(outFile, JSON.stringify(leads, null, 2));
console.log(`\nSaved ${leads.length} leads to ${outFile}`);
```

Run it as: `QUERY="plumbers" LOCATION="Austin TX" GOOGLE_PLACES_API_KEY=... node google-scrape.mjs`

After scraping, tell the user: how many leads were found, the file path, and offer to run enrichment next.

---

## Workflow 2: Lead Enrichment

For each lead with `email_status: "pending"`, web-scrape the business's website to find emails and social links.

Write and run a Node.js script:

```js
// enrich.mjs — run with: node enrich.mjs
import fs from 'fs';

const LEADS_FILE = process.argv[2]; // path to leads JSON file
const HUNTER_KEY = process.env.HUNTER_API_KEY || '';

function extractDomain(url) {
  try { return new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace('www.', ''); }
  catch { return ''; }
}

async function fetchText(url, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
    clearTimeout(timer);
    return res.ok ? await res.text() : '';
  } catch { clearTimeout(timer); return ''; }
}

function extractEmails(html) {
  const mailtoMatches = [...(html.matchAll(/mailto:([^\s"'<>?#,]+)/gi))].map(m => m[1].toLowerCase());
  const plainMatches = [...(html.matchAll(/\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g))].map(m => m[0].toLowerCase());
  const all = [...new Set([...mailtoMatches, ...plainMatches])];
  // Filter out images, example addresses, tracking pixels etc.
  return all.filter(e => !e.includes('.png') && !e.includes('.jpg') && !e.includes('example.') && !e.includes('sentry') && !e.includes('noreply'));
}

function extractSocials(html) {
  const socials = {};
  const patterns = {
    instagram: /instagram\.com\/([\w.]+)/i,
    facebook: /facebook\.com\/([\w.]+)/i,
    linkedin: /linkedin\.com\/(?:company|in)\/([\w-]+)/i,
    tiktok: /tiktok\.com\/@([\w.]+)/i,
    twitter: /(?:twitter|x)\.com\/([\w]+)/i,
    youtube: /youtube\.com\/(?:@|channel\/)?([\w-]+)/i,
  };
  for (const [platform, re] of Object.entries(patterns)) {
    const match = html.match(re);
    if (match && match[1] !== 'share' && match[1] !== 'sharer' && match[1] !== 'intent') {
      socials[platform] = `https://${platform === 'twitter' ? 'x' : platform}.com/${match[1]}`;
    }
  }
  return socials;
}

async function enrichLead(lead) {
  if (!lead.website && !lead.name) return lead;

  let emails = [];
  let socials = {};

  // 1. Scrape homepage
  if (lead.website) {
    const homepage = await fetchText(lead.website);
    if (homepage) {
      emails = extractEmails(homepage);
      socials = extractSocials(homepage);
    }
    // 2. Try /contact page if no email yet
    if (emails.length === 0 && lead.website) {
      const base = lead.website.replace(/\/$/, '');
      for (const path of ['/contact', '/contact-us', '/reach-us', '/about']) {
        const contactHtml = await fetchText(base + path);
        if (contactHtml) {
          const found = extractEmails(contactHtml);
          if (found.length) { emails = found; break; }
          const foundSocials = extractSocials(contactHtml);
          socials = { ...foundSocials, ...socials };
        }
      }
    }
  }

  // 3. Hunter.io fallback if still no email
  if (emails.length === 0 && HUNTER_KEY && lead.website) {
    const domain = extractDomain(lead.website);
    if (domain) {
      try {
        const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_KEY}`);
        const data = await res.json();
        const found = (data.data?.emails || []).filter(e => e.confidence > 50).map(e => e.value);
        if (found.length) { emails = found; lead.email_status = 'hunter'; }
      } catch {}
    }
  }

  lead.email = emails[0] || '';
  lead.email_secondary = emails[1] || '';
  lead.email_status = emails.length > 0 ? (lead.email_status || 'scraped') : 'not_found';
  lead.socials = { ...lead.socials, ...socials };
  lead.enriched = true;
  return lead;
}

const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
const toEnrich = leads.filter(l => !l.enriched || l.email_status === 'pending');
console.log(`Enriching ${toEnrich.length} leads...`);

let enriched = 0;
for (const lead of leads) {
  if (!lead.enriched || lead.email_status === 'pending') {
    await enrichLead(lead);
    enriched++;
    const status = lead.email ? `email: ${lead.email}` : 'no email';
    console.log(`  [${enriched}/${toEnrich.length}] ${lead.name} — ${status}`);
    await new Promise(r => setTimeout(r, 500));
  }
}

fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
const withEmail = leads.filter(l => l.email).length;
console.log(`\nDone. ${withEmail}/${leads.length} leads have emails. Saved to ${LEADS_FILE}`);
```

Run it as: `HUNTER_API_KEY=... node enrich.mjs ./website-biz/leads-plumbers-austin-tx.json`

Report the enrichment summary: how many leads now have emails, which platforms had social profiles.

---

## Workflow 3: Website Generation

For each lead without a `website_url`, generate a complete custom HTML website using the OpenAI API, then inject AI images.

### Step A — Generate AI Images (Replicate Seedream 4.5)

Write and run a Node.js script for each lead:

```js
// gen-images.mjs — node gen-images.mjs <business_name> <industry> <slug>
import fs from 'fs';

const TOKEN = process.env.REPLICATE_API_TOKEN;
const [,, businessName, industry, slug] = process.argv;
const outDir = './website-biz/images';
fs.mkdirSync(outDir, { recursive: true });
const outFile = `${outDir}/${slug}.json`;

if (fs.existsSync(outFile)) {
  console.log('Images already generated, skipping.');
  process.exit(0);
}

const NEG = 'text, words, letters, typography, logos, signs, watermarks, labels, captions, titles, writing, numbers, digits, fonts, alphabets, characters, inscriptions, banners, posters, signage';

const SIZES = { '16:9': '2048x1152', '4:3': '1536x1152', '1:1': '1024x1024', '3:2': '1536x1024' };

const configs = [
  { key: 'heroImage', aspect: '16:9', prompt: `Stunning professional hero image for a ${industry} business. Wide cinematic composition, commercial photography, beautiful dramatic lighting, modern clean aesthetic, no people visible. CRITICAL: absolutely zero text, words, letters, or logos.` },
  { key: 'serviceImage1', aspect: '4:3', prompt: `Premium product/service photography for a ${industry} business. The core primary service being performed or showcased, sharp detail, professional lighting, magazine quality. CRITICAL: no text, words, or letters of any kind.` },
  { key: 'serviceImage2', aspect: '4:3', prompt: `Professional service photography for a ${industry} business showing a secondary offering. Visually distinct from the first image, well-lit, commercial quality. CRITICAL: no text, words, or letters.` },
  { key: 'serviceImage3', aspect: '4:3', prompt: `Commercial photography for a ${industry} business showing a third service feature or detail. Shows range and depth, professional quality. CRITICAL: no text, words, or letters.` },
  { key: 'galleryImage1', aspect: '1:1', prompt: `Impressive portfolio/gallery image for a ${industry} business. Beautiful finished work, results, or craftsmanship that makes viewers say wow. Square composition, Instagram-ready. CRITICAL: no text, words, or letters.` },
  { key: 'galleryImage2', aspect: '1:1', prompt: `Second portfolio image for a ${industry} business. Different angle or example from the first, shows range. Square composition, social-media ready. CRITICAL: no text, words, or letters.` },
  { key: 'aboutImage', aspect: '3:2', prompt: `Warm authentic about-section image for a ${industry} business. People at work, workspace environment, or team culture. Natural candid lighting, trustworthy and human-centered. CRITICAL: no text, words, or letters.` },
  { key: 'testimonialBg', aspect: '16:9', prompt: `Soft-focus elegant background for testimonials section of a ${industry} business. Abstract or blurred scene, works well with overlaid text, subtle and non-distracting. CRITICAL: no text, words, or letters.` },
];

const PICSUM = { '16:9': '1920/1080', '4:3': '800/600', '1:1': '800/800', '3:2': '1200/800' };
const fallback = (aspect, seed) => `https://picsum.photos/seed/${seed}/${PICSUM[aspect]}`;

async function genOne(prompt, aspect, key, seed) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const create = await fetch('https://api.replicate.com/v1/models/bytedance/seedream-4.5/predictions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { prompt, negative_prompt: NEG, image_size: SIZES[aspect] } }),
      });
      if (!create.ok) throw new Error(`Create failed: ${create.status} ${await create.text()}`);
      let pred = await create.json();
      // Poll until done
      for (let i = 0; i < 60 && pred.status !== 'succeeded' && pred.status !== 'failed'; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const poll = await fetch(pred.urls.get, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
        pred = await poll.json();
      }
      if (pred.status !== 'succeeded') throw new Error(`Prediction ${pred.status}`);
      const imgUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
      const imgRes = await fetch(imgUrl);
      const buf = await imgRes.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      return `data:image/jpeg;base64,${b64}`;
    } catch (e) {
      console.warn(`  Attempt ${attempt}/3 failed for ${key}: ${e.message}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, 12000));
    }
  }
  return fallback(aspect, seed);
}

const images = {};
for (let i = 0; i < configs.length; i++) {
  const { key, aspect, prompt } = configs[i];
  console.log(`  Generating ${key} (${i+1}/8)...`);
  images[key] = await genOne(prompt, aspect, key, i + 1);
  console.log(`  ✓ ${key} (${Math.round(images[key].length / 1024)}KB)`);
  if (i < configs.length - 1) await new Promise(r => setTimeout(r, 2000));
}

fs.writeFileSync(outFile, JSON.stringify(images, null, 2));
console.log(`Images saved to ${outFile}`);
```

### Step B — Generate HTML with OpenAI API

After images are generated, call OpenAI (GPT-4.1 or GPT-4o) to produce the website HTML. Use the following prompt structure:

**System prompt:**
```
You are an expert web designer creating a premium, production-ready HTML5 website for a local business. You generate complete, self-contained HTML files that look like $3,000+ custom designs.

DESIGN PHILOSOPHY — Pick ONE bold aesthetic direction and execute with precision:
- Brutally minimal | Luxury/refined | Retro-futuristic | Industrial/utilitarian | Editorial/magazine | Art deco/geometric | Soft pastel + bold accents

TYPOGRAPHY — BANNED fonts (never use): Inter, Roboto, Arial, Montserrat, Raleway, Lato, Open Sans, Poppins, Space Grotesk, system-ui
USE instead (Google Fonts): Display: Clash Display, Cabinet Grotesk, Syne, Outfit, Fraunces | Body: Satoshi, General Sans, Switzer, Space Mono, JetBrains Mono, Instrument Serif
Pair one distinctive display font with one refined body font.

COLOR — BANNED: purple gradients on white, generic blue (#007bff), boring grays, safe teal+orange
USE: Bold unexpected combinations with CSS variables --primary, --accent, --bg, --text, --text-muted
Examples: Deep forest green + coral | Charcoal + electric yellow | Navy + terracotta | Cream + deep burgundy

LAYOUT & MOTION:
- Asymmetric sections — break the grid intentionally
- Overlapping elements — cards that cross section boundaries
- CSS @keyframes — page load reveals with staggered animation-delay (0ms, 100ms, 200ms...)
- Hover states that surprise — scale transforms, color shifts, shadow changes
- Atmospheric backgrounds — gradient meshes, subtle noise textures via CSS, geometric SVG patterns

STRICT RULES:
1. NO EMOJIS — use inline SVG icons for phone, star, checkmark, location, arrow, etc.
2. NO generic stats grids ("15+ Years | 10K Jobs | 500 Reviews")
3. All CSS inline in <style> block — no external CSS except Google Fonts
4. Mobile-first responsive: clamp() for fluid typography, max-height 80vh on mobile for hero, 44px minimum touch targets, @media (max-width: 768px) stacked layouts
5. Include smooth CSS animations — page load entry animations, scroll-reveal via intersection observer if needed
6. NO placeholder text like "Lorem ipsum" — write realistic industry-appropriate copy

REQUIRED SECTIONS (in order):
1. Hero — bold headline, industry-specific value prop subheadline, CTA button, atmospheric background
2. Services (3-4 cards) — industry-specific service names, distinctive card styling, brief human copy
3. About — city mentioned, trust indicators (not a generic stats grid), local community angle
4. Testimonials (2-3) — realistic diverse customer names, industry-specific review content, CSS star ratings (not emoji)
5. Contact — address + tel: link + mailto: link + styled form + social links
6. Footer — copyright + nav links + SVG social icons

IMAGE PLACEHOLDERS — use these exact strings as img src values:
{{HERO_IMAGE}} | {{SERVICE_IMAGE_1}} | {{SERVICE_IMAGE_2}} | {{SERVICE_IMAGE_3}}
{{GALLERY_IMAGE_1}} | {{GALLERY_IMAGE_2}} | {{ABOUT_IMAGE}} | {{TESTIMONIAL_BG}}

BUSINESS DATA PLACEHOLDERS — use these exact strings:
{{business_name}} | {{city}} | {{phone}} | {{email}} | {{address}} | {{rating}} | {{reviews}} | {{industry}}
{{instagram}} | {{facebook}} | {{tiktok}} | {{linkedin}}

Output ONLY the complete HTML document starting with <!DOCTYPE html>. No explanation, no markdown, no code fences.
```

**User prompt:**
```
Generate a stunning, production-ready website for this local business:

Business: {{lead.name}}
Industry: {{lead.industry}}
City: {{lead.city}}
Address: {{lead.address}}
Phone: {{lead.phone}}
Rating: {{lead.rating}} ({{lead.reviews}} reviews)

Create a distinctive, memorable design that perfectly fits the {{lead.industry}} industry in {{lead.city}}. Make it look like a $3,000 custom design, not a template.
```

### Step C — Inject Images and Data

After HTML is generated:
1. Replace all `{{HERO_IMAGE}}`, `{{SERVICE_IMAGE_1}}`, etc. with actual base64 data URIs from `./website-biz/images/{slug}.json`
2. Replace `{{business_name}}`, `{{city}}`, `{{phone}}`, `{{email}}`, `{{address}}`, `{{rating}}`, `{{reviews}}`, `{{industry}}`
3. Replace `{{instagram}}`, `{{facebook}}`, `{{tiktok}}`, `{{linkedin}}` from `lead.socials`
4. Save final HTML to `./website-biz/websites/{slug}.html`
5. Update `./website-biz/websites/index.json` (append `{ slug, business_name, file_path, created_at }`)
6. Update the lead's `website_url` field in the leads JSON file

Write and run a Node.js script for the full generation + injection:

```js
// gen-site.mjs — node gen-site.mjs <leads_file> <lead_index>
import fs from 'fs';
import OpenAI from 'openai';

const [,, leadsFile, indexStr] = process.argv;
const idx = parseInt(indexStr);
const leads = JSON.parse(fs.readFileSync(leadsFile, 'utf8'));
const lead = leads[idx];

if (lead.website_url) { console.log(`Site already generated: ${lead.website_url}`); process.exit(0); }

fs.mkdirSync('./website-biz/websites', { recursive: true });
const indexFile = './website-biz/websites/index.json';
const websiteIndex = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : [];

// Load images
const imagesFile = `./website-biz/images/${lead.slug}.json`;
const images = fs.existsSync(imagesFile) ? JSON.parse(fs.readFileSync(imagesFile, 'utf8')) : {};

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

console.log(`Generating website for ${lead.name}...`);
const response = await client.responses.create({
  model: process.env.OPENAI_MODEL || 'gpt-4.1',
  temperature: 0.8,
  input: [
    {
      role: 'system',
      content: `You are an expert web designer creating a premium, production-ready HTML5 website for a local business. You generate complete, self-contained HTML files that look like $3,000+ custom designs.

DESIGN PHILOSOPHY — Pick ONE bold aesthetic direction and execute with precision:
Brutally minimal | Luxury/refined | Retro-futuristic | Industrial/utilitarian | Editorial/magazine | Art deco/geometric | Soft pastel + bold accents

TYPOGRAPHY — BANNED fonts (never use): Inter, Roboto, Arial, Montserrat, Raleway, Lato, Open Sans, Poppins, Space Grotesk, system-ui
USE instead (Google Fonts): Display: Clash Display, Cabinet Grotesk, Syne, Outfit, Fraunces | Body: Satoshi, General Sans, Switzer, Space Mono, JetBrains Mono, Instrument Serif

COLOR — BANNED: purple gradients on white, generic blue (#007bff), boring grays
USE: Bold unexpected combinations with CSS variables --primary, --accent, --bg, --text
Examples: Deep forest green + coral | Charcoal + electric yellow | Navy + terracotta | Cream + deep burgundy

LAYOUT & MOTION:
- Asymmetric sections — break the grid intentionally
- Overlapping elements — cards that cross section boundaries
- CSS @keyframes — page load reveals with staggered animation-delay
- Hover states that surprise — scale, color shifts, shadows
- Atmospheric backgrounds — gradient meshes, geometric SVG patterns

STRICT RULES:
1. NO EMOJIS — use inline SVG icons only
2. NO generic stats grids
3. All CSS inline in <style> — no external CSS except Google Fonts
4. Mobile-first responsive: clamp() typography, 80vh hero max on mobile, 44px touch targets
5. Include CSS animations with smooth entry reveals
6. Write realistic industry-appropriate copy (no Lorem ipsum)

REQUIRED SECTIONS: Hero | Services (3-4) | About | Testimonials (2-3) | Contact | Footer

IMAGE PLACEHOLDERS (use as img src): {{HERO_IMAGE}} | {{SERVICE_IMAGE_1}} | {{SERVICE_IMAGE_2}} | {{SERVICE_IMAGE_3}} | {{GALLERY_IMAGE_1}} | {{GALLERY_IMAGE_2}} | {{ABOUT_IMAGE}} | {{TESTIMONIAL_BG}}

BUSINESS DATA PLACEHOLDERS: {{business_name}} | {{city}} | {{phone}} | {{email}} | {{address}} | {{rating}} | {{reviews}} | {{industry}} | {{instagram}} | {{facebook}} | {{tiktok}} | {{linkedin}}

Output ONLY the complete HTML starting with <!DOCTYPE html>. No explanation, no markdown.`,
    },
    {
      role: 'user',
      content: `Generate a stunning, production-ready website for this local business:\n\nBusiness: ${lead.name}\nIndustry: ${lead.industry}\nCity: ${lead.city}\nAddress: ${lead.address || 'local area'}\nPhone: ${lead.phone || 'contact us'}\nRating: ${lead.rating || '5.0'} (${lead.reviews || 50} reviews)\n\nCreate a distinctive, memorable design for the ${lead.industry} industry in ${lead.city}. Make it look like a $3,000 custom design.`,
    },
  ],
});

let html = response.output_text;

// Inject images
const imageMap = {
  '{{HERO_IMAGE}}': images.heroImage || `https://picsum.photos/seed/1/1920/1080`,
  '{{SERVICE_IMAGE_1}}': images.serviceImage1 || `https://picsum.photos/seed/2/800/600`,
  '{{SERVICE_IMAGE_2}}': images.serviceImage2 || `https://picsum.photos/seed/3/800/600`,
  '{{SERVICE_IMAGE_3}}': images.serviceImage3 || `https://picsum.photos/seed/4/800/600`,
  '{{GALLERY_IMAGE_1}}': images.galleryImage1 || `https://picsum.photos/seed/5/800/800`,
  '{{GALLERY_IMAGE_2}}': images.galleryImage2 || `https://picsum.photos/seed/6/800/800`,
  '{{ABOUT_IMAGE}}': images.aboutImage || `https://picsum.photos/seed/7/1200/800`,
  '{{TESTIMONIAL_BG}}': images.testimonialBg || `https://picsum.photos/seed/8/1920/1080`,
};
for (const [placeholder, value] of Object.entries(imageMap)) {
  html = html.replaceAll(placeholder, value);
}

// Inject business data
const dataMap = {
  '{{business_name}}': lead.name, '{{city}}': lead.city, '{{phone}}': lead.phone || '',
  '{{email}}': lead.email || '', '{{address}}': lead.address || '', '{{rating}}': String(lead.rating || '5.0'),
  '{{reviews}}': String(lead.reviews || 50), '{{industry}}': lead.industry,
  '{{instagram}}': lead.socials?.instagram || '', '{{facebook}}': lead.socials?.facebook || '',
  '{{tiktok}}': lead.socials?.tiktok || '', '{{linkedin}}': lead.socials?.linkedin || '',
};
for (const [placeholder, value] of Object.entries(dataMap)) {
  html = html.replaceAll(placeholder, value);
}

const outFile = `./website-biz/websites/${lead.slug}.html`;
fs.writeFileSync(outFile, html);
lead.website_url = outFile;
leads[idx] = lead;
fs.writeFileSync(leadsFile, JSON.stringify(leads, null, 2));

websiteIndex.push({ slug: lead.slug, business_name: lead.name, city: lead.city, industry: lead.industry, file_path: outFile, created_at: new Date().toISOString() });
fs.writeFileSync(indexFile, JSON.stringify(websiteIndex, null, 2));
console.log(`Website saved: ${outFile}`);
```

Install the SDK if needed: `npm install openai` and set `OPENAI_API_KEY` in your environment.

---

## Workflow 4: Template Management

Templates are stored in `./website-biz/templates.json`. Pre-load default on first use if file doesn't exist.

**Default template** (seed this if `templates.json` is missing):
```json
[{
  "id": "default",
  "name": "Cold intro",
  "subject": "I built something for {{business_name}}",
  "body": "Hey,\n\nI noticed {{business_name}} in {{city}} could use a stronger web presence.\n\nI put together a free preview — no commitment:\n{{website_url}}\n\nIf you like it, I can get it live on a real domain for you.\n\nBest,\n{{sender_name}}",
  "is_default": true,
  "created_at": "{{now}}"
}]
```

**Supported variables:** `{{business_name}}`, `{{city}}`, `{{industry}}`, `{{website_url}}`, `{{phone}}`, `{{rating}}`, `{{reviews}}`, `{{sender_name}}`

### Commands

**"add template [name]"** — Assistant asks for subject and body, then writes to templates.json:
```js
// Read existing, push new entry, write back
const templates = JSON.parse(fs.readFileSync('./website-biz/templates.json', 'utf8'));
templates.push({ id: crypto.randomUUID(), name: NAME, subject: SUBJECT, body: BODY, is_default: false, created_at: new Date().toISOString() });
fs.writeFileSync('./website-biz/templates.json', JSON.stringify(templates, null, 2));
```

**"list templates"** — Read templates.json, display a table of name/subject/is_default.

**"edit template [name]"** — Find by name, prompt for new subject/body, update and save.

**"delete template [name]"** — Find by name, remove from array, save.

**"set default template [name]"** — Set all `is_default: false`, then set target to `true`, save.

---

## Workflow 5: Email Outreach

Write and run a Node.js script that sends personalized emails using the active template:

```js
// send-outreach.mjs — node send-outreach.mjs <leads_file>
import fs from 'fs';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const LEADS_FILE = process.argv[2];
const DAILY_LIMIT = parseInt(process.env.SMTP_DAILY_LIMIT || '25');
const SMTP_FROM = process.env.SMTP_FROM;
const SENDER_NAME = process.env.SENDER_NAME || SMTP_FROM?.match(/^([^<]+)</)?.[1]?.trim() || 'Alex';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const logFile = './website-biz/outreach-log.json';
const log = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : [];
const sentToday = log.filter(e => e.sent_at?.startsWith(new Date().toISOString().slice(0, 10))).length;
const remaining = DAILY_LIMIT - sentToday;

if (remaining <= 0) {
  console.log(`Daily limit of ${DAILY_LIMIT} reached. Try again tomorrow.`);
  process.exit(0);
}

const templatesFile = './website-biz/templates.json';
if (!fs.existsSync(templatesFile)) {
  console.error('No templates found. Run "add template" first.');
  process.exit(1);
}
const templates = JSON.parse(fs.readFileSync(templatesFile, 'utf8'));
const template = templates.find(t => t.is_default) || templates[0];

const alreadySent = new Set(log.map(e => e.email));
const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
const eligible = leads.filter(l => l.email && l.website_url && !alreadySent.has(l.email));

console.log(`Sending to ${Math.min(eligible.length, remaining)} leads (daily limit: ${DAILY_LIMIT}, sent today: ${sentToday})`);

function substitute(text, vars) {
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v || ''), text);
}

let sent = 0;
for (const lead of eligible.slice(0, remaining)) {
  const vars = {
    business_name: lead.name, city: lead.city, industry: lead.industry,
    website_url: lead.website_url, phone: lead.phone || '', rating: String(lead.rating || ''),
    reviews: String(lead.reviews || ''), sender_name: SENDER_NAME,
  };
  const subject = substitute(template.subject, vars);
  const body = substitute(template.body, vars);
  const entry = { id: crypto.randomUUID(), email: lead.email, business_name: lead.name, template_id: template.id, sent_at: null, status: 'failed', error: null };
  try {
    await transporter.sendMail({ from: SMTP_FROM, to: lead.email, subject, text: body });
    entry.status = 'sent';
    entry.sent_at = new Date().toISOString();
    sent++;
    console.log(`  ✓ ${lead.name} <${lead.email}>`);
  } catch (e) {
    entry.error = e.message;
    console.error(`  ✗ ${lead.name} <${lead.email}>: ${e.message}`);
  }
  log.push(entry);
  fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
  if (entry.status === 'sent') await new Promise(r => setTimeout(r, 3000)); // 3s between sends
}

console.log(`\nDone. Sent ${sent} emails. Log saved to ${logFile}`);
```

Install nodemailer: `npm install nodemailer` in a temp dir before running.

After sending, report: how many sent, how many skipped (already sent or no email), daily limit remaining.

---

## Workflow 6: Daily Automation

**Command:** "run daily" or "automate" or "set daily target [industry] in [city]"

### daily-state.json schema:
```json
{
  "last_run": "2026-02-25",
  "query": "plumbers",
  "location": "Austin TX",
  "leads_scraped_today": 0,
  "websites_generated_today": 0,
  "emails_sent_today": 0,
  "daily_limits": { "scrape": 60, "generate": 25, "email": 25 }
}
```

### "set daily target [industry] in [city]"

Read `daily-state.json` (create if missing), update `query` and `location`, save.
```js
const stateFile = './website-biz/daily-state.json';
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { daily_limits: { scrape: 60, generate: 25, email: 25 } };
state.query = QUERY;
state.location = LOCATION;
fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
console.log(`Daily target set: ${QUERY} in ${LOCATION}`);
```

### "run daily"

1. **Load state** from `./website-biz/daily-state.json`. If missing, prompt user to "set daily target" first.
2. **Check if already ran today** — if `last_run === today`, report counts and remaining capacity. Don't reset until tomorrow.
3. **Reset today's counters** if `last_run !== today`:
   ```js
   state.last_run = today;
   state.leads_scraped_today = 0;
   state.websites_generated_today = 0;
   state.emails_sent_today = 0;
   ```
4. **Run scraping** — call Workflow 1 with `MAX_RESULTS = daily_limits.scrape - leads_scraped_today`. Update counter.
5. **Run enrichment** — call Workflow 2 on the leads file.
6. **Run website generation** — iterate leads with no `website_url`, up to `daily_limits.generate - websites_generated_today`. Update counter.
7. **Run outreach** — call Workflow 5. Count sends, update counter.
8. **Save updated state**.
9. **Report summary:**
   ```
   Daily run complete for [industry] in [city]:
   - Scraped: X new leads (total: Y)
   - Generated: X websites
   - Sent: X emails

   Tomorrow: X leads ready for websites, Y leads ready for outreach.
   ```

---

## Workflow 7: Status Report

When user says "show status" or "status":

Read all files in `./website-biz/` and summarize:

```
Website Business Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Leads Files:
  - leads-plumbers-austin-tx.json: 60 leads, 45 with email, 50 enriched
  - leads-dentists-miami-fl.json: 35 leads, 28 with email, 35 enriched

Websites: 47 generated

Outreach:
  - Emails sent: 125 total (25 today)
  - Templates: 3 saved (1 default: "Cold intro")

Daily Automation:
  - Target: plumbers in Austin TX
  - Last run: 2026-02-25
  - Today: scraped 60, generated 25, sent 25
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Data File Structure

```
./website-biz/
├── leads-{query}-{location}.json     # scraped + enriched leads
├── images/
│   └── {slug}.json                   # 8 base64 data URIs per lead
├── websites/
│   ├── index.json                    # all generated websites list
│   └── {slug}.html                   # individual website HTML files
├── templates.json                    # outreach templates (CRUD)
├── outreach-log.json                 # sent emails tracker (dedup by email)
└── daily-state.json                  # automation state + daily counters
```

---

## Rate Limits & Cost Guide

| Operation | Rate | Cost estimate |
|---|---|---|
| Google Places scrape | 1 req/sec, 2.5s between pages | ~$0.017 per 60 results ($200/mo free) |
| Replicate image gen (8 images) | 2s between requests | ~$0.024 per lead (~$0.003/image) |
| OpenAI website gen | 1 at a time, ~20-40s each | ~$0.08-0.25 per website (model-dependent) |
| SMTP email | 3s between sends | Free (Gmail limit: 25/day) |

**Recommended daily operation:**
Scrape 50-60 leads → Enrich all → Generate 25 websites → Send 25 emails
**Daily cost:** ~$3.00 (images) + ~$2.00-6.00 (OpenAI) = ~$5.00-9.00/day for 25 personalized outreach emails.

**Good targeting criteria:** Businesses with 4.0+ rating, 50+ reviews, and no/bad existing website.

---

## Troubleshooting

| Error | Fix |
|---|---|
| `GOOGLE_PLACES_API_KEY` not found | Set env var or check console.cloud.google.com billing |
| Replicate 402 | Add credits at replicate.com/account/billing |
| SMTP authentication failed | Use App Password (not account password) for Gmail |
| `Cannot find module openai` | Run `npm install openai` in working directory |
| `Cannot find module nodemailer` | Run `npm install nodemailer` in working directory |
| Rate limit from Google | Add 2.5s delays between pages (already in script) |
| Website file too large | Base64 images inflate file size ~3-4x — normal, ~5-15MB per site |
