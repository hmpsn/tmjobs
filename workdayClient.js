// workdayClient.js

const TOKEN_URL = process.env.WORKDAY_TOKEN_URL;
const CLIENT_ID = process.env.WORKDAY_CLIENT_ID;
const CLIENT_SECRET = process.env.WORKDAY_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.WORKDAY_REFRESH_TOKEN;
const JOBS_BASE_URL = process.env.WORKDAY_JOBS_BASE_URL;

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
  });

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token request failed: ${resp.status} ${text}`);
  }

  const json = await resp.json();
  const expiresIn = json.expires_in ?? 3600;
  cachedToken = json.access_token;
  tokenExpiresAt = Date.now() + (expiresIn - 300) * 1000;
  return cachedToken;
}

export async function fetchWorkdayJobsPage({ limit = 50, offset = 0, jobSiteId } = {}) {
  const token = await getAccessToken();

  const url = new URL(JOBS_BASE_URL);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  if (jobSiteId) {
    url.searchParams.set('jobSite', jobSiteId);
  }

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

  const text = await resp.text();

  if (!resp.ok) {
    throw new Error(`Workday jobs request failed: ${resp.status} ${text}`);
  }

  const json = JSON.parse(text);
  const data = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
  const total = json.total ?? json.count ?? data.length;

  return { data, total };
}
