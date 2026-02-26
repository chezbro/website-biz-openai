const REQUIRED = ['OPENAI_API_KEY','GOOGLE_PLACES_API_KEY','REPLICATE_API_TOKEN','SMTP_HOST','SMTP_USER','SMTP_PASS','SMTP_FROM'];

export function checkEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  return { ok: missing.length === 0, missing };
}
