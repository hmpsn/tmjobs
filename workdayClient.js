// workdayClient.js

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
const JOBS_URL_BASE =
  WORKDAY_JOBS_BASE_URL ||
  `https://wd2-impl-services1.workday.com/ccx/api/recruiting/v4/${TENANT}/jobPostings`;

async function getAccessToken() {
  if (!WORKDAY_CLIENT_ID || !WORKDAY_CLIENT_SECRET || !WORKDAY_REFRESH_TOKEN) {
    throw new Error(
      'Missing Workday credentials. Ensure WORKDAY_CLIENT_ID, WORKDAY_CLIENT_SECRET, and WORKDAY_REFRESH_TOKEN are set.'
    );
  }

  const body = new URLSearchParams();
  body.append('grant_type', 'refresh_token');
  body.append('client_id', WORKDAY_CLIENT_ID);
  body.append('client_secret', WORKDAY_CLIENT_SECRET);
  body.append('refresh_token', WORKDAY_REFRESH_TOKEN);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token request failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  if (!json.access_token) {
    throw new Error('Token response did not include access_token');
  }

  return json.access_token;
}

/**
 * Fetch a single page of jobs from Workday
 * Returns { data, total }
 */
export async function fetchWorkdayJobsPage({
  limit = 50,
  offset = 0,
  jobSiteId,
} = {}) {
  const accessToken = await getAccessToken();

  const url = new URL(JOBS_URL_BASE);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  if (jobSiteId) {
    url.searchParams.set('jobSite', jobSiteId);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Workday jobs request failed: ${res.status} ${text}`);
  }

  const json = await res.json();

  // Workday sometimes wraps data, sometimes returns array.
  let data;
  let total;

  if (Array.isArray(json)) {
    data = json;
    total = json.length;
  } else if (Array.isArray(json.data)) {
    data = json.data;
    total =
      typeof json.total === 'number'
        ? json.total
        : typeof json.count === 'number'
        ? json.count
        : json.data.length;
  } else {
    data = [];
    total = 0;
  }

  return { data, total };
}

/**
 * Fetch multiple pages until we hit maxJobs or run out.
 */
export async function fetchAllWorkdayJobs({
  pageSize = 100,
  maxJobs = 500,
  initialOffset = 0,
  jobSiteId,
} = {}) {
  let all = [];
  let offset = initialOffset;
  let total = null;

  while (all.length < maxJobs) {
    const remaining = maxJobs - all.length;
    const limit = Math.min(pageSize, remaining);

    const { data, total: pageTotal } = await fetchWorkdayJobsPage({
      limit,
      offset,
      jobSiteId,
    });

    if (total == null) {
      total = pageTotal ?? data.length;
    }

    if (!data.length) {
      break;
    }

    all = all.concat(data);
    offset += data.length;

    // Safety: if Workday total is known, stop once we've seen everything
    if (total != null && offset >= total) {
      break;
    }

    // Safety: if we got less than we asked for, probably last page
    if (data.length < limit) {
      break;
    }
  }

  return { data: all, total: total ?? all.length };
}
