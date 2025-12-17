// api/jobs.js
// Vercel serverless function that exposes Workday job postings.
// Uses workdayClient.js for single-page and multi-page fetching.

import { fetchWorkdayJobsPage, fetchAllWorkdayJobs } from '../workdayClient.js';

// Usage examples:
//   GET /api/jobs                      -> first 50 jobs (default)
//   GET /api/jobs?limit=100            -> first 100 jobs
//   GET /api/jobs?limit=250            -> first 250 jobs (auto-paginates behind the scenes)
//   GET /api/jobs?jobSite=0f6a8...     -> only that jobSite, up to 50
//   GET /api/jobs?jobSite=0f6a8...&limit=300 -> jobSite-filtered, up to 300 (multi-page)

export default async function handler(req, res) {
  try {
    const limitParam = req.query?.limit;
    const offsetParam = req.query?.offset;
    const jobSiteId = req.query?.jobSite;
    const allParam = req.query?.all;      // if all=true, we auto-paginate

    // "limit" here means "how many jobs total you want back"
    const requestedLimit = Number(limitParam ?? 50) || 50;
    const offset = Number(offsetParam ?? 0) || 0;

    // Per-page size we ask Workday for (capped at 100)
    const pageSize = Math.min(requestedLimit, 100);

    const shouldPaginate =
      requestedLimit > 100 || allParam === 'true';

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
