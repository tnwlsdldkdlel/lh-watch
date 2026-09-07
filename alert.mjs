// 조건이 맞을 때만 ntfy 로 폰에 밀어넣는다. 토픽은 공개 리포에 두면 안 되므로 secret 으로 받는다.
const TOPIC = process.env.NTFY_TOPIC;
const PINNED = '경기군포';

export function checkAlerts(hist, data) {
  const fired = hist.fired ?? {};
  const out = [];

  const pin = data.units.find((u) => u.dong === PINNED);
  const r = pin && pin.quota ? pin.applied / pin.quota : 0;
  const rank = [...data.units].sort((a, b) => b.applied / b.quota - a.applied / a.quota).findIndex((u) => u.dong === PINNED) + 1;

  if (pin && r >= 0.8 && r < 1 && !fired.warn)
    out.push({ key: 'warn', title: `${PINNED} 곧 1:1`, msg: `${r.toFixed(2)}:1 (${pin.applied}/${pin.quota}) · ${rank}위`, tags: 'warning', priority: 4 });

  if (pin && r >= 1 && !fired.over)
    out.push({ key: 'over', title: `${PINNED} 1:1 돌파`, msg: `${r.toFixed(2)}:1 (${pin.applied}/${pin.quota}) · ${rank}위 · 미달 단지 확인 필요`, tags: 'rotating_light', priority: 5 });

  // 막판 갈아타기를 판단할 마지막 기회.
  const left = data.schedule ? (Date.parse(data.schedule.closesAt) - Date.now()) / 3.6e6 : null;
  if (left != null && left > 0 && left <= 3 && !fired.final) {
    const under = [...data.units].filter((u) => u.applied / u.quota < 1).sort((a, b) => a.applied / a.quota - b.applied / b.quota).slice(0, 3);
    out.push({
      key: 'final',
      title: `마감 ${left.toFixed(1)}시간 전`,
      msg: `${PINNED} ${r.toFixed(2)}:1 (${rank}위)\n미달 하위: ${under.map((u) => `${u.dong} ${(u.applied / u.quota).toFixed(2)}`).join(' · ')}`,
      tags: 'alarm_clock',
      priority: 5,
    });
  }

  return out;
}

export async function send(alerts) {
  if (!TOPIC) return console.log('NTFY_TOPIC 없음 — 알림 생략');
  for (const a of alerts) {
    const res = await fetch('https://ntfy.sh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // 한글 제목은 헤더로 못 보낸다. JSON 방식이라야 그대로 간다.
      body: JSON.stringify({ topic: TOPIC, title: a.title, message: a.msg, tags: [a.tags], priority: a.priority }),
    });
    console.log(`알림 [${a.key}] ${res.ok ? '발송' : '실패 ' + res.status}: ${a.title}`);
  }
}
