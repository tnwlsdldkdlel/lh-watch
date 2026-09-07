// 조건이 맞을 때만 ntfy 로 폰에 밀어넣는다. 토픽은 공개 리포에 두면 안 되므로 secret 으로 받는다.
const TOPIC = process.env.NTFY_TOPIC;
const PINNED = '경기군포';
const DIGEST_MS = 3.6e6;

const rate = (u) => (u.quota ? u.applied / u.quota : 0);
const fmt = (u) => `${u.dong} ${rate(u).toFixed(2)}`;

export function checkAlerts(hist, data) {
  const out = [];
  const closed = data.schedule && Date.parse(data.schedule.closesAt) <= Date.now();
  if (closed) return out;

  const ranked = [...data.units].sort((a, b) => rate(b) - rate(a));
  const pin = data.units.find((u) => u.dong === PINNED);
  const r = pin ? rate(pin) : 0;
  const rank = ranked.findIndex((u) => u.dong === PINNED) + 1;

  if (pin) {
    const before = hist.lastPin;
    // 첫 실행은 기준점만 잡는다. 안 그러면 여태 쌓인 건수를 증가로 착각해 알린다.
    if (before == null) {
      out.push({ state: { lastPin: pin.applied } });
    } else if (pin.applied > before) {
      const crossed = before / pin.quota < 1 && r >= 1;
      out.push({
        title: crossed ? `${PINNED} 1:1 돌파` : `${PINNED} +${pin.applied - before}명`,
        msg: `총 ${pin.applied}명 / 모집 ${pin.quota}명 · ${r.toFixed(2)}:1 · ${rank}위/${ranked.length}`,
        tags: [crossed ? 'rotating_light' : 'bell'],
        priority: crossed ? 5 : 4,
        state: { lastPin: pin.applied },
      });
    }
  }

  const since = hist.lastDigest ? Date.now() - Date.parse(hist.lastDigest) : Infinity;
  if (since >= DIGEST_MS) {
    const top = ranked.slice(0, 3).map(fmt).join(' · ');
    // 단지가 6개 이하면 상·하위가 겹친다. 같은 단지를 양쪽에 적지 않는다.
    const bottom = ranked.slice(Math.max(3, ranked.length - 3)).reverse().map(fmt).join(' · ');
    out.push({
      title: `현황 · 전체 ${(data.total.applied / data.total.quota).toFixed(2)}:1`,
      msg: `상위  ${top}\n하위  ${bottom}\n${PINNED}  ${r.toFixed(2)}:1 (${rank}위/${ranked.length})`,
      tags: ['bar_chart'],
      priority: 3,
      state: { lastDigest: data.at },
    });
  }

  // 막판 갈아타기를 판단할 마지막 기회.
  const left = data.schedule ? (Date.parse(data.schedule.closesAt) - Date.now()) / 3.6e6 : null;
  if (left != null && left > 0 && left <= 3 && !hist.fired?.final) {
    const under = ranked.filter((u) => rate(u) < 1).slice(-3).reverse();
    out.push({
      title: `마감 ${left.toFixed(1)}시간 전`,
      msg: `${PINNED} ${r.toFixed(2)}:1 (${rank}위)\n미달 하위: ${under.map(fmt).join(' · ')}`,
      tags: ['alarm_clock'],
      priority: 5,
      state: { fired: { ...hist.fired, final: data.at } },
    });
  }

  return out;
}

export async function send(alerts) {
  const real = alerts.filter((a) => a.title);
  if (!real.length) return;
  if (!TOPIC) return console.log('NTFY_TOPIC 없음 — 알림 생략');

  for (const a of real) {
    const res = await fetch('https://ntfy.sh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // 한글 제목은 헤더로 못 보낸다. JSON 방식이라야 그대로 간다.
      body: JSON.stringify({ topic: TOPIC, title: a.title, message: a.msg, tags: a.tags, priority: a.priority }),
    });
    console.log(`알림 ${res.ok ? '발송' : '실패 ' + res.status}: ${a.title}`);
  }
}
