import { DEFAULT_PAN, snapshot } from './lh-core.mjs';
import { checkAlerts, send } from './alert.mjs';
import { configured, getState, insertSnapshot, latestSnapshot, saveState } from './db.mjs';

if (!configured()) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없다');
  process.exit(1);
}

const panId = DEFAULT_PAN.panId;
const data = await snapshot();

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
const changed =
  !row || row.total_applied !== data.total.applied || JSON.stringify(row.units) !== JSON.stringify(data.units);

if (!changed) {
  console.log(`변화 없음 (합계 ${data.total.applied}) — 기록 생략`);
  process.exit(0);
}

await insertSnapshot(panId, data);
console.log(`기록 — 합계 ${data.total.applied}/${data.total.quota}`);
