import { DEFAULT_PAN, snapshot } from './lh-core.mjs';
import { checkAlerts, send } from './alert.mjs';
import { getState, insertSnapshot, latestSnapshot, saveState } from './db.mjs';

// CLI(snapshot.mjs)와 서버리스(api/snapshot.js)가 같은 절차를 쓴다.
export async function runSnapshot(pan = DEFAULT_PAN) {
  const panId = pan.panId;
  const data = await snapshot(pan);

  const [row, state] = await Promise.all([latestSnapshot(panId), getState(panId)]);
  const hist = { lastPin: state.last_pin ?? null, lastDigest: state.last_digest ?? null, fired: state.fired ?? {} };

  // 값이 안 변해도 시간 조건(정시 현황·마감 임박)은 걸리므로 기록 여부와 무관하게 먼저 본다.
  const alerts = checkAlerts(hist, data);
  await send(alerts);
  for (const a of alerts) Object.assign(hist, a.state);
  if (alerts.length) {
    await saveState({ pan_id: panId, last_pin: hist.lastPin, last_digest: hist.lastDigest, fired: hist.fired });
  }

  // 같은 값을 5분마다 쌓으면 조회만 무거워진다.
  // jsonb 는 객체 키 순서를 보존하지 않아 JSON.stringify 로 비교하면 항상 달라진다.
  const fingerprint = (units) => units.map((u) => `${u.dong}:${u.applied}`).sort().join('|');
  const changed = !row || row.total_applied !== data.total.applied || fingerprint(row.units) !== fingerprint(data.units);

  if (changed) await insertSnapshot(panId, data);

  return { applied: data.total.applied, quota: data.total.quota, changed, alerts: alerts.filter((a) => a.title).map((a) => a.title) };
}
