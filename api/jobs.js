// api/jobs.js

// Vercel Node function (no Next.js required)

export default async function handler(req, res) {
  try {
    const tokenUrl = process.env.WORKDAY_TOKEN_URL;
    const endpoint = process.env.WORKDAY_REST_API_ENDPOINT;
    const clientId = process.env.WORKDAY_CLIENT_ID;
    const clientSecret = process.env.WORKDAY_CLIENT_SECRET;
    const refreshToken = process.env.WORKDAY_REFRESH_TOKEN;

    if (!tokenUrl || !endpoint || !clientId || !clientSecret || !refreshToken) {
      return res.status(500).json({ error: 'Missing Workday env vars' });
    }

    // Allow limit/offset via query, defaulting nicely
    const limit = Number((req.query && req.query.limit) || 50);
    const offset = Number((req.query && req.query.offset) || 0);

    // 1) Get access token from refresh token
    const tokenBody = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenBody.toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error('Workday token error:', tokenRes.status, text);
      return res
        .status(500)
        .json({ error: 'Failed to get Workday access token', details: text });
    }

    const tokenJson = await tokenRes.json();
    const accessToken = tokenJson.access_token;

    if (!accessToken) {
      console.error('No access_token in token response:', tokenJson);
      return res
        .status(500)
        .json({ error: 'No access_token in Workday token response', details: tokenJson });
    }

    // 2) Call jobPostings endpoint
    const base = endpoint.replace(/\/$/, ''); // strip trailing slash if any
    const jobsUrl = new URL(`${base}/jobPostings`);
    jobsUrl.searchParams.set('limit', String(limit));
    jobsUrl.searchParams.set('offset', String(offset));
    if (req.query && req.query.jobSite) {
  jobsUrl.searchParams.set('jobSite', String(req.query.jobPostingSite));
}

    const jobsRes = await fetch(jobsUrl.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    const jobsText = await jobsRes.text(); // read as text first for easier debugging

    if (!jobsRes.ok) {
      console.error('Workday jobs error:', jobsRes.status, jobsText);
      return res
        .status(500)
        .json({ error: 'Failed to fetch Workday jobs', status: jobsRes.status, body: jobsText });
    }

// If OK, try to parse JSON
let jobsJson;
try {
  jobsJson = JSON.parse(jobsText);
} catch (e) {
  console.error('Failed to parse jobs JSON:', e, jobsText);
  return res
    .status(500)
    .json({ error: 'Invalid JSON from Workday jobs endpoint', body: jobsText });
}

// --- Filter for TravisMathew-Careers URLs ----------------------------------
const TRAVIS_URL_SUBSTRING = 'TravisMathew-Careers';

// Depending on how Workday structures the response, it might be:
//   { data: [ ...postings ] } or { jobPostings: [ ... ] } or just [ ... ].
// So we normalize to an array first:
const items =
  Array.isArray(jobsJson)        ? jobsJson
  : Array.isArray(jobsJson.data) ? jobsJson.data
  : Array.isArray(jobsJson.jobPostings) ? jobsJson.jobPostings
  : [];

const filtered = items.filter(posting => {
  // Adjust these keys once you confirm which one has the public URL
  const url =
    posting.externalUrl ||
    posting.jobPostingUrl ||
    posting.jobPostingDetails?.externalUrl ||
    '';

  return typeof url === 'string' && url.includes(TRAVIS_URL_SUBSTRING);
});

// If you want to keep structure consistent (e.g. { data: [...] }), wrap it:
return res.status(200).json({
  data: filtered,
  total: filtered.length,
});
  } catch (err) {
    console.error('Unexpected error in /api/jobs:', err);
    return res.status(500).json({ error: 'Unexpected error', details: String(err) });
  }
}
