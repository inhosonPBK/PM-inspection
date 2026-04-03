"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const LSL = 12.32, USL = 16.67;

interface TrendData {
  tool_id: string;
  count: number;
  avg: number;
  min: number;
  max: number;
  values: number[];
}

function calcCpk(avg: number, std: number) {
  if (std === 0) return { cpk: 0, cp: 0 };
  const cpu = (USL - avg) / (3 * std);
  const cpl = (avg - LSL) / (3 * std);
  return { cpk: Math.min(cpu, cpl), cp: (USL - LSL) / (6 * std) };
}

function cpkGrade(cpk: number) {
  if (cpk >= 1.67) return { label: "A (우수)", color: "text-green-600", bg: "bg-green-50" };
  if (cpk >= 1.33) return { label: "B (양호)", color: "text-blue-600", bg: "bg-blue-50" };
  if (cpk >= 1.00) return { label: "C (보통)", color: "text-yellow-600", bg: "bg-yellow-50" };
  if (cpk >= 0.67) return { label: "D (주의)", color: "text-orange-600", bg: "bg-orange-50" };
  return { label: "F (부적합)", color: "text-red-600", bg: "bg-red-50" };
}

function positionPercent(avg: number) {
  return Math.min(100, Math.max(0, ((avg - LSL) / (USL - LSL)) * 100));
}

// ─── Cpk 게이지 바 ────────────────────────────────────────
function CpkGauge({ cpk }: { cpk: number }) {
  const MAX = 2.5;
  const GRADES = [
    { from: 0,    to: 0.67, label: "F",         color: "#ef4444" },
    { from: 0.67, to: 1.00, label: "D",         color: "#f97316" },
    { from: 1.00, to: 1.33, label: "C",         color: "#eab308" },
    { from: 1.33, to: 1.67, label: "B",         color: "#60a5fa" },
    { from: 1.67, to: MAX,  label: "A (≥1.67)", color: "#22c55e" },
  ];
  const pct = Math.min(100, (cpk / MAX) * 100);
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-600">공정능력지수 (Cpk)</span>
        <span className={`text-sm font-bold ${cpkGrade(cpk).color}`}>{cpk.toFixed(2)}</span>
      </div>
      <div className="relative h-7 rounded-lg overflow-hidden flex">
        {GRADES.map((g) => (
          <div key={g.label} className="relative flex items-center justify-center text-white text-[10px] font-bold"
            style={{ width: `${((g.to - g.from) / MAX) * 100}%`, backgroundColor: g.color }}>
            {g.label}
          </div>
        ))}
        {/* 현재 값 마커 */}
        <div className="absolute top-0 h-full w-0.5 bg-black/60" style={{ left: `${pct}%` }} />
        <div className="absolute -top-0.5 w-2 h-2 bg-black/70 rotate-45 -translate-x-1/2"
          style={{ left: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        {[0, 0.67, 1.00, 1.33, 1.67, 2.50].map((v) => (
          <span key={v}>{v}</span>
        ))}
      </div>
    </div>
  );
}

// ─── 공정능력 분포도 (대형 SVG) ───────────────────────────
function CapabilityChart({ values, avg, std }: { values: number[]; avg: number; std: number }) {
  const TARGET = (LSL + USL) / 2;
  const W = 900, H = 320;
  const PAD = { top: 30, right: 40, bottom: 50, left: 44 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const DOT_ZONE = 28; // 하단 dot 영역 높이

  const xMin = Math.min(LSL - 2 * std, avg - 4.2 * std);
  const xMax = Math.max(USL + 2 * std, avg + 4.2 * std);
  const xRange = xMax - xMin;

  // 히스토그램
  const BIN_N = Math.max(8, Math.min(16, Math.round(1 + Math.log2(Math.max(values.length, 2)))));
  const binW = xRange / BIN_N;
  const bins = Array(BIN_N).fill(0);
  values.forEach((v) => {
    const idx = Math.min(BIN_N - 1, Math.max(0, Math.floor((v - xMin) / binW)));
    bins[idx]++;
  });

  const pdf = (x: number) =>
    (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - avg) / std) ** 2);
  const pdfPeak = pdf(avg);
  const histPeak = Math.max(...bins) / (values.length * binW);
  const yMax = Math.max(pdfPeak, histPeak) * 1.18;

  const plotH = cH - DOT_ZONE;
  const xs = (v: number) => PAD.left + ((v - xMin) / xRange) * cW;
  const ys = (d: number) => PAD.top + plotH - Math.min(1, d / yMax) * plotH;
  const yBase = PAD.top + plotH;
  const yDotCenter = yBase + DOT_ZONE / 2;

  // 정규분포 곡선
  const STEPS = 160;
  const curvePts = Array.from({ length: STEPS + 1 }, (_, i) => {
    const x = xMin + (i / STEPS) * xRange;
    return `${i === 0 ? "M" : "L"}${xs(x).toFixed(1)},${ys(pdf(x)).toFixed(1)}`;
  }).join(" ");

  // 곡선 아래 면적 fill
  const fillPts = `${xs(xMin).toFixed(1)},${yBase} ` + curvePts.slice(1) + ` L${xs(xMax).toFixed(1)},${yBase} Z`;

  // X 축 눈금
  const step = (USL - LSL) / 4;
  const xTicks: number[] = [];
  for (let v = Math.ceil((xMin) / step) * step; v <= xMax + 0.001; v += step) {
    xTicks.push(+v.toFixed(2));
  }

  // 개별 측정값 dot (하단 strip plot, 약간의 y 지터)
  const seed = (i: number) => ((i * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const dots = values.map((v, i) => ({
    cx: xs(v),
    cy: yDotCenter + (seed(i) - 0.5) * (DOT_ZONE - 10),
    outSpec: v < LSL || v > USL,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-600">
          <i className="fas fa-chart-area text-indigo-400 mr-1" />공정능력 분포도
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-3">
          <span><span className="inline-block w-3 h-0.5 bg-red-400 align-middle mr-1" style={{borderTop:"2px dashed #f87171"}} />LSL/USL</span>
          <span><span className="inline-block w-3 h-0.5 bg-indigo-500 align-middle mr-1" />분포곡선</span>
          <span><span className="inline-block w-3 h-0.5 bg-teal-400 align-middle mr-1" style={{borderTop:"2px dashed #2dd4bf"}} />목표값</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        {/* 스펙 외 배경 (좌/우) */}
        <rect x={PAD.left} y={PAD.top} width={Math.max(0, xs(LSL) - PAD.left)} height={plotH} fill="#fee2e2" opacity={0.5} />
        <rect x={xs(USL)} y={PAD.top} width={Math.max(0, PAD.left + cW - xs(USL))} height={plotH} fill="#fee2e2" opacity={0.5} />
        {/* 스펙 내 배경 */}
        <rect x={xs(LSL)} y={PAD.top} width={xs(USL) - xs(LSL)} height={plotH} fill="#dcfce7" opacity={0.35} />

        {/* 히스토그램 */}
        {bins.map((cnt, i) => {
          const bx0 = xMin + i * binW;
          const density = cnt / (values.length * binW);
          const bH = (density / yMax) * plotH;
          const inSpec = (bx0 + binW / 2) >= LSL && (bx0 + binW / 2) <= USL;
          return (
            <rect key={i}
              x={xs(bx0) + 0.5} y={yBase - bH}
              width={Math.max(0, xs(bx0 + binW) - xs(bx0) - 1)} height={bH}
              fill={inSpec ? "#86efac" : "#fca5a5"} opacity={0.65}
              stroke="#fff" strokeWidth={0.5}
            />
          );
        })}

        {/* 곡선 아래 면적 (반투명) */}
        <path d={`M${xs(xMin).toFixed(1)},${yBase} ${curvePts.slice(1)} L${xs(xMax).toFixed(1)},${yBase} Z`}
          fill="#818cf8" opacity={0.12} />

        {/* 정규분포 곡선 */}
        <path d={curvePts} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinejoin="round" />

        {/* LSL 선 */}
        <line x1={xs(LSL)} y1={PAD.top} x2={xs(LSL)} y2={PAD.top + cH} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6,4" />
        <text x={xs(LSL)} y={PAD.top - 8} textAnchor="middle" fill="#ef4444" fontSize={11} fontWeight="bold">LSL</text>
        <text x={xs(LSL)} y={PAD.top - 0} textAnchor="middle" fill="#ef4444" fontSize={9}>{LSL}</text>

        {/* USL 선 */}
        <line x1={xs(USL)} y1={PAD.top} x2={xs(USL)} y2={PAD.top + cH} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6,4" />
        <text x={xs(USL)} y={PAD.top - 8} textAnchor="middle" fill="#ef4444" fontSize={11} fontWeight="bold">USL</text>
        <text x={xs(USL)} y={PAD.top - 0} textAnchor="middle" fill="#ef4444" fontSize={9}>{USL}</text>

        {/* 평균 선 */}
        <line x1={xs(avg)} y1={PAD.top} x2={xs(avg)} y2={yBase} stroke="#6366f1" strokeWidth={1.5} strokeDasharray="7,4" />
        <text x={xs(avg)} y={PAD.top - 8} textAnchor="middle" fill="#6366f1" fontSize={10} fontWeight="bold">X̄={avg.toFixed(2)}</text>

        {/* 목표값 (Target) */}
        <line x1={xs(TARGET)} y1={PAD.top} x2={xs(TARGET)} y2={PAD.top + cH} stroke="#2dd4bf" strokeWidth={1.5} strokeDasharray="6,4" />
        <text x={xs(TARGET)} y={PAD.top + cH + 14} textAnchor="middle" fill="#0d9488" fontSize={9} fontWeight="bold">Target</text>
        <text x={xs(TARGET)} y={PAD.top + cH + 23} textAnchor="middle" fill="#0d9488" fontSize={9}>{TARGET.toFixed(2)}</text>

        {/* 개별 측정값 dot strip */}
        <line x1={PAD.left} y1={yBase + 1} x2={PAD.left + cW} y2={yBase + 1} stroke="#e5e7eb" strokeWidth={1} />
        {dots.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={3}
            fill={d.outSpec ? "#ef4444" : "#6366f1"} opacity={0.6} />
        ))}

        {/* X 축 */}
        <line x1={PAD.left} y1={PAD.top + cH} x2={PAD.left + cW} y2={PAD.top + cH} stroke="#9ca3af" strokeWidth={1} />
        {xTicks.map((v) => (
          <g key={v}>
            <line x1={xs(v)} y1={PAD.top + cH} x2={xs(v)} y2={PAD.top + cH + 4} stroke="#9ca3af" strokeWidth={1} />
            <text x={xs(v)} y={PAD.top + cH + 14} textAnchor="middle" fill="#6b7280" fontSize={9}>{v.toFixed(2)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function TrendPage() {
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<TrendData | null>(null);

  async function loadTrends() {
    setLoading(true);
    const { data } = await supabase.from("daily_worker_inspections")
      .select("tool_id, torque_1, torque_2, torque_3")
      .not("tool_id", "is", null).not("tool_id", "eq", "");

    if (!data) { setLoading(false); return; }

    const map = new Map<string, number[]>();
    data.forEach((r) => {
      const tid = String(r.tool_id);
      if (!map.has(tid)) map.set(tid, []);
      [r.torque_1, r.torque_2, r.torque_3].forEach((v) => {
        if (v !== null && v !== undefined) map.get(tid)!.push(Number(v));
      });
    });

    const result: TrendData[] = [];
    map.forEach((vals, tool_id) => {
      if (vals.length === 0) return;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      result.push({ tool_id, count: vals.length, avg, min, max, values: vals });
    });
    result.sort((a, b) => a.tool_id.localeCompare(b.tool_id));
    setTrends(result);
    setLoading(false);
  }

  useEffect(() => { loadTrends(); }, []);

  function getStd(values: number[]) {
    if (values.length < 2) return 0.15;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1);
    return Math.sqrt(variance) || 0.15;
  }

  const warnings = trends.filter((t) => {
    const pos = positionPercent(t.avg);
    return pos < 10 || pos > 90;
  });

  return (
    <div className="animate-fadeIn">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">트렌드 분석</h1>
          <p className="text-gray-500 text-sm mt-1">Tool별 토크 측정 트렌드 및 교체 시기 알람</p>
        </div>
        <button onClick={loadTrends}
          className="px-4 py-2 rounded-xl font-semibold text-white text-sm"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
          <i className="fas fa-sync-alt mr-2" />새로고침
        </button>
      </div>

      {warnings.length > 0 && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <i className="fas fa-exclamation-triangle text-amber-500" />
            <span className="font-bold text-amber-700">점검 필요 Tool ({warnings.length}개)</span>
          </div>
          <div className="space-y-1">
            {warnings.map((w) => (
              <div key={w.tool_id} className="flex items-center justify-between p-2 bg-white rounded-lg text-sm">
                <span className="font-medium">{w.tool_id}</span>
                <span className="text-amber-600">평균: {w.avg.toFixed(2)} lbf.in · 스펙위치: {positionPercent(w.avg).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5">
        <h3 className="font-bold text-gray-800 mb-4">Tool별 트렌드 현황</h3>

        {/* 스펙 바 */}
        <div className="mb-5 p-4 bg-gray-50 rounded-xl">
          <div className="text-xs text-gray-500 mb-2">Torque 스펙 범위: {LSL} ~ {USL} lbf.in · 경고 구간: 하위 10% / 상위 90%</div>
          <div className="relative h-6 rounded-full overflow-hidden" style={{ background: "linear-gradient(to right, #fca5a5, #86efac, #fca5a5)" }}>
            <div className="absolute left-[10%] top-0 h-full w-[80%] bg-green-200/50" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-gray-700">14.5 (중앙)</div>
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1"><span>{LSL}</span><span>{USL}</span></div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />불러오는 중...</div>
        ) : trends.length === 0 ? (
          <div className="py-10 text-center text-gray-400">등록된 Tool 데이터가 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                {["Tool ID", "샘플 수", "평균값", "스펙 위치", "Cpk", "상태"].map((h) => (
                  <th key={h} className={`py-3 px-4 font-semibold text-gray-600 ${h !== "Tool ID" ? "text-center" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trends.map((t) => {
                const std = getStd(t.values);
                const { cpk } = calcCpk(t.avg, std);
                const pos = positionPercent(t.avg);
                const warn = pos < 10 || pos > 90;
                const grade = cpkGrade(cpk);
                return (
                  <tr key={t.tool_id} className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelected(selected?.tool_id === t.tool_id ? null : t)}>
                    <td className="py-3 px-4 font-medium text-indigo-600">{t.tool_id}</td>
                    <td className="py-3 px-4 text-center">{t.count}</td>
                    <td className="py-3 px-4 text-center font-mono">{t.avg.toFixed(2)}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${warn ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${pos}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{pos.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`font-bold ${grade.color}`}>{cpk.toFixed(2)}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${grade.bg} ${grade.color}`}>{grade.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 상세 분석 */}
      {selected && (() => {
        const std = getStd(selected.values);
        const { cpk, cp } = calcCpk(selected.avg, std);
        const cpu = (USL - selected.avg) / (3 * std);
        const cpl = (selected.avg - LSL) / (3 * std);
        const grade = cpkGrade(cpk);
        return (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-gray-900 text-lg">{selected.tool_id}</h3>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${grade.bg} ${grade.color}`}>
                  {grade.label}
                </span>
                <span className="text-xs text-gray-400">Spec: {LSL} ~ {USL} lbf.in</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times" />
              </button>
            </div>

            {/* KPI 카드 4개 */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: "평균값 (lbf.in)", value: selected.avg.toFixed(2), sub: `N=${selected.count}`, color: "text-gray-900" },
                { label: "표준편차 (σ)", value: std.toFixed(3), sub: `Min ${selected.min.toFixed(2)} / Max ${selected.max.toFixed(2)}`, color: "text-gray-900" },
                { label: "Cpk", value: cpk.toFixed(2), sub: `Cp ${cp.toFixed(2)}`, color: grade.color },
                { label: "등급", value: grade.label.split(" ")[0], sub: grade.label.split(" ")[1] || "", color: grade.color },
              ].map((item) => (
                <div key={item.label} className={`p-4 rounded-xl border ${item.color === "text-gray-900" ? "bg-gray-50 border-gray-100" : `${grade.bg} border-transparent`}`}>
                  <div className={`text-3xl font-bold ${item.color}`}>{item.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{item.label}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{item.sub}</div>
                </div>
              ))}
            </div>

            {/* Cpk 게이지 */}
            <CpkGauge cpk={cpk} />

            {/* 세부 지수 (작은 보조 수치) */}
            <div className="grid grid-cols-6 gap-2 mb-5 text-center">
              {[["Cpu (상한)", cpu.toFixed(2)], ["Cpl (하한)", cpl.toFixed(2)],
                ["Cp", cp.toFixed(2)], ["샘플 수", String(selected.count)],
                ["최솟값", selected.min.toFixed(2)], ["최댓값", selected.max.toFixed(2)]].map(([k, v]) => (
                <div key={String(k)} className="p-2 bg-gray-50 rounded-lg">
                  <div className="text-sm font-bold text-gray-700">{v}</div>
                  <div className="text-[10px] text-gray-500">{k}</div>
                </div>
              ))}
            </div>

            {/* 분포도 차트 — 전체 너비 */}
            <CapabilityChart values={selected.values} avg={selected.avg} std={std} />
          </div>
        );
      })()}
    </div>
  );
}
