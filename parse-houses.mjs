// 공고 첨부의 공급주택목록 xlsx 를 단지별 JSON 으로 굽는다.
// 공고가 바뀔 때만 돌리면 되므로 런타임 의존성은 만들지 않는다.
//   node parse-houses.mjs <fileid>   (기본값은 현재 공고의 주택목록)
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import XLSX from 'xlsx';

const fileId = process.argv[2] ?? '68449227';
const tmp = 'houses.xlsx';

const res = await fetch(`https://apply.lh.or.kr/lhapply/lhFile.do?fileid=${fileId}`, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
});
writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));

const wb = XLSX.readFile(tmp);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });

const num = (v) => (typeof v === 'number' ? v : Number(String(v).replace(/[^\d.]/g, '')) || 0);
const houses = {};

// 머리말이 8행쯤 이어지고 순번이 숫자인 행부터가 실제 목록이다.
for (const r of rows) {
  if (typeof r[0] !== 'number' || !r[2]) continue;
  (houses[String(r[2]).trim()] ??= []).push({
    no: r[0],
    addr: String(r[3] ?? '').trim(),
    ho: String(r[6] ?? '').trim(),
    area: num(r[7]), // 전용면적
    rooms: String(r[10] ?? '').trim(),
    floor: String(r[11] ?? '').trim(),
    type: String(r[13] ?? '').trim(),
    deposit: num(r[16]), // 소득 80% 이하 기본임대조건
    rent: num(r[17]),
  });
}

writeFileSync('houses.json', JSON.stringify(houses));
unlinkSync(tmp);

const total = Object.values(houses).reduce((a, v) => a + v.length, 0);
console.log(`단지 ${Object.keys(houses).length}개 · 매물 ${total}호`);
for (const [k, v] of Object.entries(houses)) console.log(`  ${k.padEnd(8)} ${String(v.length).padStart(3)}호`);
