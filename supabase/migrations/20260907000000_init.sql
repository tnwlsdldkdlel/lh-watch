-- Supabase SQL Editor 에 붙여넣고 실행한다.

create table if not exists snapshots (
  id          bigserial primary key,
  pan_id      text        not null,
  at          timestamptz not null default now(),
  total_quota int         not null,
  total_applied int       not null,
  units       jsonb       not null,   -- [{dong, sido, quota, applied}, ...]
  unique (pan_id, at)
);

create index if not exists snapshots_pan_at on snapshots (pan_id, at desc);

-- 알림 중복 발송을 막는 상태. 공고당 한 행.
create table if not exists alert_state (
  pan_id       text primary key,
  last_pin     int,
  last_digest  timestamptz,
  fired        jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

-- 읽기는 브라우저가 아니라 Vercel 함수가 하므로 익명 접근을 열지 않는다.
alter table snapshots   enable row level security;
alter table alert_state enable row level security;
