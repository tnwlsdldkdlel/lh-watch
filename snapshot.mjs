import { configured } from './db.mjs';
import { runSnapshot } from './runner.mjs';

if (!configured()) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없다');
  process.exit(1);
}

const r = await runSnapshot();
console.log(r.changed ? `기록 — 합계 ${r.applied}/${r.quota}` : `변화 없음 (합계 ${r.applied}) — 기록 생략`);
if (r.alerts.length) console.log('알림:', r.alerts.join(', '));
