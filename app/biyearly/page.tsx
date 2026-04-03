"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PassFail, BiyearlyInspection } from "@/lib/types";

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() < 6 ? "H1" : "H2"}`;
}

function CheckBtn({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  const isOk = label === "OK";
  const base = "px-4 py-2 rounded-lg text-sm font-semibold transition-all border-2 cursor-pointer";
  const style = isOk
    ? selected ? `${base} bg-green-600 text-white border-green-600` : `${base} bg-green-50 text-green-700 border-green-500 hover:bg-green-600 hover:text-white`
    : selected ? `${base} bg-red-600 text-white border-red-600` : `${base} bg-red-50 text-red-700 border-red-500 hover:bg-red-600 hover:text-white`;
  return <button className={style} onClick={onClick}>{label}</button>;
}

interface MeasRow {
  id: string;
  result: PassFail | null;
}

const EMPTY_ROWS = (): MeasRow[] => Array.from({ length: 5 }, () => ({ id: "", result: null }));

export default function BiyearlyPage() {
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [inspector, setInspector] = useState("");
  const [surfaces, setSurfaces] = useState<MeasRow[]>(EMPTY_ROWS());
  const [wrists, setWrists] = useState<MeasRow[]>(EMPTY_ROWS());
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [existing, setExisting] = useState(false);

  const currentYear = new Date().getFullYear();
  const periodOptions = [];
  for (let y = currentYear - 1; y <= currentYear + 1; y++) {
    periodOptions.push(`${y}-H1`, `${y}-H2`);
  }

  useEffect(() => {
    supabase.from("biyearly_inspections").select("*").eq("period", period).maybeSingle()
      .then(({ data }) => {
        if (!data) { setExisting(false); setSurfaces(EMPTY_ROWS()); setWrists(EMPTY_ROWS()); return; }
        setExisting(true);
        const d = data as BiyearlyInspection;
        setInspector(d.inspector || "");
        setSurfaces([
          { id: d.surface_1_id || "", result: d.surface_1_result },
          { id: d.surface_2_id || "", result: d.surface_2_result },
          { id: d.surface_3_id || "", result: d.surface_3_result },
          { id: d.surface_4_id || "", result: d.surface_4_result },
          { id: d.surface_5_id || "", result: d.surface_5_result },
        ]);
        setWrists([
          { id: d.wrist_1_id || "", result: d.wrist_1_result },
          { id: d.wrist_2_id || "", result: d.wrist_2_result },
          { id: d.wrist_3_id || "", result: d.wrist_3_result },
          { id: d.wrist_4_id || "", result: d.wrist_4_result },
          { id: d.wrist_5_id || "", result: d.wrist_5_result },
        ]);
        setRemarks(d.remarks || "");
      });
  }, [period]);

  function updateId(type: "surface" | "wrist", idx: number, value: string) {
    const setter = type === "surface" ? setSurfaces : setWrists;
    setter((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], id: value };
      return next;
    });
  }

  function setResult(type: "surface" | "wrist", idx: number, result: PassFail) {
    const setter = type === "surface" ? setSurfaces : setWrists;
    setter((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], result };
      return next;
    });
  }

  const overallResult: PassFail | null = (() => {
    const all = [...surfaces, ...wrists].map((r) => r.result).filter(Boolean);
    if (all.length === 0) return null;
    return all.every((r) => r === "Pass") ? "Pass" : "Fail";
  })();

  async function handleSubmit() {
    setSaving(true);
    const payload: Record<string, unknown> = {
      period,
      inspector: inspector || null,
      overall_result: overallResult,
      remarks: remarks || null,
    };
    surfaces.forEach((r, i) => {
      payload[`surface_${i + 1}_id`] = r.id || null;
      payload[`surface_${i + 1}_value`] = null;
      payload[`surface_${i + 1}_result`] = r.result;
    });
    wrists.forEach((r, i) => {
      payload[`wrist_${i + 1}_id`] = r.id || null;
      payload[`wrist_${i + 1}_value`] = null;
      payload[`wrist_${i + 1}_result`] = r.result;
    });
    const { error } = await supabase.from("biyearly_inspections").upsert(payload, { onConflict: "period" });
    setSaving(false);
    if (error) setMsg({ type: "err", text: "저장 실패: " + error.message });
    else { setExisting(true); setMsg({ type: "ok", text: "저장 완료!" }); }
  }

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bi-yearly PM Inspection</h1>
        <p className="text-gray-500 text-sm mt-1">반기별 수행하는 ESD 접지 상태 점검</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {/* 헤더 */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div>
            <label className="text-xs text-gray-500 block mb-1">점검 반기</label>
            <select className="input-base" style={{ width: 160 }} value={period} onChange={(e) => setPeriod(e.target.value)}>
              {periodOptions.map((p) => <option key={p} value={p}>{p.replace("H1", "상반기").replace("H2", "하반기").replace("-", "년 ")}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">검사자 ID</label>
            <input className="input-base" style={{ width: 160 }} placeholder="검사자 입력"
              value={inspector} onChange={(e) => setInspector(e.target.value)} />
          </div>
          <div className="flex items-end pb-0.5">
            <span className="font-mono bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-sm">측정 장비: DVM (멀티미터)</span>
          </div>
          {existing && (
            <div className="ml-auto">
              <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                <i className="fas fa-edit mr-1" />기존 데이터 수정 모드
              </span>
            </div>
          )}
        </div>

        <div className="bg-amber-50 rounded-xl border border-amber-100 p-5">
          <div className="flex items-center gap-3 mb-3">
            <i className="fas fa-table text-amber-500" />
            <h4 className="font-bold text-gray-900">Table ESD 접지 상태 점검</h4>
          </div>
          <div className="text-sm text-gray-600 mb-5">
            측정 방법: GND Connected → OK / Not Connected → NG
          </div>

          {/* 두 섹션 나란히 */}
          <div className="flex gap-4">
            <div className="flex-1 min-w-0">
              <MeasTable
                title="① 작업대 표면"
                spec="Spec: 1Ω ~ 1GΩ"
                idLabel="작업대#"
                rows={surfaces}
                type="surface"
                onIdChange={updateId}
                onResult={setResult}
              />
            </div>
            <div className="flex-1 min-w-0">
              <MeasTable
                title="② 작업자용 손목띠 (어스링)"
                spec="Spec: 1MΩ ± 10%"
                idLabel="어스링#"
                rows={wrists}
                type="wrist"
                onIdChange={updateId}
                onResult={setResult}
              />
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
            <i className="fas fa-info-circle mr-2" />
            Static Dissipation 조건 확인 - 작업 시 발생하는 정전기를 효율적으로 방전시키기 위한 점검
          </div>
        </div>

        {/* 비고 & 제출 */}
        <div className="mt-6 pt-5 border-t flex items-end gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700 mb-2 block">종합 비고</label>
            <textarea className="input-base resize-none" rows={2} placeholder="특이사항 입력..."
              value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
          <div className="text-right">
            {overallResult && (
              <div className={`mb-3 px-4 py-2 rounded-xl font-bold ${overallResult === "Pass" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                종합 결과: {overallResult}
              </div>
            )}
            {msg && <p className={`text-xs mb-2 ${msg.type === "ok" ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
            <button onClick={handleSubmit} disabled={saving}
              className="px-8 py-3 rounded-xl font-bold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              {saving ? "저장 중..." : <><i className="fas fa-check mr-2" />Bi-yearly 점검 완료</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MeasTable({ title, spec, idLabel, rows, type, onIdChange, onResult }: {
  title: string;
  spec: string;
  idLabel: string;
  rows: MeasRow[];
  type: "surface" | "wrist";
  onIdChange: (type: "surface" | "wrist", idx: number, value: string) => void;
  onResult: (type: "surface" | "wrist", idx: number, result: PassFail) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-bold text-gray-800">{title}</span>
        <span className="font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">{spec}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 rounded-t-lg">
            <th className="py-2 px-2 text-center text-xs font-semibold text-gray-500 w-8">#</th>
            <th className="py-2 px-2 text-center text-xs font-semibold text-gray-500">{idLabel}</th>
            <th className="py-2 px-2 text-center text-xs font-semibold text-gray-500">판정</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              <td className="py-2 px-2 text-center text-sm text-gray-500">{i + 1}</td>
              <td className="py-2 px-2 text-center">
                <input
                  className="input-base text-center text-sm"
                  style={{ width: 80 }}
                  placeholder="예: Z01"
                  value={row.id}
                  onChange={(e) => onIdChange(type, i, e.target.value)}
                />
              </td>
              <td className="py-2 px-2 text-center">
                <div className="flex gap-1.5 justify-center">
                  <CheckBtn label="OK" selected={row.result === "Pass"} onClick={() => onResult(type, i, "Pass")} />
                  <CheckBtn label="NG" selected={row.result === "Fail"} onClick={() => onResult(type, i, "Fail")} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
