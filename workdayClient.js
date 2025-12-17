// api/jobs.js

// Vercel serverless function to proxy Workday job postings.
// Usage examples:
//   GET /api/jobs
//   GET /api/jobs?limit=50&offset=0
//   GET /api/jobs?jobSite=0f6a837537ec1041c0b87fe65b930001

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

    // Query params from the request
    const limit = Number(req.query?.limit ?? 50);
    const offset = Number(req.query?.offset ?? 0);
    const requestedJobSiteId = req.query?.jobSite; // e.g. 0f6a8375...

    // ─────────────────────────────────────────────────────────────
    // 1) Get access token using refresh token
    // ─────────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────
    // 2) Call jobPostings endpoint (NO jobSite param here)
    //    WORKDAY_REST_API_ENDPOINT should be:
    //    https://wd2-impl-services1.workday.com/ccx/api/recruiting/v4/tcbrands_preview
    //    so we hit {base}/jobPostings
    // ─────────────────────────────────────────────────────────────
    const base = endpoint.replace(/\/$/, '');
    const jobsUrl = new URL(`${base}/jobPostings`);

    jobsUrl.searchParams.set('limit', String(limit));
    jobsUrl.searchParams.set('offset', String(offset));

    console.log('Calling Workday URL:', jobsUrl.toString());

    const jobsRes = await fetch(jobsUrl.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    const jobsText = await jobsRes.text();

    if (!jobsRes.ok) {
      console.error('Workday jobs error:', jobsRes.status, jobsText);
      return res.status(500).json({
        error: 'Failed to fetch Workday jobs',
        status: jobsRes.status,
        body: jobsText,
      });
    }

    let jobsJson;
    try {
      jobsJson = JSON.parse(jobsText);
    } catch (e) {
      console.error('Failed to parse jobs JSON:', e, jobsText);
      return res.status(500).json({
        error: 'Invalid JSON from Workday jobs endpoint',
        body: jobsText,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 3) Normalize to an array + apply jobSite filter in Node
    // ─────────────────────────────────────────────────────────────
    const items =
      Array.isArray(jobsJson) ? jobsJson :
      Array.isArray(jobsJson.data) ? jobsJson.data :
      Array.isArray(jobsJson.jobPostings) ? jobsJson.jobPostings :
      [];

    const filtered = requestedJobSiteId
      ? items.filter(p => p.jobSite?.id === requestedJobSiteId)
      : items;

    return res.status(200).json({
      data: filtered,
      total: filtered.length,
    });
  } catch (err) {
    console.error('Unexpected error in /api/jobs:', err);
    return res.status(500).json({ error: 'Unexpected error', details: String(err) });
  }
}
