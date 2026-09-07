// Supabase REST 를 직접 부른다. 쓰는 건 세 가지뿐이라 클라이언트 라이브러리를 넣지 않는다.
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

export const configured = () => Boolean(URL && KEY);

async function rest(path, init = {}) {
  if (!configured()) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없다');
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...init.headers },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`supabase ${res.status}: ${body.slice(0, 200)}`);
  return body ? JSON.parse(body) : null; // 삽입은 201 로 빈 본문이 온다
}

export const insertSnapshot = (panId, data) =>
  rest('snapshots?on_conflict=pan_id,at', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({
      pan_id: panId,
      at: data.at,
      total_quota: data.total.quota,
      total_applied: data.total.applied,
      units: data.units,
    }),
  });

export const latestSnapshot = async (panId) =>
  (await rest(`snapshots?pan_id=eq.${panId}&order=at.desc&limit=1`))[0] ?? null;

// 시간당 계산에 쓰므로 최근 구간만 있으면 된다.
export const recentSnapshots = (panId, hours = 72) =>
  rest(`snapshots?pan_id=eq.${panId}&at=gte.${new Date(Date.now() - hours * 3.6e6).toISOString()}&order=at.asc&select=at,total_applied,units`);

export const getState = async (panId) =>
  (await rest(`alert_state?pan_id=eq.${panId}&limit=1`))[0] ?? { pan_id: panId, fired: {} };

export const saveState = (state) =>
  rest('alert_state?on_conflict=pan_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ ...state, updated_at: new Date().toISOString() }),
  });
