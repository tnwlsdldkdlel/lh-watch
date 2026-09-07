// 같은 유형의 지난 공고를 긁어 지자체별 경쟁률 이력을 굽는다.
// 공고 차수가 바뀔 때만 돌리면 되므로 런타임 의존성은 만들지 않는다.
//   node parse-past.mjs [지역키워드] [유형정규식]
import { writeFileSync } from 'node:fs';
import { fetchDetail, parse } from './lh-core.mjs';

const region = process.argv[2] ?? '경기남부';
const kind = new RegExp(process.argv[3] ?? '신혼.*(Ⅱ|II|전세형)');
const YEARS = 3;

const BASE = 'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// 목록은 GET 으로는 기간을 못 걸어서 검색 폼을 그대로 POST 한다.
async function search(year) {
  const list = await fetch(`${BASE}/selectWrtancList.do?mi=1026`, { headers: { 'User-Agent': UA } });
  const cookie = (list.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  const body = new URLSearchParams({
    mi: '1026', currPage: '1', listCo: '50', prevListCo: '50',
    srchUppAisTpCd: '061339', uppAisTpCd: '061339', aisTpCd: '',
    panSs: '', mvinQf: '', cnpCd: '', viewType: '', srchY: 'N', xssChk: 'N',
    panStDt: `${year}0101`, panEdDt: `${year}1231`,
    startDt: `${year}-01-01`, endDt: `${year}-12-31`,
    panNm: region,
  });
  const html = await (await fetch(`${BASE}/selectWrtancList.do`, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${BASE}/selectWrtancList.do?mi=1026`, cookie },
    body: body.toString(),
  })).text();

  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].flatMap(([, tr]) => {
    const id = tr.match(/data-id1="(\d{16})"[^>]*data-id2="(\d*)"[^>]*data-id3="(\d*)"[^>]*data-id4="(\d*)"/);
    if (!id) return [];
    const t = tr.replace(/<[^>]*>/g, '|').split('|').map((s) => s.trim()).filter(Boolean);
    return [{ panId: id[1], ccrCnntSysDsCd: id[2], uppAisTpCd: id[3], aisTpCd: id[4], name: t[2], ed: t[7] }];
  });
}

// 정정공고는 같은 회차를 한 번 더 띄우고 숫자는 같다.
export const dedupe = (rows) =>
  rows.filter((r, i, a) => a.findIndex((x) => x.name.replace('[정정공고]', '') + x.ed === r.name.replace('[정정공고]', '') + r.ed) === i);

export const label = ({ name, ed }) => name.match(/(\d{2})년\s*(\d)차/)?.[0].replace(/\s+/, ' ') ?? ed.slice(2, 7);

export function tally(units) {
  const m = {};
  for (const u of units) {
    (m[u.si] ??= { q: 0, a: 0 });
    m[u.si].q += u.quota;
    m[u.si].a += u.applied;
  }
  return m;
}

if (process.argv[1]?.endsWith('parse-past.mjs')) {
  const thisYear = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  const found = [];
  for (let y = thisYear - YEARS + 1; y <= thisYear; y++) found.push(...(await search(y)));

  const rounds = dedupe(found.filter((r) => kind.test(r.name) && r.ed < today)).sort((a, b) => a.ed.localeCompare(b.ed));

  const si = {};
  const labels = [];
  for (const r of rounds) {
    const data = parse(await fetchDetail(r));
    if (!data?.units.length) { console.warn(`  건너뜀 — ${r.name}`); continue; }
    const i = labels.push({ label: label(r), ed: r.ed }) - 1;
    for (const [name, v] of Object.entries(tally(data.units))) (si[name] ??= [])[i] = v;
    await new Promise((r) => setTimeout(r, 300)); // 연속 조회로 세션을 흔들지 않는다
  }
  for (const v of Object.values(si)) v.length = labels.length;

  writeFileSync('past.json', JSON.stringify({ region, rounds: labels, si }));

  console.log(`${region} · 회차 ${labels.length}개 · 지자체 ${Object.keys(si).length}곳`);
  for (const [name, v] of Object.entries(si)) {
    const r = v.filter(Boolean);
    console.log(`  ${name.padEnd(8)} ${String(r.length).padStart(2)}회 · 중앙 ${median(r.map((x) => x.a / x.q)).toFixed(1)}:1`);
  }
}

export function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}
