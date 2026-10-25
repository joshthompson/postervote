import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Safety net for the tally (see tally.ts): starts it for a new active collection and restarts it
// if a scheduled run was lost. Normally votes schedule the runs themselves.
crons.hourly('check tally', { minuteUTC: 7 }, internal.tally.ensure, {});

export default crons;
