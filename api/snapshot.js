import { configured } from '../db.mjs';
import { runSnapshot } from '../runner.mjs';

export default async function handler(req, res) {
  // 공개 엔드포인트라 키가 없으면 아무나 LH 를 대신 때리게 된다.
  if (!process.env.CRON_SECRET || req.query?.key !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!configured()) return res.status(500).json({ error: 'supabase 미설정' });

  try {
    res.status(200).json(await runSnapshot());
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
