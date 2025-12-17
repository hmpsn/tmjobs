// api/jobs.js
// Vercel serverless function that exposes Workday job postings
// and supports CORS so you can call it from Webflow or any other origin.

import { fetchWorkdayJobsPage, fetchAllWorkdayJobs } from '../workdayClient.js';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // or your Webflow domain instead of *
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
    const allParam = req.query?.all; // if all=true, auto-paginate

    // "limit" here means "how many jobs total you want back"
    const requestedLimit = Number(limitParam ?? 50) || 50;
    const offset = Number(offsetParam ?? 0) || 0;

    // Per-page size we ask Workday for (capped at 100)
    const pageSize = Math.min(requestedLimit, 100);

    const shouldPaginate = requestedLimit > 100 || allParam === 'true';

    let result;

    if (shouldPaginate) {
      // Multi-page mode: gather up to `requestedLimit` jobs via multiple calls
      result = await fetchAllWorkdayJobs({
        pageSize,
        maxJobs: requestedLimit,
        initialOffset: offset,
        jobSiteId,
      });
    } else {
      // Single page is enough
      result = await fetchWorkdayJobsPage({
        limit: pageSize,
        offset,
        jobSiteId,
      });
    }

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
