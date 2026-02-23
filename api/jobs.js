// api/jobs.js
// Vercel serverless function that exposes Workday job postings
// and supports CORS so you can call it from Webflow or any other origin.

import { fetchWorkdayJobsPage } from '../workdayClient.js';

function setCorsHeaders(res) {
  // You can tighten this to your Webflow domain if you want:
  // e.g. 'https://travismathew-careers.webflow.io'
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    return res.status(204).end();
  }

  setCorsHeaders(res);

  try {
    const limitParam = req.query?.limit;
    const offsetParam = req.query?.offset;
    const jobSiteId = req.query?.jobSite;

    // Workday's max is 100; you said you have ~78 roles,
    // so 100 will comfortably grab everything in one call.
    let requestedLimit = Number(limitParam ?? 50);
    if (!Number.isFinite(requestedLimit) || requestedLimit <= 0) {
      requestedLimit = 50;
    }
    const limit = Math.min(requestedLimit, 100);

    let offset = Number(offsetParam ?? 0);
    if (!Number.isFinite(offset) || offset < 0) {
      offset = 0;
    }

    // Single page call directly to Workday
    const result = await fetchWorkdayJobsPage({
      limit,
      offset,
      jobSiteId,
    });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=120');
    return res.status(200).json({
      data: result.data,
      total: result.total,
    });
  } catch (err) {
    console.error('[api/jobs] Error:', err);
    return res.status(500).json({
      error: 'Failed to fetch Workday jobs',
      details: err.message || String(err),
    });
  }
}
