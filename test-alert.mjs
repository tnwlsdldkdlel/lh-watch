import assert from 'node:assert';
import { checkAlerts } from './alert.mjs';

const units = (gunpo) => [
  { dong: '경기군포', quota: 20, applied: gunpo },
  { dong: '용인기흥', quota: 6, applied: 30 },
  { dong: '경기시흥', quota: 16, applied: 1 },
  { dong: '경기평택', quota: 20, applied: 3 },
];
const far = new Date(Date.now() + 40 * 3.6e6).toISOString();
const data = (gunpo, closesAt = far) => ({
  units: units(gunpo),
  total: { quota: 62, applied: 34 + gunpo },
  schedule: { closesAt },
  at: new Date().toISOString(),
});
const titles = (h, d) => checkAlerts(h, d).map((a) => a.title).filter(Boolean);
const hourAgo = new Date(Date.now() - 3.7e6).toISOString();
const justNow = new Date().toISOString();

// 첫 실행은 기준점만 잡고 조용해야 한다.
const first = checkAlerts({ lastDigest: justNow }, data(8));
assert.deepEqual(first.map((a) => a.title).filter(Boolean), []);
assert.equal(first[0].state.lastPin, 8);

// 늘면 증가폭·총원·경쟁률이 담긴 알림 하나.
const inc = checkAlerts({ lastPin: 8, lastDigest: justNow }, data(11));
assert.equal(inc.length, 1);
assert.equal(inc[0].title, '경기군포 +3명');
assert.match(inc[0].msg, /총 11명 \/ 모집 20명 · 0\.55:1/);
assert.equal(inc[0].state.lastPin, 11);

// 안 늘면 조용.
assert.deepEqual(titles({ lastPin: 11, lastDigest: justNow }, data(11)), []);

// 1:1 을 넘는 순간은 제목과 우선순위가 바뀐다 — 별도 알림을 또 보내지 않는다.
const over = checkAlerts({ lastPin: 19, lastDigest: justNow }, data(20));
assert.equal(over.length, 1);
assert.equal(over[0].title, '경기군포 1:1 돌파');
assert.equal(over[0].priority, 5);

// 한 시간 지나면 상·하위 3개 현황.
const dig = checkAlerts({ lastPin: 8, lastDigest: hourAgo }, data(8)).find((a) => a.title?.startsWith('현황'));
assert.match(dig.msg, /상위\s+용인기흥 5\.00/);
assert.match(dig.msg, /경기군포\s+0\.40:1 \(2위\/4\)/);
// 단지가 4개뿐이면 상위 3개를 뺀 나머지만 하위로 — 같은 단지가 양쪽에 나오면 안 된다.
assert.match(dig.msg, /하위\s+경기시흥 0\.06$/m);
const names = (line) => line.split('·').map((s) => s.trim().split(' ')[0]);
const [topNames, botNames] = dig.msg.split('\n').slice(0, 2).map((l) => names(l.replace(/^(상위|하위)\s+/, '')));
assert.deepEqual(topNames.filter((n) => botNames.includes(n)), []);

// 마감 뒤에는 아무것도 안 보낸다.
const past = new Date(Date.now() - 1000).toISOString();
assert.deepEqual(checkAlerts({ lastPin: 1, lastDigest: hourAgo }, data(20, past)), []);

// 마감 3시간 안이면 미달 단지를 붙여 한 번만.
const soon = new Date(Date.now() + 2 * 3.6e6).toISOString();
const fin = checkAlerts({ lastPin: 8, lastDigest: justNow }, data(8, soon)).find((a) => a.title?.startsWith('마감'));
assert.match(fin.msg, /미달 하위: 경기시흥 0\.06/);
assert.deepEqual(titles({ lastPin: 8, lastDigest: justNow, fired: { final: justNow } }, data(8, soon)), []);

console.log('알림 조건 8개 통과');
