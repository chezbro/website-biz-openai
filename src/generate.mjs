import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { IMAGES_DIR, SITES_DIR, loadJson, saveJson } from './paths.mjs';

export async function generateWebsiteForLead(leadsFile, index) {
  const leads = loadJson(leadsFile, []);
  const lead = leads[index];
  if (!lead) throw new Error('lead_not_found');
  if (lead.website_url) return { skipped: true, reason: 'already_generated', website: lead.website_url };

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `Generate a stunning, production-ready website for this local business:\nBusiness: ${lead.name}\nIndustry: ${lead.industry}\nCity: ${lead.city}\nAddress: ${lead.address || 'local area'}\nPhone: ${lead.phone || 'contact us'}\nRating: ${lead.rating || '5.0'} (${lead.reviews || 50} reviews)`;

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1',
    temperature: 0.8,
    input: [
      { role: 'system', content: 'Return only complete HTML document for a premium local business site. Include placeholders {{HERO_IMAGE}} {{SERVICE_IMAGE_1}} {{SERVICE_IMAGE_2}} {{SERVICE_IMAGE_3}} {{GALLERY_IMAGE_1}} {{GALLERY_IMAGE_2}} {{ABOUT_IMAGE}} {{TESTIMONIAL_BG}} and business placeholders {{business_name}} {{city}} {{phone}} {{email}} {{address}} {{rating}} {{reviews}} {{industry}} {{instagram}} {{facebook}} {{tiktok}} {{linkedin}}.' },
      { role: 'user', content: prompt }
    ]
  });

  let html = response.output_text || '<!doctype html><html><body><h1>{{business_name}}</h1></body></html>';
  const images = loadJson(path.join(IMAGES_DIR, `${lead.slug}.json`), {});
  const imageMap = {
    '{{HERO_IMAGE}}': images.heroImage || 'https://picsum.photos/seed/hero/1920/1080',
    '{{SERVICE_IMAGE_1}}': images.serviceImage1 || 'https://picsum.photos/seed/s1/800/600',
    '{{SERVICE_IMAGE_2}}': images.serviceImage2 || 'https://picsum.photos/seed/s2/800/600',
    '{{SERVICE_IMAGE_3}}': images.serviceImage3 || 'https://picsum.photos/seed/s3/800/600',
    '{{GALLERY_IMAGE_1}}': images.galleryImage1 || 'https://picsum.photos/seed/g1/800/800',
    '{{GALLERY_IMAGE_2}}': images.galleryImage2 || 'https://picsum.photos/seed/g2/800/800',
    '{{ABOUT_IMAGE}}': images.aboutImage || 'https://picsum.photos/seed/about/1200/800',
    '{{TESTIMONIAL_BG}}': images.testimonialBg || 'https://picsum.photos/seed/tbg/1920/1080'
  };
  for (const [k, v] of Object.entries(imageMap)) html = html.replaceAll(k, v);

  const data = {
    '{{business_name}}': lead.name, '{{city}}': lead.city, '{{phone}}': lead.phone || '', '{{email}}': lead.email || '', '{{address}}': lead.address || '', '{{rating}}': String(lead.rating || '5.0'), '{{reviews}}': String(lead.reviews || 50), '{{industry}}': lead.industry, '{{instagram}}': lead.socials?.instagram || '', '{{facebook}}': lead.socials?.facebook || '', '{{tiktok}}': lead.socials?.tiktok || '', '{{linkedin}}': lead.socials?.linkedin || ''
  };
  for (const [k,v] of Object.entries(data)) html = html.replaceAll(k, v);

  const outFile = path.join(SITES_DIR, `${lead.slug}.html`);
  fs.writeFileSync(outFile, html);
  const idxFile = path.join(SITES_DIR, 'index.json');
  const idxRows = loadJson(idxFile, []);
  idxRows.push({ slug: lead.slug, business_name: lead.name, city: lead.city, industry: lead.industry, file_path: outFile, created_at: new Date().toISOString() });
  saveJson(idxFile, idxRows);

  lead.website_url = outFile;
  leads[index] = lead;
  saveJson(leadsFile, leads);
  return { skipped: false, website: outFile };
}
