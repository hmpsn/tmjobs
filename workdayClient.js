// lib/workdayClient.js

const {
  WORKDAY_CLIENT_ID,
  WORKDAY_CLIENT_SECRET,
  WORKDAY_REFRESH_TOKEN,
  WORKDAY_TENANT,
  WORKDAY_JOBS_BASE_URL,
} = process.env;

// Default tenant is now *tcbrands* (prod)
const TENANT = WORKDAY_TENANT || 'tcbrands';

// OAuth token URL for the tenant
const TOKEN_URL = `https://wd2-impl-services1.workday.com/ccx/oauth2/${TENANT}/token`;

// Job postings base URL for the tenant
const JOBS_URL =
  WORKDAY_JOBS_BASE_URL ||
  `https://wd2-impl-services1.workday.com/ccx/api/recruiting/v4/${TENANT}/jobPostings`;

async function getAccessToken() {
  if (!WORKDAY_CLIENT_ID || !WORKDAY_CLIENT_SECRET || !WORKDAY_REFRESH_TOKEN) {
    throw new Error(
      'Missing Workday credentials. Ensure WORKDAY_CLIENT_ID, WORKDAY_CLIENT_SECRET, and WORKDAY_REFRESH_TOKEN are set.'
    );
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('client_id', WORKDAY_CLIENT_ID);
  params.append('client_secret', WORKDAY_CLIENT_SECRET);
  params.append('refresh_token', WORKDAY_REFRESH_TOKEN);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token request failed: ${res.status} ${body}`);
  }

  const data = await res.json();

  if (!data.access_token) {
    throw new Error('Token response did not include access_token');
  }

  return data.access_token;
}

async function fetchJobs(query = {}) {
  const accessToken = await getAccessToken();

  const url = new URL(JOBS_URL);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Workday jobs request failed: ${res.status} ${body}`
    );
  }

  return res.json();
}

module.exports = { fetchJobs };
