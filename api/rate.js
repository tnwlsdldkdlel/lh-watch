import { DEFAULT_PAN, snapshot } from '../lh-core.mjs';

export default async function handler(req, res) {
  // 공고를 바꾸려면 목록 링크의 data-id1~4 를 쿼리로 넘긴다.
  const q = req.query ?? {};
  const pan = q.panId
    ? { name: q.name ?? q.panId, panId: q.panId, ccrCnntSysDsCd: q.ccrCnntSysDsCd, uppAisTpCd: q.uppAisTpCd, aisTpCd: q.aisTpCd }
    : DEFAULT_PAN;

  try {
    const data = await snapshot(pan);
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
