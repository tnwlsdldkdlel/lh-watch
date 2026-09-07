import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from './lh-core.mjs';
import { dedupe, label, tally, median } from './parse-past.mjs';

const row = (si, q, a, btn) =>
  `<tr><td>매입다가구(${si})</td><td></td><td>지도</td><td>홍보물</td><td></td><td></td><td>${q}</td><td>${a}</td><td>${btn}</td></tr>`;

const html = (...rows) => `<table><caption>공급정보 : 지자체명</caption>
  <tr><th>지자체명</th><th>주택정보</th><th>주택유형</th><th>공급호수</th><th>모집인원</th><th>신청건수</th><th>인터넷청약</th></tr>
  <tr><td>합계</td><td></td><td>26</td><td>1,200</td></tr>
  ${rows.join('')}</table>
  <table><tr><th>지자체명</th><th>동주소</th></tr>
  <tr><td>경기도</td><td>수원권선</td></tr><tr><td>경기도</td><td>경기성남</td></tr></table>`;

test('마감 공고도 신청건수를 읽는다', () => {
  const d = parse(html(row('경기수원시', 6, 138, '청약신청마감'), row('경기성남시', 20, 62, '청약신청마감')));
  assert.deepEqual(d.total, { quota: 26, applied: 1200 }); // 천 단위 쉼표
  assert.deepEqual(d.units[0], { sido: '경기도', dong: '수원권선', si: '경기수원시', quota: 6, applied: 138 });
});

test('접수중 공고는 그대로 읽는다', () => {
  const d = parse(html(row('경기수원시', 6, 138, '청약신청하기'), row('경기성남시', 20, 62, '청약신청전')));
  assert.equal(d.units.length, 2);
  assert.equal(d.units[1].si, '경기성남시');
});

test('정정공고는 같은 회차로 합친다', () => {
  const rows = [
    { name: '[경기남부] 25년 1차 A', ed: '2025.04.09' },
    { name: '[정정공고][경기남부] 25년 1차 A', ed: '2025.04.09' },
    { name: '[경기남부] 25년 1차 A', ed: '2025.07.09' },
  ];
  assert.equal(dedupe(rows).length, 2);
});

test('차수가 없는 공고명은 마감일로 라벨을 만든다', () => {
  assert.equal(label({ name: '[경기남부] 25년 1차 A', ed: '2025.04.09' }), '25년 1차');
  assert.equal(label({ name: '[경기남부] A', ed: '2026.07.15' }), '26.07');
});

test('같은 지자체의 여러 단지를 합산한다', () => {
  const m = tally([
    { si: '경기수원시', quota: 6, applied: 138 },
    { si: '경기수원시', quota: 4, applied: 20 },
    { si: '경기성남시', quota: 20, applied: 62 },
  ]);
  assert.deepEqual(m['경기수원시'], { q: 10, a: 158 });
  assert.deepEqual(m['경기성남시'], { q: 20, a: 62 });
});

test('중앙값은 짝수 개일 때 가운데 둘을 평균한다', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});
