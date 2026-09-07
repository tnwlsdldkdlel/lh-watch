import { DEFAULT_PAN } from '../lh-core.mjs';
import { configured, recentSnapshots } from '../db.mjs';

export default async function handler(req, res) {
  if (!configured()) return res.status(200).json({ names: [], snaps: [] });
  try {
    const rows = await recentSnapshots(req.query?.panId ?? DEFAULT_PAN.panId);
    // 페이지는 이름 배열 + 인덱스 형태를 쓴다. 단지명을 스냅샷마다 반복해 보내지 않으려는 것.
    const names = [...new Set(rows.flatMap((r) => r.units.map((u) => u.dong)))];
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(200).json({
      names,
      snaps: rows.map((r) => ({
        t: r.at,
        a: r.total_applied,
        u: names.map((n) => r.units.find((x) => x.dong === n)?.applied ?? null),
      })),
    });
  } catch (e) {
    res.status(502).json({ error: e.message, names: [], snaps: [] });
  }
}
