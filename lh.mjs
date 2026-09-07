import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { DEFAULT_PAN, snapshot } from './lh-core.mjs';

const CSV = new URL('./log.csv', import.meta.url).pathname.slice(1);
const rate = (a, q) => (q ? (a / q).toFixed(2) : '0.00');
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const hot = (s) => `\x1b[1;33m${s}\x1b[0m`;

let prev = new Map();

async function tick() {
  let data;
  try {
    data = await snapshot();
  } catch (e) {
    console.error(e.message);
    return;
  }

  const now = new Date();
  const ts = now.toTimeString().slice(0, 8);
  const day = now.toISOString().slice(0, 10);

  // 엑셀은 BOM 없는 UTF-8 을 CP949 로 읽어 한글이 깨진다.
  if (!existsSync(CSV)) writeFileSync(CSV, '\uFEFF시각,지역,단지,모집인원,신청건수,경쟁률\n');

  const rows = [{ dong: '합계', sido: '', ...data.total }, ...data.units];
  const changed = rows.filter((u) => prev.get(u.dong) !== u.applied);
  const first = prev.size === 0;

  // 엑셀이 csv 를 열어두면 쓰기가 잠긴다. 기록 실패로 조회까지 죽이지는 않는다.
  try {
    for (const u of rows) appendFileSync(CSV, `${day} ${ts},${u.sido},${u.dong},${u.quota},${u.applied},${rate(u.applied, u.quota)}\n`);
  } catch {
    console.log(dim(`${ts}  csv 기록 실패 — 엑셀에서 log.csv 를 닫으세요`));
  }

  if (!changed.length) return console.log(dim(`${ts}  변화 없음 (합계 ${data.total.applied}건)`));

  console.log(`\n${ts}  합계 ${data.total.applied}/${data.total.quota}  ${rate(data.total.applied, data.total.quota)}:1`);
  for (const u of (first ? rows.slice(1) : changed).sort((a, b) => b.applied / b.quota - a.applied / a.quota)) {
    const delta = first ? '' : ` (+${u.applied - (prev.get(u.dong) ?? 0)})`;
    const r = rate(u.applied, u.quota);
    const line = `  ${u.dong.padEnd(10)} 모집 ${String(u.quota).padStart(4)}  신청 ${String(u.applied).padStart(4)}${delta.padEnd(6)} ${r.padStart(5)}:1`;
    console.log(+r >= 1 ? hot(line) : line);
  }
  if (!first) process.stdout.write('\x07'); // 변화 있을 때만 소리 — 배치는 안 쳐다보려고 돌리는 것
  for (const u of rows) prev.set(u.dong, u.applied);
}

const min = Number(process.argv[2]);
console.log(`${DEFAULT_PAN.name}${min ? ` — ${min}분마다 (Ctrl+C 종료)` : ''}`);
await tick();
if (min) setInterval(tick, min * 60_000);
