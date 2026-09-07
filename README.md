# lh-watch

LH청약플러스 매입임대 공고의 **실시간 신청건수·경쟁률**을 조회한다.
LH 상세 페이지에 신청건수가 공개돼 있어 로그인이 필요 없다.

- 대시보드: https://lh-watch-delta.vercel.app
- 기록: Supabase (`snapshots`, `alert_state`)
- 수집: GitHub Actions 5분 cron

## 구조

| 경로 | 역할 |
|---|---|
| `lh-core.mjs` | 목록으로 세션 발급 → 상세 POST → 신청건수·접수기간 파싱 |
| `snapshot.mjs` | 스냅샷 적재 + 알림 판정 (Actions 가 5분마다 실행) |
| `alert.mjs` | 알림 조건과 ntfy 발송 |
| `db.mjs` | Supabase REST 호출 |
| `api/rate.js` | 현재값 (LH 직접 조회, 30초 캐시) |
| `api/history.js` | 추이 (Supabase 조회) |
| `lh.mjs` | 로컬 CLI. `node lh.mjs 5` 로 5분마다 터미널 출력 |

## 환경변수

`SUPABASE_URL` · `SUPABASE_SERVICE_KEY` · `NTFY_TOPIC`
→ GitHub Secrets 와 Vercel 환경변수에 등록돼 있다. `.env` 는 커밋하지 않는다.

## 다른 공고 보기

목록에서 공고 링크의 `data-id1~4` 가 각각 `panId` / `ccrCnntSysDsCd` / `uppAisTpCd` / `aisTpCd` 다.
`lh-core.mjs` 의 `DEFAULT_PAN` 을 바꾸거나 `/api/rate?panId=...` 로 넘긴다.

## 주의

- 상세는 POST 전용이고 세션 쿠키가 없으면 오류 페이지가 온다. 목록을 먼저 태워 `JSESSIONID` 를 받는다.
- 접수기간은 HTML 에 없고 인라인 스크립트 변수(`sbscAcpClsgDt` 등)에 있다.
- 짧은 구간을 시간당으로 환산하면 크게 부풀려진다. 20분 미만 구간은 `–` 로 둔다.
