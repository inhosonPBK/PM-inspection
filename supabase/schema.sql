-- =============================================
-- PBK PM Inspection System - Supabase Schema
-- =============================================

-- 작업자 테이블
create table if not exists workers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  emp_id      text,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

-- Daily 작업자별 점검 (ESD / Wrist / Torque)
create table if not exists daily_worker_inspections (
  id               uuid primary key default gen_random_uuid(),
  inspection_date  date not null,
  worker_id        uuid references workers(id) on delete set null,
  worker_name      text not null,
  esd_result       text check (esd_result in ('Pass', 'Fail')),
  wrist_result     text check (wrist_result in ('Pass', 'Fail')),
  tool_id          text,
  torque_1         numeric(6,2),
  torque_2         numeric(6,2),
  torque_3         numeric(6,2),
  torque_result    text check (torque_result in ('Pass', 'Fail')),
  remarks          text,
  created_at       timestamptz default now(),
  unique(inspection_date, worker_id)
);

-- Daily Hi-pot 점검 (1일 1회)
create table if not exists daily_hipot_inspections (
  id                  uuid primary key default gen_random_uuid(),
  inspection_date     date not null unique,
  inspector           text,
  pass_sample_result  text check (pass_sample_result in ('Pass', 'Fail')),
  fail_sample_result  text check (fail_sample_result in ('Pass', 'Fail')),
  overall_result      text check (overall_result in ('Pass', 'Fail')),
  remarks             text,
  created_at          timestamptz default now()
);

-- Monthly 점검
create table if not exists monthly_inspections (
  id                    uuid primary key default gen_random_uuid(),
  period                text not null unique,  -- 'YYYY-MM'
  inspector             text,
  -- Dummy Load Test
  load_pass_value       numeric(8,2),
  load_pass_result      text check (load_pass_result in ('Pass', 'Fail')),
  load_fail_value       numeric(8,2),
  load_fail_result      text check (load_fail_result in ('Pass', 'Fail')),
  -- Insulating Gloves
  gloves_open_date      date,
  gloves_expiry         date,
  gloves_result         text check (gloves_result in ('Pass', 'Fail')),
  -- MV Setting Fixture #1
  mv_fixture1_serial    text,
  mv_fixture1_check1    text check (mv_fixture1_check1 in ('OK', 'NG')),
  mv_fixture1_check2    text check (mv_fixture1_check2 in ('OK', 'NG')),
  mv_fixture1_result    text check (mv_fixture1_result in ('Pass', 'Fail')),
  -- MV Setting Fixture #2
  mv_fixture2_serial    text,
  mv_fixture2_check1    text check (mv_fixture2_check1 in ('OK', 'NG')),
  mv_fixture2_check2    text check (mv_fixture2_check2 in ('OK', 'NG')),
  mv_fixture2_result    text check (mv_fixture2_result in ('Pass', 'Fail')),
  -- MV Setting Fixture #3
  mv_fixture3_serial    text,
  mv_fixture3_check1    text check (mv_fixture3_check1 in ('OK', 'NG')),
  mv_fixture3_check2    text check (mv_fixture3_check2 in ('OK', 'NG')),
  mv_fixture3_result    text check (mv_fixture3_result in ('Pass', 'Fail')),
  mv_fixture_remarks    text,
  -- MV Test Tray
  mv_tray_serial        text,
  mv_tray_check1        text check (mv_tray_check1 in ('OK', 'NG')),
  mv_tray_check2        text check (mv_tray_check2 in ('OK', 'NG')),
  mv_tray_result        text check (mv_tray_result in ('Pass', 'Fail')),
  mv_tray_remarks       text,
  overall_result        text check (overall_result in ('Pass', 'Fail')),
  remarks               text,
  created_at            timestamptz default now()
);

-- Bi-yearly 점검
create table if not exists biyearly_inspections (
  id                uuid primary key default gen_random_uuid(),
  period            text not null unique,  -- 'YYYY-H1' or 'YYYY-H2'
  inspector         text,
  -- 작업대 표면 (5개)
  surface_1_id      text, surface_1_value text, surface_1_result text check (surface_1_result in ('Pass', 'Fail')),
  surface_2_id      text, surface_2_value text, surface_2_result text check (surface_2_result in ('Pass', 'Fail')),
  surface_3_id      text, surface_3_value text, surface_3_result text check (surface_3_result in ('Pass', 'Fail')),
  surface_4_id      text, surface_4_value text, surface_4_result text check (surface_4_result in ('Pass', 'Fail')),
  surface_5_id      text, surface_5_value text, surface_5_result text check (surface_5_result in ('Pass', 'Fail')),
  -- 손목띠 (5개)
  wrist_1_id        text, wrist_1_value text, wrist_1_result text check (wrist_1_result in ('Pass', 'Fail')),
  wrist_2_id        text, wrist_2_value text, wrist_2_result text check (wrist_2_result in ('Pass', 'Fail')),
  wrist_3_id        text, wrist_3_value text, wrist_3_result text check (wrist_3_result in ('Pass', 'Fail')),
  wrist_4_id        text, wrist_4_value text, wrist_4_result text check (wrist_4_result in ('Pass', 'Fail')),
  wrist_5_id        text, wrist_5_value text, wrist_5_result text check (wrist_5_result in ('Pass', 'Fail')),
  overall_result    text check (overall_result in ('Pass', 'Fail')),
  remarks           text,
  created_at        timestamptz default now()
);

-- Daily 위생관리 점검 (1일 1회)
create table if not exists hygiene_inspections (
  id              uuid primary key default gen_random_uuid(),
  inspection_date date not null unique,
  inspector       text,
  -- 시험실 (Test Zone)
  test_floor      text check (test_floor in ('OK', 'NG')),
  test_bench      text check (test_bench in ('OK', 'NG')),
  test_equip      text check (test_equip in ('OK', 'NG')),
  -- 작업실 (Assembly Zone)
  asm_floor       text check (asm_floor in ('OK', 'NG')),
  asm_parts       text check (asm_parts in ('OK', 'NG')),
  asm_bench       text check (asm_bench in ('OK', 'NG')),
  -- 창고 원자재
  wh_floor        text check (wh_floor in ('OK', 'NG')),
  wh_stacking     text check (wh_stacking in ('OK', 'NG')),
  wh_misc         text check (wh_misc in ('OK', 'NG')),
  -- 창고 완제품
  ship_floor      text check (ship_floor in ('OK', 'NG')),
  ship_stacking   text check (ship_stacking in ('OK', 'NG')),
  ship_misc       text check (ship_misc in ('OK', 'NG')),
  overall_result  text check (overall_result in ('OK', 'NG')),
  remarks         text,
  created_at      timestamptz default now()
);

-- 영상 링크 설정
create table if not exists video_configs (
  key         text primary key,
  url         text default '',
  updated_at  timestamptz default now()
);

-- 기본 작업자 데이터
insert into workers (name, emp_id) values
  ('김은기', 'EMP001'),
  ('김성연', 'EMP002'),
  ('김환수', 'EMP003'),
  ('김동근', 'EMP004'),
  ('김희재', 'EMP005')
on conflict do nothing;

-- 기본 영상 키 설정
insert into video_configs (key, url) values
  ('esd', ''), ('wrist', ''), ('torque', ''), ('hipot', ''),
  ('load', ''), ('gloves', ''), ('mvFixture', ''), ('mvTray', '')
on conflict (key) do nothing;

-- RLS (Row Level Security) - anon key로 읽기/쓰기 허용
alter table workers enable row level security;
alter table daily_worker_inspections enable row level security;
alter table daily_hipot_inspections enable row level security;
alter table monthly_inspections enable row level security;
alter table biyearly_inspections enable row level security;
alter table video_configs enable row level security;
alter table hygiene_inspections enable row level security;

-- 모든 테이블 anon 접근 허용 (사내 내부 시스템 - 별도 인증 없음)
create policy "allow_all_workers" on workers for all using (true) with check (true);
create policy "allow_all_daily_worker" on daily_worker_inspections for all using (true) with check (true);
create policy "allow_all_daily_hipot" on daily_hipot_inspections for all using (true) with check (true);
create policy "allow_all_monthly" on monthly_inspections for all using (true) with check (true);
create policy "allow_all_biyearly" on biyearly_inspections for all using (true) with check (true);
create policy "allow_all_video_configs" on video_configs for all using (true) with check (true);
create policy "allow_all_hygiene" on hygiene_inspections for all using (true) with check (true);
