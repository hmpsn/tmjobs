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
 * Fetch a single page of job postings from Workday.
 * `limit` here is per-page and must not exceed 100 (Workday cap).
 */
export async function fetchWorkdayJobsPage({
  limit = 50,
  offset = 0,
  jobSiteId,
} = {}) {
  if (!ENDPOINT) {
    throw new Error('Missing WORKDAY_REST_API_ENDPOINT env var');
  }

  const cappedLimit = Math.min(Number(limit) || 50, 100);
  const accessToken = await getAccessToken();

  // ENDPOINT should be like:
  //   https://wd2-impl-services1.workday.com/ccx/api/recruiting/v4/tcbrands_preview
  const base = ENDPOINT.replace(/\/$/, '');
  const jobsUrl = new URL(`${base}/jobPostings`);

  jobsUrl.searchParams.set('limit', String(cappedLimit));
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

/**
 * Fetch multiple pages until we have `maxJobs` (or we run out of data).
 *
 * @param {Object} options
 * @param {number} [options.pageSize=100]   - per-page size (capped at 100)
 * @param {number} [options.maxJobs=300]    - max number of jobs to return
 * @param {number} [options.initialOffset=0]
 * @param {string} [options.jobSiteId]
 */
export async function fetchAllWorkdayJobs({
  pageSize = 100,
  maxJobs = 300,
  initialOffset = 0,
  jobSiteId,
} = {}) {
  const cappedPageSize = Math.min(Number(pageSize) || 100, 100);
  const max = Number(maxJobs) || cappedPageSize;

  let offset = Number(initialOffset) || 0;
  const all = [];

  // Safety cap on pages so we don't accidentally loop forever
  const maxPages = Math.ceil(max / cappedPageSize) + 2;
  let pagesFetched = 0;

  while (all.length < max && pagesFetched < maxPages) {
    const page = await fetchWorkdayJobsPage({
      limit: cappedPageSize,
      offset,
      jobSiteId,
    });

    if (!page.data.length) break;

    all.push(...page.data);

    if (page.data.length < cappedPageSize) {
      // Last page reached
      break;
    }

    offset += cappedPageSize;
    pagesFetched += 1;
  }

  if (all.length > max) {
    all.length = max;
  }

  return {
    data: all,
    total: all.length,
  };
}
