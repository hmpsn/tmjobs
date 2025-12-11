// workdayClient.js

const TOKEN_URL = process.env.WORKDAY_TOKEN_URL;
const REST_API_ENDPOINT = process.env.WORKDAY_REST_API_ENDPOINT;
const CLIENT_ID = process.env.WORKDAY_CLIENT_ID;
const CLIENT_SECRET = process.env.WORKDAY_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.WORKDAY_REFRESH_TOKEN;

if (!TOKEN_URL || !REST_API_ENDPOINT || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  throw new Error('Missing one or more Workday env vars');
}

/**
 * Get an access token using the refresh token.
 */
async function getAccessToken() {
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
 * Fetch raw job postings from Workday.
 * You can add query params here as needed (filters, etc).
 */
async function fetchWorkdayJobs({ limit = 50, offset = 0 } = {}) {
  const accessToken = await getAccessToken();

  // Build URL like: {REST_API_ENDPOINT}/recruiting/jobPostings?limit=50&offset=0
  const url = new URL(`${REST_API_ENDPOINT.replace(/\/$/, '')}/recruiting/jobPostings`);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Workday jobs error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data;
}

// Example normalizer stub you can customize once you see the payload
function normalizeJob(posting) {
  return {
    id: posting.id,
    title: posting.jobPostingTitle,
    // TODO: map the fields once you see one real posting
  };
}

function normalizeJobsResponse(raw) {
  const items = raw?.data || raw?.jobPostings || raw || [];
  return Array.isArray(items) ? items.map(normalizeJob) : [];
}

module.exports = {
  getAccessToken,
  fetchWorkdayJobs,
  normalizeJobsResponse,
};
