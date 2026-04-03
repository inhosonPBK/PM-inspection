"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Worker, PassFail } from "@/lib/types";

// ─── 토크 계측기 WebSocket 위젯 ───────────────────────────
const WS_URL = "ws://localhost:8765";
type WsStatus = "disconnected" | "connecting" | "connected" | "error";

function TorqueMeterWidget({
  measureCount,
  onMeasurement,
  onReset,
}: {
  measureCount: number;
  onMeasurement: (value: number) => void;
  onReset: () => void;
}) {
  const wsRef = useRef<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");
  const [ports, setPorts] = useState<string[]>([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [selectedBaud, setSelectedBaud] = useState("19200");
  const [serialConnected, setSerialConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const onMeasurementRef = useRef(onMeasurement);
  onMeasurementRef.current = onMeasurement;

  // WebSocket 연결
  function connectWS() {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setWsStatus("connecting");
    setErrorMsg("");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("connected");
      ws.send(JSON.stringify({ action: "get_ports" }));
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "ports") {
          setPorts(msg.ports || []);
          if (msg.ports?.length > 0 && !selectedPort) setSelectedPort(msg.ports[0]);
        } else if (msg.type === "status") {
          setSerialConnected(!!msg.connected);
          if (msg.error) setErrorMsg(msg.error);
        } else if (msg.type === "measurement" && typeof msg.value === "number") {
          onMeasurementRef.current(msg.value);
        }
      } catch { /* ignore */ }
    };
    ws.onerror = () => { setWsStatus("error"); setErrorMsg("브릿지 서버에 연결할 수 없습니다."); };
    ws.onclose = () => { setWsStatus("disconnected"); setSerialConnected(false); };
  }

  function disconnectWS() {
    wsRef.current?.send(JSON.stringify({ action: "disconnect" }));
    wsRef.current?.close();
    wsRef.current = null;
    setWsStatus("disconnected");
    setSerialConnected(false);
    setPorts([]);
  }

  function refreshPorts() {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "get_ports" }));
    }
  }

  function connectSerial() {
    if (!selectedPort || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ action: "connect", port: selectedPort, baud: parseInt(selectedBaud) }));
  }

  function disconnectSerial() {
    wsRef.current?.send(JSON.stringify({ action: "disconnect" }));
  }

  useEffect(() => { return () => { wsRef.current?.close(); }; }, []);

  const statusColor: Record<WsStatus, string> = {
    disconnected: "bg-gray-400",
    connecting: "bg-yellow-400 animate-pulse",
    connected: "bg-green-400",
    error: "bg-red-400",
  };
  const statusLabel: Record<WsStatus, string> = {
    disconnected: "연결 안됨",
    connecting: "연결 중...",
    connected: serialConnected ? `${selectedPort} 연결됨` : "브릿지 연결됨",
    error: "오류",
  };

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
      {/* 상태 & WS 연결 */}
      <div className="flex items-center gap-2 mb-2.5">
        <span className={`w-2 h-2 rounded-full ${statusColor[wsStatus]}`} />
        <span className="text-xs text-gray-500">{statusLabel[wsStatus]}</span>
        {measureCount > 0 && measureCount < 3 && (
          <span className="ml-auto text-xs font-semibold text-indigo-600">측정 중... ({measureCount}/3)</span>
        )}
        {measureCount >= 3 && (
          <span className="ml-auto text-xs font-semibold text-green-600">✓ 3회 측정 완료</span>
        )}
      </div>

      {wsStatus === "disconnected" || wsStatus === "error" ? (
        /* ── 브릿지 미연결 상태 ── */
        <div className="flex items-center gap-2">
          <button onClick={connectWS}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors">
            <i className="fas fa-plug mr-1" />브릿지 연결
          </button>
          {errorMsg && <span className="text-xs text-red-500">{errorMsg}</span>}
          <span className="text-xs text-gray-400">bridge_server.exe 실행 필요</span>
        </div>
      ) : (
        /* ── 브릿지 연결됨 — 포트/baud 선택 항상 표시 ── */
        <div className="flex items-center gap-2 flex-wrap">
          {/* 포트 선택 */}
          <select value={selectedPort} onChange={(e) => setSelectedPort(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white min-w-[100px]">
            {ports.length === 0
              ? <option value="">-- 포트 없음 --</option>
              : ports.map((p) => <option key={p} value={p}>{p}</option>)
            }
          </select>
          {/* Baud rate 선택 */}
          <select value={selectedBaud} onChange={(e) => setSelectedBaud(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
            {["2400","4800","9600","19200","38400","115200"].map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <button onClick={refreshPorts}
            className="p-1.5 border border-gray-200 rounded-lg bg-white hover:bg-gray-100 transition-colors" title="포트 새로고침">
            <i className="fas fa-sync-alt text-gray-500 text-xs" />
          </button>
          {/* 연결 / 재연결 버튼 — 항상 표시 */}
          <button onClick={connectSerial} disabled={!selectedPort}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 ${
              serialConnected
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-purple-600 text-white hover:bg-purple-700"
            }`}>
            <i className={`fas ${serialConnected ? "fa-exchange-alt" : "fa-link"} mr-1`} />
            {serialConnected ? "재연결" : "연결"}
          </button>
          {serialConnected && (
            <button onClick={disconnectSerial}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-300 transition-colors">
              <i className="fas fa-unlink mr-1" />해제
            </button>
          )}
          <button onClick={disconnectWS}
            className="p-1.5 border border-gray-200 rounded-lg bg-white hover:bg-gray-100 transition-colors" title="브릿지 연결 종료">
            <i className="fas fa-times text-gray-400 text-xs" />
          </button>
          <button onClick={onReset}
            className="ml-auto px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-500 text-xs hover:bg-gray-100 transition-colors">
            <i className="fas fa-redo mr-1" />측정 초기화
          </button>
        </div>
      )}
      {serialConnected && (
        <p className="text-[10px] text-gray-400 mt-2">
          <i className="fas fa-info-circle mr-1" />계측기 측정 시 토크 값이 자동으로 입력됩니다 (1회→2회→3회 순서)
        </p>
      )}
    </div>
  );
}

// ─── 토크 스펙 ────────────────────────────────────────────
const TORQUE_LSL = 12.32;
const TORQUE_USL = 16.67;

function judgeTorque(v: number | null): PassFail | null {
  if (v === null || isNaN(v)) return null;
  return v >= TORQUE_LSL && v <= TORQUE_USL ? "Pass" : "Fail";
}

function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// ─── 공통 UI 컴포넌트 ─────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5 ${className}`}>
      {children}
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700",
    yellow: "bg-yellow-50 text-yellow-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    purple: "bg-purple-50 text-purple-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${colors[color] || colors.blue}`}>
      {children}
    </span>
  );
}

function CheckBtn({ label, selected, onClick }: { label: "Pass" | "Fail"; selected: boolean; onClick: () => void }) {
  const isPass = label === "Pass";
  const base = "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all border-2 cursor-pointer";
  const style = isPass
    ? selected
      ? `${base} bg-green-600 text-white border-green-600`
      : `${base} bg-green-50 text-green-700 border-green-500 hover:bg-green-600 hover:text-white`
    : selected
    ? `${base} bg-red-600 text-white border-red-600`
    : `${base} bg-red-50 text-red-700 border-red-500 hover:bg-red-600 hover:text-white`;
  return <button className={style} onClick={onClick}>{label}</button>;
}

function ResultBadge({ result }: { result: PassFail | null }) {
  if (!result) return <span className="text-xs text-gray-400">-</span>;
  return result === "Pass"
    ? <span className="text-xs font-bold text-green-600">✓ Pass</span>
    : <span className="text-xs font-bold text-red-600">✗ Fail</span>;
}

// ─── 작업자별 점검 폼 ─────────────────────────────────────
interface WorkerFormState {
  esd: PassFail | null;
  wrist: PassFail | null;
  toolId: string;
  torque1: string;
  torque2: string;
  torque3: string;
  remarks: string;
  done: boolean;
}

function WorkerInspectionCard({
  worker,
  videoLinks,
  initialDone,
  onDone,
}: {
  worker: Worker;
  videoLinks: Record<string, string>;
  initialDone: boolean;
  onDone: (workerId: string) => void;
}) {
  const today = getTodayStr();
  const [form, setForm] = useState<WorkerFormState>({
    esd: null, wrist: null, toolId: "", torque1: "", torque2: "", torque3: "", remarks: "", done: initialDone,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [measureCount, setMeasureCount] = useState(0);

  // 계측기에서 값이 들어올 때 1회→2회→3회 순으로 채움
  function handleMeasurement(value: number) {
    setForm((f) => {
      if (!f.torque1) return { ...f, torque1: String(value) };
      if (!f.torque2) return { ...f, torque2: String(value) };
      if (!f.torque3) return { ...f, torque3: String(value) };
      return f; // 3회 모두 채워지면 무시
    });
    setMeasureCount((c) => Math.min(c + 1, 3));
  }

  function resetMeasurements() {
    setForm((f) => ({ ...f, torque1: "", torque2: "", torque3: "" }));
    setMeasureCount(0);
  }

  useEffect(() => {
    setForm((f) => ({ ...f, done: initialDone }));
  }, [initialDone]);

  const t1 = parseFloat(form.torque1) || null;
  const t2 = parseFloat(form.torque2) || null;
  const t3 = parseFloat(form.torque3) || null;
  const torqueResults = [t1, t2, t3].map(judgeTorque);
  const torqueOverall: PassFail | null = torqueResults.every((r) => r === "Pass") && torqueResults.some((r) => r !== null) ? "Pass"
    : torqueResults.some((r) => r === "Fail") ? "Fail" : null;

  async function handleSubmit() {
    if (!form.esd || !form.wrist) { setMsg({ type: "err", text: "ESD / 어스링 결과를 선택해주세요." }); return; }
    setSaving(true);
    const { error } = await supabase.from("daily_worker_inspections").upsert({
      inspection_date: today,
      worker_id: worker.id,
      worker_name: worker.name,
      esd_result: form.esd,
      wrist_result: form.wrist,
      tool_id: form.toolId || null,
      torque_1: t1, torque_2: t2, torque_3: t3,
      torque_result: torqueOverall,
      remarks: form.remarks || null,
    }, { onConflict: "inspection_date,worker_id" });

    setSaving(false);
    if (error) { setMsg({ type: "err", text: "저장 실패: " + error.message }); }
    else { setForm((f) => ({ ...f, done: true })); setMsg({ type: "ok", text: "저장 완료!" }); onDone(worker.id); }
  }

  if (form.done) {
    return (
      <div className="p-4 bg-green-50 border-2 border-green-200 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <i className="fas fa-check text-white text-xs" />
          </div>
          <div>
            <div className="font-semibold text-green-800 text-sm">{worker.name}</div>
            <div className="text-green-600 text-xs">{worker.emp_id} · 점검 완료</div>
          </div>
        </div>
        <button className="text-xs text-green-600 underline" onClick={() => setForm((f) => ({ ...f, done: false }))}>
          수정
        </button>
      </div>
    );
  }

  return (
    <div className="border-2 border-indigo-100 rounded-xl p-5 bg-indigo-50/30">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
          <i className="fas fa-user text-indigo-600 text-xs" />
        </div>
        <div>
          <div className="font-bold text-gray-900 text-sm">{worker.name}</div>
          <div className="text-gray-400 text-xs">{worker.emp_id}</div>
        </div>
      </div>

      {/* 1. ESD */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
              <span className="font-semibold text-gray-900 text-sm">제전화 (ESD Shoes)</span>
              {videoLinks.esd && (
                <a href={videoLinks.esd} target="_blank" rel="noreferrer"
                  className="w-6 h-6 bg-red-500 rounded-md flex items-center justify-center hover:bg-red-600 transition-colors">
                  <i className="fas fa-play text-white text-[8px]" />
                </a>
              )}
            </div>
            <div className="ml-7 text-xs text-gray-500">
              제전화 착용 → Both 버튼 → 손바닥 접촉
              <span className="ml-2 font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded">10⁵Ω ~ 10⁸Ω</span>
            </div>
          </div>
          <div className="flex gap-2">
            <CheckBtn label="Pass" selected={form.esd === "Pass"} onClick={() => setForm((f) => ({ ...f, esd: "Pass" }))} />
            <CheckBtn label="Fail" selected={form.esd === "Fail"} onClick={() => setForm((f) => ({ ...f, esd: "Fail" }))} />
          </div>
        </div>
      </div>

      {/* 2. Wrist */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
              <span className="font-semibold text-gray-900 text-sm">어스링 (Wrist Strap)</span>
              {videoLinks.wrist && (
                <a href={videoLinks.wrist} target="_blank" rel="noreferrer"
                  className="w-6 h-6 bg-red-500 rounded-md flex items-center justify-center hover:bg-red-600 transition-colors">
                  <i className="fas fa-play text-white text-[8px]" />
                </a>
              )}
            </div>
            <div className="ml-7 text-xs text-gray-500">
              어스링 착용 → Wrist 버튼 → 손바닥 접촉
              <span className="ml-2 font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded">10⁵Ω ~ 10⁸Ω</span>
            </div>
          </div>
          <div className="flex gap-2">
            <CheckBtn label="Pass" selected={form.wrist === "Pass"} onClick={() => setForm((f) => ({ ...f, wrist: "Pass" }))} />
            <CheckBtn label="Fail" selected={form.wrist === "Fail"} onClick={() => setForm((f) => ({ ...f, wrist: "Fail" }))} />
          </div>
        </div>
      </div>

      {/* 3. Torque */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-bold">3</span>
          <span className="font-semibold text-gray-900 text-sm">전동드라이버 Torque Check</span>
          {videoLinks.torque && (
            <a href={videoLinks.torque} target="_blank" rel="noreferrer"
              className="w-6 h-6 bg-red-500 rounded-md flex items-center justify-center hover:bg-red-600 transition-colors">
              <i className="fas fa-play text-white text-[8px]" />
            </a>
          )}
          <span className="ml-auto font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">
            Spec: {TORQUE_LSL} ~ {TORQUE_USL} lbf.in
          </span>
        </div>
        {/* 계측기 WebSocket 위젯 */}
        <TorqueMeterWidget
          measureCount={measureCount}
          onMeasurement={handleMeasurement}
          onReset={resetMeasurements}
        />

        <div className="grid grid-cols-5 gap-3 items-end mt-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tool ID</label>
            <input className="input-base text-sm" placeholder="예: PT0020" value={form.toolId}
              onChange={(e) => setForm((f) => ({ ...f, toolId: e.target.value }))} />
          </div>
          {[1, 2, 3].map((n) => {
            const key = `torque${n}` as "torque1" | "torque2" | "torque3";
            const val = parseFloat(form[key]) || null;
            const r = judgeTorque(val);
            return (
              <div key={n}>
                <label className="text-xs text-gray-500 mb-1 block">{n}회 (lbf.in)</label>
                <input className="input-base text-sm text-center" type="number" step="0.01"
                  value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                <div className="text-center mt-1"><ResultBadge result={r} /></div>
              </div>
            );
          })}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">판정</label>
            <div className={`px-3 py-2 rounded-lg text-sm font-bold text-center ${
              torqueOverall === "Pass" ? "bg-green-100 text-green-700" :
              torqueOverall === "Fail" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"
            }`}>
              {torqueOverall || "대기"}
            </div>
          </div>
        </div>
      </div>

      {/* 비고 & 제출 */}
      <div className="mt-4">
        <textarea className="input-base mb-3 resize-none text-sm" rows={2}
          placeholder="특이사항..." value={form.remarks}
          onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
        {msg && (
          <p className={`text-xs mb-2 ${msg.type === "ok" ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>
        )}
        <button onClick={handleSubmit} disabled={saving}
          className="w-full py-2.5 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
          {saving ? <><i className="fas fa-spinner fa-spin mr-2" />저장 중...</> : <><i className="fas fa-check mr-2" />점검 완료</>}
        </button>
      </div>
    </div>
  );
}

// ─── Hi-pot 점검 카드 ─────────────────────────────────────
function HipotCard({ videoLinks, workerName }: { videoLinks: Record<string, string>; workerName: string }) {
  const today = getTodayStr();
  const [inspector, setInspector] = useState(workerName);
  const [passSample, setPassSample] = useState<PassFail | null>(null);
  const [failSample, setFailSample] = useState<PassFail | null>(null);
  const [remarks, setRemarks] = useState("");
  const [done, setDone] = useState(false);
  const [doneBy, setDoneBy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    supabase.from("daily_hipot_inspections")
      .select("inspector").eq("inspection_date", today).maybeSingle()
      .then(({ data }) => { if (data) { setDone(true); setDoneBy(data.inspector || null); } });
  }, [today]);

  // workerName이 늦게 로드될 경우 반영
  useEffect(() => { if (workerName) setInspector(workerName); }, [workerName]);

  const overall: PassFail | null = passSample === "Pass" && failSample === "Fail" ? "Pass"
    : passSample !== null && failSample !== null ? "Fail" : null;

  async function handleSubmit() {
    if (!passSample || !failSample) { setMsg({ type: "err", text: "두 시료 결과를 모두 선택해주세요." }); return; }
    setSaving(true);
    const { error } = await supabase.from("daily_hipot_inspections").upsert({
      inspection_date: today, inspector: inspector || null,
      pass_sample_result: passSample, fail_sample_result: failSample,
      overall_result: overall, remarks: remarks || null,
    }, { onConflict: "inspection_date" });
    setSaving(false);
    if (error) setMsg({ type: "err", text: "저장 실패: " + error.message });
    else { setDone(true); setMsg({ type: "ok", text: "저장 완료!" }); }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-gray-900">
            <i className="fas fa-bolt text-amber-500 mr-2" />Safety Tester Dummy Hi-pot Test
          </h3>
          {videoLinks.hipot && (
            <a href={videoLinks.hipot} target="_blank" rel="noreferrer"
              className="w-7 h-7 bg-red-500 rounded-lg flex items-center justify-center hover:bg-red-600 transition-colors">
              <i className="fas fa-play text-white text-xs" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          {done && (
            <Badge color="green">
              <i className="fas fa-check mr-1" />금일 완료{doneBy ? ` · ${doneBy}` : ""}
            </Badge>
          )}
          <Badge color="yellow">1일 1회 (담당자)</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="text-sm font-medium text-gray-700 mb-3">Test 설정</div>
          <div className="space-y-1.5 text-sm">
            {[["항목", "DCW (내전압 Test)"], ["Test Voltage", "1.5 kV"], ["Hi-Set", "1.0 mA"]].map(([k, v]) => (
              <div key={k} className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-gray-700 mb-3">검사 시료 판정</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
              <div>
                <div className="text-sm font-medium text-green-800">Pass 시료 (1490Ω)</div>
                <div className="text-xs text-green-600">PASS로 판정되어야 함</div>
              </div>
              <div className="flex gap-2">
                <CheckBtn label="Pass" selected={passSample === "Pass"} onClick={() => setPassSample("Pass")} />
                <CheckBtn label="Fail" selected={passSample === "Fail"} onClick={() => setPassSample("Fail")} />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
              <div>
                <div className="text-sm font-medium text-red-800">Fail 시료 (1510Ω)</div>
                <div className="text-xs text-red-600">FAIL로 판정되어야 함</div>
              </div>
              <div className="flex gap-2">
                <CheckBtn label="Pass" selected={failSample === "Pass"} onClick={() => setFailSample("Pass")} />
                <CheckBtn label="Fail" selected={failSample === "Fail"} onClick={() => setFailSample("Fail")} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t flex items-end gap-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">검사자</label>
          <div className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-medium text-indigo-800" style={{ width: 150, minHeight: 38 }}>
            <i className="fas fa-user text-indigo-400 text-xs" />
            {inspector || <span className="text-gray-400 text-xs">작업자 미선택</span>}
          </div>
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">비고</label>
          <input className="input-base" placeholder="특이사항..." value={remarks}
            onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <div>
          {overall && (
            <div className={`mb-2 px-3 py-1 rounded-lg text-sm font-bold text-center ${
              overall === "Pass" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}>
              종합: {overall}
            </div>
          )}
          {msg && <p className={`text-xs mb-1 ${msg.type === "ok" ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
          <button onClick={handleSubmit} disabled={saving}
            className="px-6 py-2.5 rounded-xl font-bold text-white text-sm disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            {saving ? "저장 중..." : <><i className="fas fa-check mr-1" />점검 완료</>}
          </button>
        </div>
      </div>
    </Card>
  );
}

// ─── 위생관리 점검 ────────────────────────────────────────
type OkNg = "OK" | "NG";

const HYGIENE_ZONES = [
  {
    key: "test",
    label: "시험실 (Test Zone)",
    color: "bg-blue-50 border-blue-200",
    headerColor: "bg-blue-600",
    items: [
      { key: "test_floor",  label: "바닥 청결" },
      { key: "test_bench",  label: "시험대 청결" },
      { key: "test_equip",  label: "계측기 정리정돈" },
    ],
  },
  {
    key: "asm",
    label: "작업실 (Assembly Zone)",
    color: "bg-indigo-50 border-indigo-200",
    headerColor: "bg-indigo-600",
    items: [
      { key: "asm_floor",  label: "바닥 청결" },
      { key: "asm_parts",  label: "부품 및 시설 정리정돈" },
      { key: "asm_bench",  label: "작업대 청결" },
    ],
  },
  {
    key: "wh",
    label: "창고 원자재 (Warehouse)",
    color: "bg-teal-50 border-teal-200",
    headerColor: "bg-teal-600",
    items: [
      { key: "wh_floor",    label: "바닥 청결" },
      { key: "wh_stacking", label: "제품 적재" },
      { key: "wh_misc",     label: "기타 정리정돈" },
    ],
  },
  {
    key: "ship",
    label: "창고 완제품 (Shipping Rack)",
    color: "bg-cyan-50 border-cyan-200",
    headerColor: "bg-cyan-600",
    items: [
      { key: "ship_floor",    label: "바닥 청결" },
      { key: "ship_stacking", label: "제품 적재" },
      { key: "ship_misc",     label: "기타 정리정돈" },
    ],
  },
];

const ALL_HYGIENE_KEYS = HYGIENE_ZONES.flatMap((z) => z.items.map((i) => i.key));

function OkNgBtn({ label, selected, onClick }: { label: OkNg; selected: boolean; onClick: () => void }) {
  const isOk = label === "OK";
  const base = "px-3 py-1 rounded-lg text-xs font-bold transition-all border-2 cursor-pointer";
  const style = isOk
    ? selected
      ? `${base} bg-green-600 text-white border-green-600`
      : `${base} bg-green-50 text-green-700 border-green-500 hover:bg-green-600 hover:text-white`
    : selected
    ? `${base} bg-red-600 text-white border-red-600`
    : `${base} bg-red-50 text-red-700 border-red-500 hover:bg-red-600 hover:text-white`;
  return <button className={style} onClick={onClick}>{label}</button>;
}

function HygieneCard({ workerName }: { workerName: string }) {
  const today = getTodayStr();
  const [results, setResults] = useState<Record<string, OkNg | null>>(
    Object.fromEntries(ALL_HYGIENE_KEYS.map((k) => [k, null]))
  );
  const [inspector, setInspector] = useState(workerName);
  const [remarks, setRemarks] = useState("");
  const [done, setDone] = useState(false);
  const [doneBy, setDoneBy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const remarksRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.from("hygiene_inspections")
      .select("inspector").eq("inspection_date", today).maybeSingle()
      .then(({ data }) => { if (data) { setDone(true); setDoneBy(data.inspector || null); } });
  }, [today]);

  useEffect(() => { if (workerName) setInspector(workerName); }, [workerName]);

  function setItem(key: string, value: OkNg) {
    setResults((prev) => {
      const next = { ...prev, [key]: value };
      return next;
    });
    if (value === "NG") {
      setTimeout(() => remarksRef.current?.focus(), 50);
    }
  }

  const allSelected = ALL_HYGIENE_KEYS.every((k) => results[k] !== null);
  const hasNg = ALL_HYGIENE_KEYS.some((k) => results[k] === "NG");
  const overall: OkNg | null = allSelected ? (hasNg ? "NG" : "OK") : null;

  async function handleSubmit() {
    if (!allSelected) { setMsg({ type: "err", text: "12개 항목을 모두 선택해주세요." }); return; }
    if (hasNg && !remarks.trim()) { setMsg({ type: "err", text: "NG 항목이 있는 경우 비고를 입력해주세요." }); remarksRef.current?.focus(); return; }
    setSaving(true);
    const { error } = await supabase.from("hygiene_inspections").upsert({
      inspection_date: today,
      inspector: inspector || null,
      ...Object.fromEntries(ALL_HYGIENE_KEYS.map((k) => [k, results[k]])),
      overall_result: overall,
      remarks: remarks || null,
    }, { onConflict: "inspection_date" });
    setSaving(false);
    if (error) setMsg({ type: "err", text: "저장 실패: " + error.message });
    else { setDone(true); setMsg({ type: "ok", text: "저장 완료!" }); }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">
          <i className="fas fa-broom text-blue-500 mr-2" />위생관리 점검
          <span className="ml-2 text-xs text-gray-400 font-normal">(QP602-2)</span>
        </h3>
        <div className="flex items-center gap-2">
          {done && (
            <Badge color="green">
              <i className="fas fa-check mr-1" />금일 완료{doneBy ? ` · ${doneBy}` : ""}
            </Badge>
          )}
          <Badge color="blue">1일 1회 (담당자)</Badge>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        {HYGIENE_ZONES.map((zone) => (
          <div key={zone.key} className={`rounded-xl border ${zone.color} overflow-hidden`}>
            <div className={`${zone.headerColor} text-white text-xs font-bold px-3 py-1.5`}>
              {zone.label}
            </div>
            <div className="p-3 space-y-2">
              {zone.items.map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <span className="text-xs text-gray-700 flex-1">{item.label}</span>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <OkNgBtn label="OK" selected={results[item.key] === "OK"} onClick={() => setItem(item.key, "OK")} />
                    <OkNgBtn label="NG" selected={results[item.key] === "NG"} onClick={() => setItem(item.key, "NG")} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-4 flex items-end gap-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">검사자</label>
          <div className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-medium text-indigo-800" style={{ width: 150, minHeight: 38 }}>
            <i className="fas fa-user text-indigo-400 text-xs" />
            {inspector || <span className="text-gray-400 text-xs">작업자 미선택</span>}
          </div>
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">
            비고{hasNg && <span className="text-red-500 ml-1">* NG 항목 필수 기재</span>}
          </label>
          <textarea ref={remarksRef} className="input-base resize-none text-sm" rows={2}
            placeholder={hasNg ? "NG 항목에 대한 조치 내용을 기재해주세요..." : "특이사항..."}
            value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <div>
          {overall && (
            <div className={`mb-2 px-3 py-1 rounded-lg text-sm font-bold text-center ${
              overall === "OK" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}>
              종합: {overall}
            </div>
          )}
          {msg && <p className={`text-xs mb-1 ${msg.type === "ok" ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
          <button onClick={handleSubmit} disabled={saving || !allSelected}
            className="px-6 py-2.5 rounded-xl font-bold text-white text-sm disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            {saving ? "저장 중..." : <><i className="fas fa-check mr-1" />점검 완료</>}
          </button>
        </div>
      </div>
      {!allSelected && (
        <p className="text-xs text-gray-400 mt-2 text-right">
          <i className="fas fa-info-circle mr-1" />{ALL_HYGIENE_KEYS.filter((k) => results[k] !== null).length} / 12 선택됨
        </p>
      )}
    </Card>
  );
}

// ─── Tool 경고 체크 ───────────────────────────────────────
const WARN_LOW  = TORQUE_LSL + (TORQUE_USL - TORQUE_LSL) * 0.10; // 12.755
const WARN_HIGH = TORQUE_USL - (TORQUE_USL - TORQUE_LSL) * 0.10; // 16.235
const WARN_DAYS = 3;

interface ToolWarning {
  toolId: string;
  days: number;
  direction: "low" | "high";
  avgLast: number;
}

async function checkToolWarnings(): Promise<ToolWarning[]> {
  const from = new Date();
  from.setDate(from.getDate() - 14);
  const fromStr = from.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("daily_worker_inspections")
    .select("tool_id, inspection_date, torque_1, torque_2, torque_3")
    .gte("inspection_date", fromStr)
    .not("tool_id", "is", null)
    .not("tool_id", "eq", "")
    .order("inspection_date", { ascending: false });

  if (!data || data.length === 0) return [];

  // tool_id × date 별 평균 계산
  const map = new Map<string, Map<string, number[]>>();
  data.forEach((r) => {
    const tid = String(r.tool_id);
    if (!map.has(tid)) map.set(tid, new Map());
    const dayMap = map.get(tid)!;
    const date = String(r.inspection_date);
    if (!dayMap.has(date)) dayMap.set(date, []);
    [r.torque_1, r.torque_2, r.torque_3].forEach((v) => {
      if (v != null) dayMap.get(date)!.push(Number(v));
    });
  });

  const warnings: ToolWarning[] = [];
  map.forEach((dayMap, toolId) => {
    // 날짜 내림차순 정렬
    const dates = Array.from(dayMap.keys()).sort((a, b) => b.localeCompare(a));
    let streak = 0;
    let direction: "low" | "high" | null = null;

    for (const date of dates) {
      const vals = dayMap.get(date)!;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const inLow  = avg <= WARN_LOW;
      const inHigh = avg >= WARN_HIGH;

      if (streak === 0) {
        if (inLow)  { direction = "low";  streak = 1; }
        else if (inHigh) { direction = "high"; streak = 1; }
        else break; // 최근 날이 정상이면 연속 아님
      } else {
        const matches = direction === "low" ? inLow : inHigh;
        if (matches) streak++;
        else break;
      }
    }

    if (streak >= WARN_DAYS && direction) {
      const latestVals = dayMap.get(dates[0])!;
      const avgLast = latestVals.reduce((a, b) => a + b, 0) / latestVals.length;
      warnings.push({ toolId, days: streak, direction, avgLast });
    }
  });

  return warnings;
}

// ─── Tool 경고 팝업 ───────────────────────────────────────
function ToolWarningPopup({ warnings, onClose }: { warnings: ToolWarning[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl border border-orange-200 w-full max-w-md mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <i className="fas fa-exclamation-triangle text-white text-lg" />
            </div>
            <div>
              <div className="text-white font-bold text-base">Tool 교체 / 점검 필요</div>
              <div className="text-orange-100 text-xs mt-0.5">{WARN_DAYS}일 이상 경고 구간 연속 측정됨</div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <i className="fas fa-times text-lg" />
          </button>
        </div>

        {/* 경고 목록 */}
        <div className="p-5 space-y-3">
          {warnings.map((w) => (
            <div key={w.toolId} className={`rounded-xl border p-4 ${
              w.direction === "low" ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 text-base">{w.toolId}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    w.direction === "low"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    {w.direction === "low" ? "하한 경고 (LSL측)" : "상한 경고 (USL측)"}
                  </span>
                </div>
                <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                  {w.days}일 연속
                </span>
              </div>
              <div className="text-sm text-gray-600">
                최근 평균: <strong>{w.avgLast.toFixed(2)} lbf.in</strong>
                <span className="text-xs text-gray-400 ml-2">
                  (경고 기준: {w.direction === "low"
                    ? `≤ ${WARN_LOW.toFixed(2)}`
                    : `≥ ${WARN_HIGH.toFixed(2)}`})
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                <i className="fas fa-wrench mr-1" />
                {w.direction === "low"
                  ? "토크 설정값 확인 또는 드라이버 교체를 검토하세요."
                  : "토크 설정값 확인 또는 드라이버 교체를 검토하세요."}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 pb-5">
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl font-semibold text-white text-sm"
            style={{ background: "linear-gradient(135deg, #f97316, #eab308)" }}>
            확인했습니다
          </button>
          <p className="text-center text-xs text-gray-400 mt-2">
            트렌드 분석 탭에서 상세 공정능력 분석을 확인하세요.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────
export default function DailyPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [doneWorkerIds, setDoneWorkerIds] = useState<Set<string>>(new Set());
  const [videoLinks, setVideoLinks] = useState<Record<string, string>>({});
  // TODO: 통합 대시보드 연결 시 아래 두 줄을 로그인 사용자 정보로 교체
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [workerLoaded, setWorkerLoaded] = useState(false);
  const [toolWarnings, setToolWarnings] = useState<ToolWarning[]>([]);
  const [showWarning, setShowWarning] = useState(false);
  const today = getTodayStr();

  useEffect(() => {
    const saved = localStorage.getItem("pm_selected_worker_id");
    if (saved) setSelectedWorkerId(saved);
    setWorkerLoaded(true);
  }, []);

  function selectWorker(id: string) {
    setSelectedWorkerId(id);
    localStorage.setItem("pm_selected_worker_id", id);
  }

  const loadData = useCallback(async () => {
    const [{ data: ws }, { data: done }, { data: vids }] = await Promise.all([
      supabase.from("workers").select("*").eq("is_active", true).order("name"),
      supabase.from("daily_worker_inspections").select("worker_id").eq("inspection_date", today),
      supabase.from("video_configs").select("*"),
    ]);
    setWorkers(ws || []);
    setDoneWorkerIds(new Set((done || []).map((r) => r.worker_id as string)));
    const vMap: Record<string, string> = {};
    (vids || []).forEach((v) => { vMap[v.key] = v.url; });
    setVideoLinks(vMap);

    // Tool 경고 체크 — 오늘 이미 확인했으면 재표시 안 함
    const dismissedKey = `tool_warning_dismissed_${today}`;
    if (!sessionStorage.getItem(dismissedKey)) {
      const warnings = await checkToolWarnings();
      if (warnings.length > 0) {
        setToolWarnings(warnings);
        setShowWarning(true);
      }
    }
  }, [today]);

  useEffect(() => { loadData(); }, [loadData]);

  function dismissWarning() {
    sessionStorage.setItem(`tool_warning_dismissed_${today}`, "1");
    setShowWarning(false);
  }

  const doneCount = workers.filter((w) => doneWorkerIds.has(w.id)).length;
  const myWorker = workers.find((w) => w.id === selectedWorkerId) ?? null;

  // 작업자 미선택 시 선택 화면
  if (workerLoaded && !myWorker && workers.length > 0) {
    return (
      <div className="animate-fadeIn">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Daily PM Inspection</h1>
          <p className="text-gray-500 text-sm mt-1">점검을 시작할 작업자를 선택하세요</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-user-circle text-indigo-500 text-2xl" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">나는 누구입니까?</h2>
            <p className="text-sm text-gray-500 mt-1">선택 후 자신의 점검 항목만 표시됩니다</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-md mx-auto">
            {workers.map((w) => (
              <button key={w.id} onClick={() => selectWorker(w.id)}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-user text-indigo-600 text-sm" />
                </div>
                <div className="font-semibold text-gray-900 text-sm">{w.name}</div>
                <div className="text-xs text-gray-400">{w.emp_id}</div>
                {doneWorkerIds.has(w.id) && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">완료</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      {/* Tool 경고 팝업 */}
      {showWarning && toolWarnings.length > 0 && (
        <ToolWarningPopup warnings={toolWarnings} onClose={dismissWarning} />
      )}

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily PM Inspection</h1>
          <p className="text-gray-500 text-sm mt-1">매일 수행하는 ESD 안전 및 장비 점검</p>
        </div>
        {myWorker && (
          <button onClick={() => { setSelectedWorkerId(null); localStorage.removeItem("pm_selected_worker_id"); }}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors mt-1">
            <i className="fas fa-exchange-alt" />작업자 변경
          </button>
        )}
      </div>

      {/* 팀 전체 현황 (컴팩트) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-700">
            <i className="fas fa-users text-gray-400 mr-2" />오늘 팀 점검 현황
          </span>
          <span className="text-xs text-gray-400">{today} · {doneCount}/{workers.length} 완료</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {workers.map((w) => (
            <div key={w.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
              w.id === selectedWorkerId
                ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                : doneWorkerIds.has(w.id)
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-gray-50 border-gray-200 text-gray-500"
            }`}>
              <i className={`fas ${doneWorkerIds.has(w.id) ? "fa-check-circle text-green-500" : "fa-circle text-gray-300"} text-[10px]`} />
              {w.name}
              {w.id === selectedWorkerId && <span className="ml-1 text-[10px] opacity-70">(나)</span>}
            </div>
          ))}
        </div>
      </div>

      {/* 내 점검 폼 */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900">
            <i className="fas fa-user-check text-indigo-500 mr-2" />작업자별 점검
          </h3>
          <Badge color="blue">작업자 각각 수행</Badge>
        </div>
        <div className="space-y-4">
          {myWorker ? (
            <WorkerInspectionCard
              key={myWorker.id}
              worker={myWorker}
              videoLinks={videoLinks}
              initialDone={doneWorkerIds.has(myWorker.id)}
              onDone={(id) => setDoneWorkerIds((prev) => new Set([...prev, id]))}
            />
          ) : (
            <p className="text-center text-gray-400 py-8 text-sm">작업자 데이터를 불러오는 중...</p>
          )}
        </div>
      </Card>

      {/* Hi-pot */}
      <HipotCard videoLinks={videoLinks} workerName={myWorker?.name ?? ""} />

      {/* 위생관리 */}
      <HygieneCard workerName={myWorker?.name ?? ""} />
    </div>
  );
}
