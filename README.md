# Website Biz OpenAI — Operational Toolkit

Production-grade, OpenAI-first automation toolkit for running a website agency pipeline:

1. Scrape local leads (Google Places)
2. Enrich leads (email + socials)
3. Generate custom websites (OpenAI + Replicate)
4. Send personalized cold outreach (SMTP)
5. Run daily automation and status reporting

## Quickstart

```bash
cp .env.example .env
# fill keys
npm install
node src/cli.mjs check
```

## Core commands

> Free Google Maps scraping mode uses Playwright (no Places API key). For best stability, run scraping from local CLI/worker runtime.

```bash
node src/cli.mjs scrape plumbers "Austin TX"
node src/cli.mjs enrich ./website-biz/leads-plumbers-austin-tx.json
node src/cli.mjs generate-site ./website-biz/leads-plumbers-austin-tx.json 0
node src/cli.mjs send ./website-biz/leads-plumbers-austin-tx.json
node src/cli.mjs status
```

## Daily automation

```bash
node src/cli.mjs daily-set plumbers "Austin TX"
node src/cli.mjs daily-run
```

## Template management

```bash
node src/cli.mjs template-list
node src/cli.mjs template-add "Quick opener" "Built this for {{business_name}}" "Hey {{business_name}}..."
node src/cli.mjs template-default "Quick opener"
```

## Required env vars

- OPENAI_API_KEY
- GOOGLE_PLACES_API_KEY
- REPLICATE_API_TOKEN
- SMTP_HOST
- SMTP_USER
- SMTP_PASS
- SMTP_FROM

## Data directory

All output is local in `./website-biz/`.
