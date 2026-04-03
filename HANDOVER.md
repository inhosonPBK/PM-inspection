# PBK PM Inspection — 통합 대시보드 인수인계 문서

> 작성일: 2026-04-03
> 배포 URL: https://pm-inspection.vercel.app
> GitHub: https://github.com/inhosonPBK/PM-inspection
> Supabase Project ID: `metbtwospxftixdzsftx`

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 목적 | PBK 생산라인 PM(예방정비) 점검 디지털화 |
| 현재 상태 | 독립 실행 가능한 완성 앱 / 통합 대시보드 연결 대기 |
| 주요 사용자 | 생산라인 작업자 5명, 관리자 |

---

## 2. 기술 스택

```
Frontend  : Next.js 16 (App Router) + TypeScript + Tailwind CSS
Backend   : Supabase (PostgreSQL + RLS)
하드웨어  : Python 브릿지 서버 (COM 포트 ↔ WebSocket)
배포      : Vercel (frontend) + Supabase cloud (DB)
```

---

## 3. 전달 방법 및 파일 목록

### 전달 채널 요약

| 전달 항목 | 방법 | 비고 |
|-----------|------|------|
| 전체 소스 코드 | **GitHub Collaborator 초대** | https://github.com/inhosonPBK/PM-inspection |
| DB 스키마 및 데이터 | **Supabase 개발자 초대** | Project ID: `metbtwospxftixdzsftx` |
| SUPABASE_ANON_KEY | **보안 채널 별도 전달** | 이메일/메신저 금지 |
| 브릿지 서버 파일 | **현장 PC 운영용 — 통합 대상 아님** | 별도 관리 (§7 참고) |

### GitHub 저장소 포함 파일

```
PM-inspection/
├── HANDOVER.md                 ← 본 문서
├── supabase/
│   └── schema.sql              ← DB 전체 테이블 + RLS 정책
├── app/                        ← Next.js 페이지들
│   ├── daily/page.tsx          ← Daily 점검
│   ├── monthly/page.tsx        ← Monthly 점검
│   ├── biyearly/page.tsx       ← Bi-yearly 점검
│   ├── history/page.tsx        ← 점검 이력
│   ├── trend/page.tsx          ← 트렌드 분석
│   ├── reports/page.tsx        ← 보고서 출력
│   └── settings/page.tsx       ← 설정 (작업자 관리, 영상 링크)
├── components/
│   └── layout/Sidebar.tsx
└── lib/
    ├── supabase.ts             ← Supabase 클라이언트
    └── types.ts                ← 공통 타입 정의
```

> **주의**: `.env.local` 파일은 보안상 GitHub에 포함되지 않습니다 (`.gitignore`).
> `SUPABASE_ANON_KEY`는 별도 보안 채널로 전달하세요.

### 브릿지 서버 파일 (통합 대상 제외)

```
bridge/
├── bridge_server.py        ← COM 포트 브릿지 소스 (현장 유지보수용)
├── requirements.txt
└── dist/bridge_server.exe  ← 현장 PC 설치용 실행 파일
```

> 브릿지 서버는 현장 PC에서 독립 실행되는 로컬 프로세스로,
> 통합 대시보드 코드베이스와 무관하게 현장에서 별도 운영됩니다 (§7 참고).

---

## 4. DB 테이블 구조

| 테이블 | 용도 | 고유 제약 |
|--------|------|-----------|
| `workers` | 작업자 목록 (이름, 사번, is_active) | — |
| `daily_worker_inspections` | ESD/어스링/Torque 일별 점검 | `(inspection_date, worker_id)` |
| `daily_hipot_inspections` | Hi-pot 1일 1회 점검 | `inspection_date` |
| `hygiene_inspections` | 위생관리 점검 1일 1회 (QP602-2) | `inspection_date` |
| `monthly_inspections` | 월간 점검 | `period (YYYY-MM)` |
| `biyearly_inspections` | 반기 점검 | `period (YYYY-H1/H2)` |
| `video_configs` | Deep How 영상 링크 설정 | `key` |

전체 스키마: `supabase/schema.sql` 참고

---

## 5. 구현된 주요 기능

### Daily 점검 (`/daily`)
- 작업자별 ESD Shoes / 어스링 / 전동드라이버 Torque 3회 측정
- **Torque 자동 입력**: COM 포트 계측기(Cedar DI-9M-8) → Python 브릿지 → WebSocket → 브라우저 자동 입력
- Safety Tester Hi-pot 1일 1회 (담당자 1명 완료 시 전원 완료 표시)
- 위생관리 점검 4구역 12항목 1일 1회 (QP602-2)
- **Tool 교체 경고 팝업**: 경고 구간(스펙 ±10%) 3일 연속 측정 시 자동 팝업

### Monthly 점검 (`/monthly`)
- Dummy Load Test, Insulating Gloves 유효기간 자동 계산, MV Fixture×3, MV Test Tray
- 월별 1회 완료 표시 + 검사자 자동 세팅

### Bi-yearly 점검 (`/biyearly`)
- 작업대 표면 5대 + 손목띠 5대 OK/NG 판정

### 점검 이력 (`/history`)
- 날짜 범위 조회, 작업자 필터

### 트렌드 분석 (`/trend`)
- Tool별 Cpk 공정능력지수 계산 및 등급(A~F)
- 히스토그램 + 정규분포 곡선 + 개별 측정점 SVG 차트
- Cpk 게이지 바

### 보고서 출력 (`/reports`)
- QMS 양식 5종 출력 (QP707-12, QP707-9, QP707-13, QP707-14, QP602-2)
- `window.print()` → A4 Landscape 출력

### 설정 (`/settings`)
- 작업자 추가/수정/비활성화
- Deep How 영상 딥링크 URL 관리

---

## 6. ⚠️ 통합 시 반드시 교체해야 할 부분 (인증)

현재 인증은 `localStorage` **임시 구현**입니다.
통합 대시보드 로그인 시스템으로 아래 두 곳을 교체해야 합니다.

### 교체 위치 1 — `app/daily/page.tsx`

```typescript
// ── 현재 (임시 localStorage) ──────────────────────────────
const saved = localStorage.getItem("pm_selected_worker_id");
if (saved) setSelectedWorkerId(saved);

function selectWorker(id: string) {
  localStorage.setItem("pm_selected_worker_id", id);
}

// ── 교체 목표 (통합 대시보드 auth로) ──────────────────────
const { user } = useAuth();           // 통합 대시보드 auth hook
const workerId = user.pm_worker_id;   // workers 테이블 id와 매핑 필요
```

### 교체 위치 2 — `app/monthly/page.tsx`

```typescript
// 현재
const wid = localStorage.getItem("pm_selected_worker_id");

// 교체: 위와 동일한 auth hook 사용
```

### Workers 테이블과 사용자 계정 연결 (권고)

```sql
-- workers 테이블에 auth_user_id 컬럼 추가
ALTER TABLE workers ADD COLUMN auth_user_id TEXT;
-- 통합 대시보드 로그인 user ID와 매핑
```

> **핵심 한 줄 요약:**
> `localStorage.getItem("pm_selected_worker_id")` 를 찾아서
> 통합 auth의 worker ID로 교체하면 나머지는 그대로 작동합니다.

---

## 7. 브릿지 서버 운영 안내

```
현장 PC에 bridge_server.exe 설치 필요 (1회)
├── 실행: 더블클릭 또는 시작프로그램 등록 권장
├── 연결: ws://localhost:8765
├── 계측기: Cedar DI-9M-8, COM6, 19200 baud
└── 방화벽: localhost 통신이므로 별도 설정 불필요
```

> **주의**: 통합 대시보드가 **별도 도메인**에서 운영될 경우,
> 브라우저 Mixed Content 정책으로 `ws://localhost` 연결이 차단될 수 있습니다.
> 해결책: `wss://` (TLS) 업그레이드 또는 현장 PC에 로컬 HTTPS 프록시 구성

---

## 8. 로컬 실행 방법 (개발 환경 세팅)

```bash
git clone https://github.com/inhosonPBK/PM-inspection.git
cd PM-inspection
npm install

# .env.local 파일 생성 (전달받은 값으로)
NEXT_PUBLIC_SUPABASE_URL=https://metbtwospxftixdzsftx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[전달받은 키]

# Supabase SQL Editor에서 schema.sql 실행 (최초 1회)

npm run dev
# → http://localhost:3000
```

---

## 9. 통합 시 예상 작업량

| 작업 | 난이도 | 예상 시간 |
|------|--------|-----------|
| Auth 연결 (localStorage → 통합 auth) | 낮음 | 2~4h |
| Sidebar를 통합 대시보드 메뉴로 이전 | 낮음 | 1~2h |
| workers 테이블과 사용자 계정 매핑 | 중간 | 2~4h |
| 브릿지 서버 wss:// 업그레이드 (필요 시) | 중간 | 3~5h |
| 전체 통합 테스트 | — | 1일 |

---

## 참고: Supabase RLS 정책

현재 모든 테이블은 `anon` 키로 읽기/쓰기가 허용되어 있습니다 (사내 내부 시스템).
통합 대시보드 연결 시 사용자별 접근 제어가 필요하면 RLS 정책 강화를 권장합니다.

```sql
-- 현재 정책 (모든 접근 허용)
create policy "allow_all" on [table] for all using (true) with check (true);

-- 강화 예시 (로그인 사용자만 허용)
create policy "allow_authenticated" on [table]
  for all using (auth.role() = 'authenticated');
```
