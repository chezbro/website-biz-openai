import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { IMAGES_DIR, SITES_DIR, loadJson, saveJson } from './paths.mjs';
import { dbUpsertLeads, dbUpsertWebsite, dbWriteArtifact } from './db.mjs';
import { buildWebsiteTemplate } from './siteTemplates.mjs';
import { resolveImageSet } from './imageSources.mjs';

export async function generateWebsiteForLead(leadsFile, index, templateStyle = 'neo-glass', forceRegenerate = true) {
  const leads = loadJson(leadsFile, []);
  const lead = leads[index];
  if (!lead) throw new Error('lead_not_found');
  if (lead.website_url && !forceRegenerate) {
    try {
      const existingHtml = fs.existsSync(lead.website_url) ? fs.readFileSync(lead.website_url, 'utf8') : null;
      await dbWriteArtifact('website', lead.slug, {
        slug: lead.slug,
        business_name: lead.name,
        city: lead.city,
        industry: lead.industry,
        file_path: lead.website_url,
        source_file: path.basename(leadsFile),
        created_at: new Date().toISOString(),
        template_style: templateStyle,
        html: existingHtml,
      });
    } catch {}
    return { skipped: true, reason: 'already_generated', website: lead.website_url };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const imageOverrides = await resolveImageSet(lead);
  lead.imageOverrides = imageOverrides;
  const prompt = `Generate a stunning, production-ready website for this local business:\nBusiness: ${lead.name}\nIndustry: ${lead.industry}\nCity: ${lead.city}\nAddress: ${lead.address || 'local area'}\nPhone: ${lead.phone || 'contact us'}\nRating: ${lead.rating || '5.0'} (${lead.reviews || 50} reviews)`;

  let html = '';
  if (templateStyle === 'ai-premium') {
    try {
      const response = await client.responses.create({
        model: process.env.OPENAI_MODEL || 'gpt-4.1',
        temperature: 0.8,
        input: [
          { role: 'system', content: 'Return only complete HTML document for a premium local business site. Include placeholders {{HERO_IMAGE}} {{SERVICE_IMAGE_1}} {{SERVICE_IMAGE_2}} {{SERVICE_IMAGE_3}} {{GALLERY_IMAGE_1}} {{GALLERY_IMAGE_2}} {{ABOUT_IMAGE}} {{TESTIMONIAL_BG}} and business placeholders {{business_name}} {{city}} {{phone}} {{email}} {{address}} {{rating}} {{reviews}} {{industry}} {{instagram}} {{facebook}} {{tiktok}} {{linkedin}}.' },
          { role: 'user', content: prompt }
        ]
      });
      html = response.output_text || '';
    } catch {
      html = '';
    }
  }

  if (!html.trim()) {
    html = buildWebsiteTemplate(templateStyle, lead);
  }
  const images = loadJson(path.join(IMAGES_DIR, `${lead.slug}.json`), {});
  const imageMap = {
    '{{HERO_IMAGE}}': images.heroImage || imageOverrides.heroImage,
    '{{SERVICE_IMAGE_1}}': images.serviceImage1 || imageOverrides.supportImage,
    '{{SERVICE_IMAGE_2}}': images.serviceImage2 || imageOverrides.gallery1,
    '{{SERVICE_IMAGE_3}}': images.serviceImage3 || imageOverrides.gallery2,
    '{{GALLERY_IMAGE_1}}': images.galleryImage1 || imageOverrides.gallery1,
    '{{GALLERY_IMAGE_2}}': images.galleryImage2 || imageOverrides.gallery2,
    '{{ABOUT_IMAGE}}': images.aboutImage || imageOverrides.supportImage,
    '{{TESTIMONIAL_BG}}': images.testimonialBg || imageOverrides.heroImage
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
  const siteRow = { slug: lead.slug, business_name: lead.name, city: lead.city, industry: lead.industry, template_style: templateStyle, file_path: outFile, created_at: new Date().toISOString(), source_file: path.basename(leadsFile), image_overrides: imageOverrides, html };
  idxRows.push(siteRow);
  saveJson(idxFile, idxRows);

  lead.website_url = outFile;
  leads[index] = lead;
  saveJson(leadsFile, leads);

  try { await dbUpsertWebsite(siteRow); } catch {}
  try { await dbUpsertLeads(path.basename(leadsFile), leads); } catch {}
  try { await dbWriteArtifact('website', lead.slug, siteRow); } catch {}
  try { await dbWriteArtifact('leads', path.basename(leadsFile), { total: leads.length, sample: leads.slice(0, 50) }); } catch {}

  return { skipped: false, website: outFile };
}
