const BASE = 'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// 목록에서 공고 링크의 data-id1~4 = panId / ccrCnntSysDsCd / uppAisTpCd / aisTpCd
export const DEFAULT_PAN = {
  name: '[경기남부] 신혼·신생아 매입임대주택Ⅱ(전세형)',
  panId: '2015122300020690',
  ccrCnntSysDsCd: '03',
  uppAisTpCd: '13',
  aisTpCd: '26',
};

const cells = (tr) =>
  [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) =>
    m[1].replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(),
  );

function tablesAfter(html, marker, count) {
  const i = html.indexOf(marker);
  if (i < 0) return [];
  const out = [];
  let p = html.lastIndexOf('<table', i);
  for (let n = 0; n < count && p >= 0; n++) {
    const end = html.indexOf('</table>', p);
    out.push([...html.slice(p, end).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => cells(m[1])));
    p = html.indexOf('<table', end);
  }
  return out;
}

export async function fetchDetail(pan = DEFAULT_PAN) {
  // 상세는 POST 전용이고, 세션 쿠키가 없으면 오류 페이지가 온다. 목록을 먼저 태워 JSESSIONID 를 받는다.
  const list = await fetch(`${BASE}/selectWrtancList.do?mi=1026`, { headers: { 'User-Agent': UA } });
  const cookie = (list.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  const { name, ...ids } = pan;
  const res = await fetch(`${BASE}/selectWrtancInfo.do`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${BASE}/selectWrtancList.do?mi=1026`,
      cookie,
    },
    body: new URLSearchParams({ mi: '1026', ...ids }).toString(),
  });
  return res.text();
}

export function parse(html) {
  const [numTable, nameTable] = tablesAfter(html, '공급정보 : 지자체명', 2);
  if (!numTable || !nameTable) return null;

  const units = numTable
    .filter((c) => c.includes('청약신청하기') || c.includes('청약신청전'))
    .map((c) => c.filter((x) => /^[\d,]+$/.test(x)).map((x) => +x.replace(/,/g, '')))
    .map(([quota, applied]) => ({ quota, applied }));

  const names = nameTable.slice(1).map(([sido, dong]) => ({ sido, dong }));
  const total = numTable.find((c) => c[0] === '합계')?.filter((x) => /^[\d,]+$/.test(x)) ?? [];
  if (!units.length) return null;

  return {
    total: { quota: +total[0], applied: +total[1] },
    units: units.map((u, i) => ({ ...names[i], ...u })),
  };
}

// 접수기간은 <label> 이 비어 있고 인라인 스크립트 변수로 채워진다.
export function parseSchedule(html) {
  const vars = Object.fromEntries([...html.matchAll(/(sbscAcp\w+)\s*=\s*'([^']*)'/g)].map((m) => [m[1], m[2]]));
  const [from, to, fromHm, toHm] = ['sbscAcpStDt', 'sbscAcpClsgDt', 'sbscAcpStHm', 'sbscAcpClsgHm'].map((k) => vars[k] ?? '');
  if (!to) return null;
  const iso = (d, hm) => `${d.replace(/\./g, '-')}T${hm || '00:00'}:00+09:00`;
  return { from: `${from} ${fromHm}`.trim(), to: `${to} ${toHm}`.trim(), closesAt: iso(to, toHm) };
}

export async function snapshot(pan = DEFAULT_PAN) {
  const html = await fetchDetail(pan);
  const data = parse(html);
  if (!data) throw new Error('파싱 실패 — 공고가 마감됐거나 페이지 구조가 바뀌었다.');
  return { ...data, name: pan.name, schedule: parseSchedule(html), at: new Date().toISOString() };
}
