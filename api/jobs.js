// api/jobs.js
// Vercel serverless function that exposes Workday job postings.
// Relies on workdayClient.js in the project root.

import { fetchWorkdayJobs } from '../workdayClient.js';

// Usage examples:
//   GET /api/jobs
//   GET /api/jobs?limit=50&offset=0
//   GET /api/jobs?jobSite=0f6a837537ec1041c0b87fe65b930001

export default async function handler(req, res) {
  try {
    const limit = Number(req.query?.limit ?? 50);
    const offset = Number(req.query?.offset ?? 0);
    const jobSiteId = req.query?.jobSite; // this is the jobSite.id (e.g. 0f6a8375...)

    const result = await fetchWorkdayJobs({ limit, offset, jobSiteId });

    // Return a clean shape for the frontend:
    // data: array of postings
    // total: count
    // (raw is available if you want to debug, but we don't return it here)
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
