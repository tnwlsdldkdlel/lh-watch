import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DEFAULT_PAN, snapshot } from './lh-core.mjs';

const FILE = 'data/history.json';
const KEEP = 3000;

// 단지명을 스냅샷마다 반복하면 파일이 금방 커진다. 이름은 한 번만 두고 값은 인덱스로 맞춘다.
let hist = { pan: DEFAULT_PAN.name, names: [], snaps: [] };
try {
  hist = JSON.parse(readFileSync(FILE, 'utf8'));
} catch {}

const data = await snapshot();

for (const u of data.units) if (!hist.names.includes(u.dong)) hist.names.push(u.dong);

const quotas = hist.names.map((n) => data.units.find((u) => u.dong === n)?.quota ?? 0);
const applied = hist.names.map((n) => data.units.find((u) => u.dong === n)?.applied ?? null);

const last = hist.snaps.at(-1);
const same = last && last.a === data.total.applied && String(last.u) === String(applied);

if (same) {
  console.log(`변화 없음 (합계 ${data.total.applied}) — 기록 생략`);
  process.exit(0);
}

hist.quotas = quotas;
hist.totalQuota = data.total.quota;
hist.schedule = data.schedule;
hist.snaps.push({ t: data.at, a: data.total.applied, u: applied });
hist.snaps = hist.snaps.slice(-KEEP);

mkdirSync('data', { recursive: true });
writeFileSync(FILE, JSON.stringify(hist));
console.log(`기록 ${hist.snaps.length}개 — 합계 ${data.total.applied}/${data.total.quota}`);
