"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type HistoryType = "daily" | "monthly" | "biyearly";

function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function ResultCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-gray-300">-</span>;
  return value === "Pass" || value === "OK"
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-semibold">✓ {value}</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-xs font-semibold">✗ {value}</span>;
}

export default function HistoryPage() {
  const [histType, setHistType] = useState<HistoryType>("daily");
  const [fromDate, setFromDate] = useState(getTodayStr().slice(0, 8) + "01");
  const [toDate, setToDate] = useState(getTodayStr());
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadHistory() {
    setLoading(true);
    let data: Record<string, unknown>[] = [];

    if (histType === "daily") {
      const [{ data: w }, { data: h }] = await Promise.all([
        supabase.from("daily_worker_inspections").select("*")
          .gte("inspection_date", fromDate).lte("inspection_date", toDate).order("inspection_date", { ascending: false }),
        supabase.from("daily_hipot_inspections").select("*")
          .gte("inspection_date", fromDate).lte("inspection_date", toDate).order("inspection_date", { ascending: false }),
      ]);
      const workers = (w || []).map((r) => ({ ...r, _type: "worker" }));
      const hipots = (h || []).map((r) => ({ ...r, _type: "hipot" }));
      data = [...workers, ...hipots].sort((a, b) =>
        String(b.inspection_date) > String(a.inspection_date) ? 1 : -1
      );
    } else if (histType === "monthly") {
      const { data: m } = await supabase.from("monthly_inspections").select("*")
        .gte("period", fromDate.slice(0, 7)).lte("period", toDate.slice(0, 7)).order("period", { ascending: false });
      data = (m || []).map((r) => ({ ...r, _type: "monthly" }));
    } else {
      const { data: b } = await supabase.from("biyearly_inspections").select("period, inspector, overall_result, created_at")
        .order("period", { ascending: false });
      data = (b || []).map((r) => ({ ...r, _type: "biyearly" }));
    }

    setRows(data);
    setLoading(false);
  }

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">점검 이력 조회</h1>
        <p className="text-gray-500 text-sm mt-1">기간별, 유형별 점검 기록 조회</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex gap-2">
            {(["daily", "monthly", "biyearly"] as HistoryType[]).map((t) => (
              <button key={t} onClick={() => setHistType(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${histType === t ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {t === "daily" ? "Daily" : t === "monthly" ? "Monthly" : "Bi-yearly"}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <input type="date" className="input-base" style={{ width: 150 }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <span className="text-gray-400">~</span>
            <input type="date" className="input-base" style={{ width: 150 }} value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <button onClick={loadHistory}
              className="px-5 py-2 rounded-xl font-semibold text-white text-sm"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              <i className="fas fa-search mr-1" />조회
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <i className="fas fa-inbox text-3xl mb-3 block" />조회 조건을 선택하세요
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">일자/기간</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">유형</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">작업자/검사자</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">주요 항목</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">종합 결과</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">비고</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <HistoryRow key={i} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryRow({ row }: { row: Record<string, unknown> }) {
  const type = row._type as string;

  if (type === "worker") {
    const overall = row.esd_result === "Pass" && row.wrist_result === "Pass" && row.torque_result === "Pass" ? "Pass"
      : row.esd_result === "Fail" || row.wrist_result === "Fail" || row.torque_result === "Fail" ? "Fail" : null;
    return (
      <tr className="border-b hover:bg-gray-50">
        <td className="py-3 px-4 text-gray-700">{String(row.inspection_date || "")}</td>
        <td className="py-3 px-4"><span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">Daily 작업자</span></td>
        <td className="py-3 px-4 text-gray-700">{String(row.worker_name || "")}</td>
        <td className="py-3 px-4 text-center">
          <div className="flex gap-1 justify-center flex-wrap">
            <span className="text-xs text-gray-500">ESD:</span><ResultCell value={String(row.esd_result || "")} />
            <span className="text-xs text-gray-500">어스링:</span><ResultCell value={String(row.wrist_result || "")} />
            {Boolean(row.torque_result) && <><span className="text-xs text-gray-500">Torque:</span><ResultCell value={String(row.torque_result)} /></>}
          </div>
        </td>
        <td className="py-3 px-4 text-center"><ResultCell value={overall} /></td>
        <td className="py-3 px-4 text-gray-500 text-xs">{String(row.remarks || "-")}</td>
      </tr>
    );
  }

  if (type === "hipot") {
    return (
      <tr className="border-b hover:bg-gray-50">
        <td className="py-3 px-4 text-gray-700">{String(row.inspection_date || "")}</td>
        <td className="py-3 px-4"><span className="bg-amber-50 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">Daily Hi-pot</span></td>
        <td className="py-3 px-4 text-gray-700">{String(row.inspector || "-")}</td>
        <td className="py-3 px-4 text-center">
          <div className="flex gap-1 justify-center flex-wrap">
            <span className="text-xs text-gray-500">Pass시료:</span><ResultCell value={String(row.pass_sample_result || "")} />
            <span className="text-xs text-gray-500">Fail시료:</span><ResultCell value={String(row.fail_sample_result || "")} />
          </div>
        </td>
        <td className="py-3 px-4 text-center"><ResultCell value={String(row.overall_result || "")} /></td>
        <td className="py-3 px-4 text-gray-500 text-xs">{String(row.remarks || "-")}</td>
      </tr>
    );
  }

  if (type === "monthly") {
    return (
      <tr className="border-b hover:bg-gray-50">
        <td className="py-3 px-4 text-gray-700">{String(row.period || "")}</td>
        <td className="py-3 px-4"><span className="bg-purple-50 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full">Monthly</span></td>
        <td className="py-3 px-4 text-gray-700">{String(row.inspector || "-")}</td>
        <td className="py-3 px-4 text-center">
          <div className="flex gap-1 justify-center flex-wrap">
            <span className="text-xs text-gray-500">Load:</span><ResultCell value={row.load_pass_result as string} />
            <span className="text-xs text-gray-500">Gloves:</span><ResultCell value={row.gloves_result as string} />
          </div>
        </td>
        <td className="py-3 px-4 text-center"><ResultCell value={row.overall_result as string} /></td>
        <td className="py-3 px-4 text-gray-500 text-xs">{String(row.remarks || "-")}</td>
      </tr>
    );
  }

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="py-3 px-4 text-gray-700">{String(row.period || "")}</td>
      <td className="py-3 px-4"><span className="bg-green-50 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">Bi-yearly</span></td>
      <td className="py-3 px-4 text-gray-700">{String(row.inspector || "-")}</td>
      <td className="py-3 px-4 text-center text-xs text-gray-500">ESD 접지 상태 (표면 5개, 손목띠 5개)</td>
      <td className="py-3 px-4 text-center"><ResultCell value={row.overall_result as string} /></td>
      <td className="py-3 px-4 text-gray-500 text-xs">-</td>
    </tr>
  );
}
