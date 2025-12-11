// pages/api/jobs.js (Next.js example)
import { fetchWorkdayJobs } from '../../workdayClient';

export default async function handler(req, res) {
  try {
    const limit = Number(req.query.limit || 50);
    const offset = Number(req.query.offset || 0);

    const raw = await fetchWorkdayJobs({ limit, offset });

    // Optionally normalize:
    // const jobs = normalizeJobsResponse(raw);
    // res.status(200).json(jobs);

    res.status(200).json(raw);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch Workday jobs' });
  }
}
