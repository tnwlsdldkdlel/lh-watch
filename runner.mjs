import { DEFAULT_PAN, snapshot } from './lh-core.mjs';
import { insertSnapshot, latestSnapshot } from './db.mjs';

// CLI(snapshot.mjs)와 서버리스(api/snapshot.js)가 같은 절차를 쓴다.
export async function runSnapshot(pan = DEFAULT_PAN) {
  const panId = pan.panId;
  const data = await snapshot(pan);
  const row = await latestSnapshot(panId);

  // 같은 값을 5분마다 쌓으면 조회만 무거워진다.
  // jsonb 는 객체 키 순서를 보존하지 않아 JSON.stringify 로 비교하면 항상 달라진다.
  const fingerprint = (units) => units.map((u) => `${u.dong}:${u.applied}`).sort().join('|');
  const changed = !row || row.total_applied !== data.total.applied || fingerprint(row.units) !== fingerprint(data.units);

  if (changed) await insertSnapshot(panId, data);
  return { applied: data.total.applied, quota: data.total.quota, changed };
}
