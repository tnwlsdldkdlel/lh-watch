# lh-watch

LH청약플러스 매입임대 공고의 **실시간 신청건수·경쟁률**을 조회한다.
LH 상세 페이지에 신청건수가 공개돼 있어 로그인이 필요 없다.

## 쓰는 법

```bash
node lh.mjs        # 1회 조회
node lh.mjs 5      # 5분마다, 변할 때만 출력 + 알림음 (log.csv 에 누적)
```

웹 대시보드는 Vercel 에 배포돼 있다. `/api/rate` 가 LH 를 직접 긁어 JSON 으로 준다.

## 다른 공고 보기

공고 목록에서 공고 링크의 `data-id1~4` 가 각각 `panId` / `ccrCnntSysDsCd` / `uppAisTpCd` / `aisTpCd` 다.
`lh-core.mjs` 의 `DEFAULT_PAN` 을 바꾸거나, `/api/rate?panId=...&ccrCnntSysDsCd=...&uppAisTpCd=...&aisTpCd=...` 로 넘긴다.

## 주의

- 상세는 POST 전용이고 세션 쿠키가 없으면 오류 페이지가 온다. 목록을 먼저 태워 `JSESSIONID` 를 받는다.
- 접수기간은 HTML 에 없고 인라인 스크립트 변수(`sbscAcpClsgDt` 등)에 있다.
- 조회 간격은 3분 이상 권장. 마감 직전만 짧게.
