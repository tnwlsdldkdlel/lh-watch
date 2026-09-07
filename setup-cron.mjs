// GitHub Actions 의 schedule 은 5분 간격을 자주 건너뛴다. Supabase pg_cron 이 직접 호출하게 한다.
//   node setup-cron.mjs
import pg from 'pg';

const { CRON_SECRET, SUPABASE_DB_URL } = process.env;
if (!CRON_SECRET || !SUPABASE_DB_URL) throw new Error('CRON_SECRET / SUPABASE_DB_URL 이 필요하다');

const url = `https://lh-watch-delta.vercel.app/api/snapshot?key=${CRON_SECRET}`;
const client = new pg.Client({ connectionString: SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

await client.query('create extension if not exists pg_cron');
await client.query('create extension if not exists pg_net');

// 같은 이름으로 다시 걸면 기존 것을 지운다.
await client.query(`select cron.unschedule('lh-snapshot') where exists (select 1 from cron.job where jobname = 'lh-snapshot')`);
await client.query(`select cron.schedule('lh-snapshot', '*/5 * * * *', $job$ select net.http_get(url := '${url}', timeout_milliseconds := 25000) $job$)`);

const { rows } = await client.query(`select jobid, schedule, active from cron.job where jobname = 'lh-snapshot'`);
console.log('등록:', rows[0]);
await client.end();
