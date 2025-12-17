// workdayClient.js
// Shared Workday client for getting an access token and fetching job postings.

// Env vars expected (set these in Vercel):
// WORKDAY_TOKEN_URL              e.g. https://wd2-impl-services1.workday.com/ccx/oauth2/tcbrands_preview/token
// WORKDAY_REST_API_ENDPOINT      e.g. https://wd2-impl-services1.workday.com/ccx/api/recruiting/v4/tcbrands_preview
// WORKDAY_CLIENT_ID
// WORKDAY_CLIENT_SECRET
// WORKDAY_REFRESH_TOKEN

const TOKEN_URL = process.env.WORKDAY_TOKEN_URL;
const ENDPOINT = process.env.WORKDAY_REST_API_ENDPOINT;
const CLIENT_ID = process.env.WORKDAY_CLIENT_ID;
const CLIENT_SECRET = process.env.WORKDAY_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.WORKDAY_REFRESH_TOKEN;

if (!TOKEN_URL || !ENDPOINT || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.warn('[workdayClient] Missing one or more Workday env vars.');
}

/**
 * Get an access token using the refresh token.
 */
export async function getAccessToken() {
  if (!TOKEN_URL || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error('Missing Workday OAuth env vars');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Workday token error ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (!json.access_token) {
    throw new Error(`No access_token in token response: ${JSON.stringify(json)}`);
  }

  return json.access_token;
}

/**
 * Fetch job postings from Workday.
 *
 * @param {Object} options
 * @param {number} [options.limit=50]
 * @param {number} [options.offset=0]
 * @param {string} [options.jobSiteId] - if provided, filter results by jobSite.id in Node
 * @returns {Promise<{ data: any[], total: number, raw: any }>}
 */
export async function fetchWorkdayJobs({ limit = 50, offset = 0, jobSiteId } = {}) {
  if (!ENDPOINT) {
    throw new Error('Missing WORKDAY_REST_API_ENDPOINT env var');
  }

  const accessToken = await getAccessToken();

  // ENDPOINT should be like:
  //   https://wd2-impl-services1.workday.com/ccx/api/recruiting/v4/tcbrands_preview
  const base = ENDPOINT.replace(/\/$/, '');
  const jobsUrl = new URL(`${base}/jobPostings`);

  jobsUrl.searchParams.set('limit', String(limit));
  jobsUrl.searchParams.set('offset', String(offset));

  const res = await fetch(jobsUrl.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Workday jobs error ${res.status}: ${text}`);
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Failed to parse Workday jobs JSON: ${e.message || e}`);
  }

  // Normalize to an array; different tenants sometimes wrap differently
  const items =
    Array.isArray(json) ? json :
    Array.isArray(json.data) ? json.data :
    Array.isArray(json.jobPostings) ? json.jobPostings :
    [];

  const filtered = jobSiteId
    ? items.filter(p => p.jobSite?.id === jobSiteId)
    : items;

  return {
    data: filtered,
    total: filtered.length,
    raw: json,
  };
}
