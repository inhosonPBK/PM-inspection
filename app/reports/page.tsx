"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ReportType = "daily-worker" | "daily-hipot" | "monthly" | "biyearly" | "daily-hygiene";

interface QMSInfo { docNum: string; rev: string; effDate: string; title: string; sheetTitle: string; }

const QMS_INFO: Record<ReportType, QMSInfo> = {
  "daily-worker": { docNum: "QP707-12", rev: "1", effDate: "1/9/2026", title: "Daily Check Sheet_Worker PM Inspection", sheetTitle: "Daily Check Sheet (Worker PM Inspection)" },
  "daily-hipot": { docNum: "QP707-9", rev: "2", effDate: "1/9/2026", title: "Daily Check Sheet_Safety tester", sheetTitle: "Daily Check Sheet (Safety Tester)" },
  "monthly": { docNum: "QP707-13", rev: "1", effDate: "1/9/2026", title: "Monthly Check Sheet_PM Inspection", sheetTitle: "Monthly Check Sheet" },
  "biyearly": { docNum: "QP707-14", rev: "1", effDate: "1/9/2026", title: "Bi-yearly Check Sheet_Table ESD", sheetTitle: "Bi-yearly Check Sheet (Table ESD 접지 상태 점검)" },
  "daily-hygiene": { docNum: "QP602-2", rev: "1", effDate: "1/9/2026", title: "Hygiene Management Inspection Log", sheetTitle: "위생관리 점검 기록" },
};

function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function getMonthStart() { return getTodayStr().slice(0, 8) + "01"; }

// "2026-02-09" → "02/09/26"
function fmtDate(s: string): string {
  if (!s) return "-";
  const p = s.slice(0, 10).split("-");
  return p.length === 3 ? `${p[1]}/${p[2]}/${p[0].slice(2)}` : s;
}

// ISO UTC → "MM/DD/YY HH:MM" KST
function fmtApproval(iso: string | null | undefined): string {
  if (!iso) return "-";
  const kst = new Date(new Date(iso).getTime() + 9 * 3600000);
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  const yy = String(kst.getUTCFullYear()).slice(2);
  return `${mm}/${dd}/${yy} ${String(kst.getUTCHours()).padStart(2, "0")}:${String(kst.getUTCMinutes()).padStart(2, "0")}`;
}

const B = "1px solid #000";
const th: React.CSSProperties = { border: B, padding: "5px 6px", backgroundColor: "#f0f0f0", textAlign: "center", fontWeight: "bold", fontSize: "11px" };
const td: React.CSSProperties = { border: B, padding: "4px 6px", fontSize: "11px" };
const tdc: React.CSSProperties = { ...td, textAlign: "center" };

function PrintHeader({ type }: { type: ReportType }) {
  const i = QMS_INFO[type];
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12px", fontSize: "11px" }}>
      <tbody>
        <tr>
          <td rowSpan={2} style={{ ...td, fontWeight: "bold", width: "18%", verticalAlign: "middle" }}><strong>Promega BioSystems</strong><br />KOREA</td>
          <td rowSpan={2} style={{ ...td, textAlign: "center", width: "9%", verticalAlign: "middle" }}>Approved<br /><strong>FORM</strong></td>
          <td style={td}>Document #: <strong>{i.docNum}</strong></td>
          <td style={td}>Revision: <strong>{i.rev}</strong></td>
          <td style={td}>Effective Date: <strong>{i.effDate}</strong></td>
        </tr>
        <tr>
          <td colSpan={3} style={td}>Title: <strong>{i.title}</strong></td>
        </tr>
      </tbody>
    </table>
  );
}

function PrintFooter({ extras }: { extras?: string[] }) {
  return (
    <div style={{ marginTop: "20px", fontSize: "10px" }}>
      {(extras || []).map((e, i) => <p key={i} style={{ margin: "2px 0" }}>{e}</p>)}
      <p style={{ margin: "2px 0" }}>* 위 항목들은 ECO 없이 추가되거나 변경될 수 있다.</p>
      <div style={{ borderTop: "1px solid #aaa", paddingTop: "4px", marginTop: "8px", color: "#555" }}>
        <div>QP401-7 Rev.1 It is the responsibility of the user to ensure this is the current revision</div>
        <div><em>CONFIDENTIAL. Property of PBK. Do Not Reproduce or Distribute Without the Prior Written Permission of PBK</em></div>
      </div>
    </div>
  );
}

// ─── Daily Worker ───────────────────────────────────────────────────────────
function DailyWorkerPrint({ data, fromDate, toDate }: { data: Record<string, unknown>[]; fromDate: string; toDate: string }) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: "20px", color: "#000" }}>
      <PrintHeader type="daily-worker" />
      <h2 style={{ textAlign: "center", fontSize: "15px", fontWeight: "bold", margin: "10px 0" }}>Daily Check Sheet (Worker PM Inspection)</h2>
      <div style={{ fontSize: "12px", marginBottom: "10px" }}>
        <strong>조회 기간:</strong> {fromDate} ~ {toDate}&nbsp;&nbsp;&nbsp;<strong>출력일:</strong> {getTodayStr()}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th rowSpan={2} style={th}>Date</th>
            <th rowSpan={2} style={th}>Tester</th>
            <th rowSpan={2} style={th}>ESD<br />Shoes</th>
            <th rowSpan={2} style={th}>Wrist<br />Strap</th>
            <th colSpan={3} style={th}>Electronic Driver Torque Check</th>
            <th rowSpan={2} style={{ ...th, minWidth: 80 }}>Remarks</th>
            <th rowSpan={2} style={th}>Approval<br />(Date/Time)</th>
          </tr>
          <tr>
            <th style={th}>Tool ID</th>
            <th style={{ ...th, minWidth: 150 }}>Torque (3회)<br />Spec: 12.32~16.67 lbf.in</th>
            <th style={th}>Result</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0
            ? <tr><td colSpan={9} style={{ ...tdc, color: "#666" }}>해당 기간에 기록이 없습니다.</td></tr>
            : data.map((r, i) => (
              <tr key={i}>
                <td style={tdc}>{fmtDate(String(r.inspection_date || ""))}</td>
                <td style={tdc}>{String(r.worker_name || "")}</td>
                <td style={tdc}>{String(r.esd_result || "-")}</td>
                <td style={tdc}>{String(r.wrist_result || "-")}</td>
                <td style={tdc}>{String(r.tool_id || "-")}</td>
                <td style={tdc}>{[r.torque_1, r.torque_2, r.torque_3].filter(Boolean).join(" / ") || "-"}</td>
                <td style={tdc}>{String(r.torque_result || "-")}</td>
                <td style={td}>{String(r.remarks || "")}</td>
                <td style={tdc}>{fmtApproval(r.created_at as string)}</td>
              </tr>
            ))
          }
        </tbody>
      </table>
      <PrintFooter />
    </div>
  );
}

// ─── Daily Hi-pot ────────────────────────────────────────────────────────────
function DailyHipotPrint({ data, fromDate, toDate }: { data: Record<string, unknown>[]; fromDate: string; toDate: string }) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: "20px", color: "#000" }}>
      <PrintHeader type="daily-hipot" />
      <h2 style={{ textAlign: "center", fontSize: "15px", fontWeight: "bold", margin: "10px 0" }}>Daily Check Sheet (Safety Tester)</h2>
      <div style={{ fontSize: "12px", margin: "8px 0 4px" }}>
        <strong>Model:</strong> GPT-9904&nbsp;&nbsp;&nbsp;<strong>Test:</strong> Dummy HI-POT Test (DCW 1.5kV)
      </div>
      <div style={{ fontSize: "12px", marginBottom: "10px" }}>
        <strong>Pass Dummy:</strong> 1490Ω&nbsp;&nbsp;&nbsp;<strong>Fail Dummy:</strong> 1510Ω
      </div>
      <div style={{ fontSize: "12px", marginBottom: "10px" }}>
        <strong>조회 기간:</strong> {fromDate} ~ {toDate}&nbsp;&nbsp;&nbsp;<strong>출력일:</strong> {getTodayStr()}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Date (mm/dd/yy)</th>
            <th style={th}>Pass Dummy<br />(Should be PASS)</th>
            <th style={th}>Fail Dummy<br />(Should be FAIL)</th>
            <th style={th}>Overall Result</th>
            <th style={th}>Tester</th>
            <th style={{ ...th, minWidth: 80 }}>Remarks</th>
            <th style={th}>Approval<br />(Date/Time)</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0
            ? <tr><td colSpan={7} style={{ ...tdc, color: "#666" }}>해당 기간에 기록이 없습니다.</td></tr>
            : data.map((r, i) => (
              <tr key={i}>
                <td style={tdc}>{fmtDate(String(r.inspection_date || ""))}</td>
                <td style={tdc}>{String(r.pass_sample_result || "-")}</td>
                <td style={tdc}>{String(r.fail_sample_result || "-")}</td>
                <td style={tdc}>{String(r.overall_result || "-")}</td>
                <td style={tdc}>{String(r.inspector || "-")}</td>
                <td style={td}>{String(r.remarks || "")}</td>
                <td style={tdc}>{fmtApproval(r.created_at as string)}</td>
              </tr>
            ))
          }
        </tbody>
      </table>
      <PrintFooter />
    </div>
  );
}

// ─── Monthly ─────────────────────────────────────────────────────────────────
function MonthlyPrint({ data, fromDate, toDate }: { data: Record<string, unknown>[]; fromDate: string; toDate: string }) {
  const fixtureOverall = (r: Record<string, unknown>) => {
    const results = [r.mv_fixture1_result, r.mv_fixture2_result, r.mv_fixture3_result].filter(Boolean);
    if (!results.length) return "-";
    return results.every(v => v === "Pass") ? "Pass" : "Fail";
  };
  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: "20px", color: "#000" }}>
      <PrintHeader type="monthly" />
      <h2 style={{ textAlign: "center", fontSize: "15px", fontWeight: "bold", margin: "10px 0" }}>Monthly Check Sheet</h2>
      <div style={{ fontSize: "12px", marginBottom: "10px" }}>
        <strong>조회 기간:</strong> {fromDate} ~ {toDate}&nbsp;&nbsp;&nbsp;<strong>출력일:</strong> {getTodayStr()}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th rowSpan={2} style={th}>Period</th>
            <th colSpan={4} style={th}>Safety Tester Dummy Load (GPT-9904)</th>
            <th colSpan={2} style={th}>Insulating Gloves</th>
            <th colSpan={2} style={th}>Machine Vision Test Tool</th>
            <th rowSpan={2} style={th}>Tester</th>
            <th rowSpan={2} style={th}>Approval<br />(Date/Time)</th>
          </tr>
          <tr>
            <th style={th}>Pass 측정값<br />(1507~1513Ω)</th>
            <th style={th}>결과</th>
            <th style={th}>Fail 측정값<br />(1487~1493Ω)</th>
            <th style={th}>결과</th>
            <th style={th}>Open Date</th>
            <th style={th}>Status</th>
            <th style={th}>Setting Fixture<br />(3대)</th>
            <th style={th}>Test Tray</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0
            ? <tr><td colSpan={11} style={{ ...tdc, color: "#666" }}>해당 기간에 기록이 없습니다.</td></tr>
            : data.map((r, i) => (
              <tr key={i}>
                <td style={tdc}>{String(r.period || "")}</td>
                <td style={tdc}>{r.load_pass_value != null ? String(r.load_pass_value) : "-"}</td>
                <td style={tdc}>{String(r.load_pass_result || "-")}</td>
                <td style={tdc}>{r.load_fail_value != null ? String(r.load_fail_value) : "-"}</td>
                <td style={tdc}>{String(r.load_fail_result || "-")}</td>
                <td style={tdc}>{r.gloves_open_date ? fmtDate(String(r.gloves_open_date)) : "-"}</td>
                <td style={tdc}>{String(r.gloves_result || "-")}</td>
                <td style={tdc}>{fixtureOverall(r)}</td>
                <td style={tdc}>{String(r.mv_tray_result || "-")}</td>
                <td style={tdc}>{String(r.inspector || "-")}</td>
                <td style={tdc}>{fmtApproval(r.created_at as string)}</td>
              </tr>
            ))
          }
        </tbody>
      </table>
      <PrintFooter extras={[
        "* Dummy Load Spec: Pass 시료 1510±3Ω, Fail 시료 1490±3Ω",
        "* Insulating Gloves: 개봉일로부터 6개월 이내 유효",
        "* Machine Vision Setting Fixture 점검 항목: ① Fixture 및 Cartridge 손상/유실, ② Guide line 및 Focus Threshold label 손상",
        "* Machine Vision Test Tray 점검 항목: ① Cartridge, Plunger, Tube 손상/유실, ② Foil 손상",
      ]} />
    </div>
  );
}

// ─── Bi-yearly ───────────────────────────────────────────────────────────────
function BiyearlyPrint({ data }: { data: Record<string, unknown>[] }) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", color: "#000" }}>
      {data.map((r, idx) => (
        <div key={idx} style={{ padding: "20px", pageBreakAfter: idx < data.length - 1 ? "always" : "avoid" }}>
          <PrintHeader type="biyearly" />
          <h2 style={{ textAlign: "center", fontSize: "15px", fontWeight: "bold", margin: "10px 0" }}>
            Bi-yearly Check Sheet (Table ESD 접지 상태 점검)
          </h2>
          <div style={{ fontSize: "12px", display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span><strong>Equipment &amp; Tool:</strong> DVM (멀티미터)&nbsp;&nbsp;<strong>Check Method:</strong> OK if GND Connected, NG if not connected GND</span>
            <span><strong>출력일:</strong> {getTodayStr()}</span>
          </div>
          <div style={{ fontSize: "12px", display: "flex", gap: "40px", marginBottom: "14px" }}>
            <span><strong>Period:</strong> {String(r.period || "")}</span>
            <span><strong>Inspector:</strong> {String(r.inspector || "-")}</span>
            <span><strong>Approval:</strong> {fmtApproval(r.created_at as string)}</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12px" }}>
            <thead>
              <tr>
                <th style={th}>점검 항목</th>
                <th style={th}>Spec</th>
                <th style={th}>작업대# / 어스링#</th>
                <th style={th}>측정값</th>
                <th style={th}>판정</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((n, i) => (
                <tr key={`s${n}`}>
                  {i === 0 && (
                    <td rowSpan={5} style={{ ...td, textAlign: "center", verticalAlign: "middle", fontWeight: "bold", writingMode: "vertical-rl" }}>
                      작업대 표면
                    </td>
                  )}
                  {i === 0 && (
                    <td rowSpan={5} style={{ ...tdc, verticalAlign: "middle", fontFamily: "monospace" }}>1Ω ~ 1GΩ</td>
                  )}
                  <td style={tdc}>{String(r[`surface_${n}_id`] || "-")}</td>
                  <td style={tdc}>{String(r[`surface_${n}_value`] || "-")}</td>
                  <td style={tdc}>{r[`surface_${n}_result`] === "Pass" ? "OK" : r[`surface_${n}_result`] === "Fail" ? "NG" : "-"}</td>
                </tr>
              ))}
              {[1, 2, 3, 4, 5].map((n, i) => (
                <tr key={`w${n}`}>
                  {i === 0 && (
                    <td rowSpan={5} style={{ ...td, textAlign: "center", verticalAlign: "middle", fontWeight: "bold", writingMode: "vertical-rl" }}>
                      손목띠(어스링)
                    </td>
                  )}
                  {i === 0 && (
                    <td rowSpan={5} style={{ ...tdc, verticalAlign: "middle", fontFamily: "monospace" }}>1MΩ ± 10%</td>
                  )}
                  <td style={tdc}>{String(r[`wrist_${n}_id`] || "-")}</td>
                  <td style={tdc}>{String(r[`wrist_${n}_value`] || "-")}</td>
                  <td style={tdc}>{r[`wrist_${n}_result`] === "Pass" ? "OK" : r[`wrist_${n}_result`] === "Fail" ? "NG" : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: "12px", marginBottom: "4px" }}>
            <strong>종합 판정:</strong>{" "}
            <span style={{
              display: "inline-block", padding: "2px 12px", fontWeight: "bold",
              backgroundColor: r.overall_result === "Pass" ? "#d4edda" : r.overall_result === "Fail" ? "#f8d7da" : "#f0f0f0",
            }}>
              {String(r.overall_result || "-")}
            </span>
            <span style={{ marginLeft: "40px" }}><strong>비고:</strong> {String(r.remarks || "-")}</span>
          </div>
          <PrintFooter extras={["* Static Dissipation (정전기 방전) 조건 - 작업 시 발생하는 정전기를 효율적으로 방전시키기 위한 점검"]} />
        </div>
      ))}
    </div>
  );
}

// ─── Daily Hygiene ────────────────────────────────────────────────────────────
const HYGIENE_COLS = [
  { key: "test_floor",    label: "바닥 청결" },
  { key: "test_bench",    label: "시험대 청결" },
  { key: "test_equip",    label: "계측기 정리정돈" },
  { key: "asm_floor",     label: "바닥 청결" },
  { key: "asm_parts",     label: "부품및시설 정리정돈" },
  { key: "asm_bench",     label: "작업대 청결" },
  { key: "wh_floor",      label: "바닥 청결" },
  { key: "wh_stacking",   label: "제품 적재" },
  { key: "wh_misc",       label: "기타 정리정돈" },
  { key: "ship_floor",    label: "바닥 청결" },
  { key: "ship_stacking", label: "제품 적재" },
  { key: "ship_misc",     label: "기타 정리정돈" },
];

const ZONE_HDR = "#2d6a9f";

function HygienePrint({ data, fromDate, toDate }: { data: Record<string, unknown>[]; fromDate: string; toDate: string }) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: "20px", color: "#000" }}>
      <PrintHeader type="daily-hygiene" />
      <h2 style={{ textAlign: "center", fontSize: "15px", fontWeight: "bold", margin: "10px 0" }}>
        위생관리 점검 기록 (Hygiene Management Inspection Log)
      </h2>
      <div style={{ fontSize: "12px", marginBottom: "10px" }}>
        <strong>조회 기간:</strong> {fromDate} ~ {toDate}&nbsp;&nbsp;&nbsp;<strong>출력일:</strong> {getTodayStr()}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5px" }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ ...th, verticalAlign: "middle" }}>Date</th>
            <th rowSpan={2} style={{ ...th, verticalAlign: "middle" }}>Inspector</th>
            {(["시험실", "작업실", "창고 원자재", "창고 완제품"] as const).map((z) => (
              <th key={z} colSpan={3} style={{ ...th, backgroundColor: ZONE_HDR, color: "#fff", fontSize: "10px" }}>{z}</th>
            ))}
            <th rowSpan={2} style={{ ...th, verticalAlign: "middle" }}>종합</th>
            <th rowSpan={2} style={{ ...th, verticalAlign: "middle", minWidth: 60 }}>비고</th>
            <th rowSpan={2} style={{ ...th, verticalAlign: "middle" }}>Approval<br />(Date/Time)</th>
          </tr>
          <tr>
            {HYGIENE_COLS.map((c) => (
              <th key={c.key} style={{ ...th, fontSize: "8.5px", whiteSpace: "nowrap" }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0
            ? <tr><td colSpan={17} style={{ ...tdc, color: "#666" }}>해당 기간에 기록이 없습니다.</td></tr>
            : data.map((r, i) => (
              <tr key={i}>
                <td style={tdc}>{fmtDate(String(r.inspection_date || ""))}</td>
                <td style={tdc}>{String(r.inspector || "-")}</td>
                {HYGIENE_COLS.map((c) => {
                  const val = String(r[c.key] || "-");
                  return (
                    <td key={c.key} style={{ ...tdc, color: val === "NG" ? "#b00" : val === "OK" ? "#060" : "#666", fontWeight: val !== "-" ? "bold" : "normal" }}>
                      {val}
                    </td>
                  );
                })}
                <td style={{ ...tdc, fontWeight: "bold", color: r.overall_result === "NG" ? "#b00" : r.overall_result === "OK" ? "#060" : "#666" }}>
                  {String(r.overall_result || "-")}
                </td>
                <td style={td}>{String(r.remarks || "")}</td>
                <td style={tdc}>{fmtApproval(r.created_at as string)}</td>
              </tr>
            ))
          }
        </tbody>
      </table>
      <PrintFooter extras={[
        "* 점검 구역: 시험실 / 작업실 / 창고 원자재 / 창고 완제품",
        "* OK: 기준 충족 / NG: 기준 미충족 — NG 발생 시 비고란에 조치 내용 기재 필수",
      ]} />
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [fromDate, setFromDate] = useState(getMonthStart());
  const [toDate, setToDate] = useState(getTodayStr());
  const [stats, setStats] = useState({ dailyPass: "-", monthlyPass: "-", biyearlyPass: "-" });
  const [printType, setPrintType] = useState<ReportType | null>(null);
  const [printData, setPrintData] = useState<Record<string, unknown>[] | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    async function loadStats() {
      const [{ data: dw }, { data: dh }, { data: m }, { data: b }] = await Promise.all([
        supabase.from("daily_worker_inspections").select("esd_result, wrist_result")
          .gte("inspection_date", fromDate).lte("inspection_date", toDate),
        supabase.from("daily_hipot_inspections").select("overall_result")
          .gte("inspection_date", fromDate).lte("inspection_date", toDate),
        supabase.from("monthly_inspections").select("overall_result")
          .gte("period", fromDate.slice(0, 7)).lte("period", toDate.slice(0, 7)),
        supabase.from("biyearly_inspections").select("overall_result"),
      ]);
      const allDaily = [...(dw || []), ...(dh || [])];
      const allDailyPass = [
        ...(dw || []).filter(r => r.esd_result === "Pass" && r.wrist_result === "Pass"),
        ...(dh || []).filter(r => r.overall_result === "Pass"),
      ];
      setStats({
        dailyPass: allDaily.length ? `${Math.round((allDailyPass.length / allDaily.length) * 100)}%` : "-",
        monthlyPass: m?.length ? `${Math.round(((m.filter(r => r.overall_result === "Pass").length) / m.length) * 100)}%` : "-",
        biyearlyPass: b?.length ? `${Math.round(((b.filter(r => r.overall_result === "Pass").length) / b.length) * 100)}%` : "-",
      });
    }
    loadStats();
  }, [fromDate, toDate]);

  async function handlePrint(type: ReportType) {
    setLoadingReport(true);
    setPrintType(type);
    let data: Record<string, unknown>[] = [];
    if (type === "daily-worker") {
      const { data: d } = await supabase.from("daily_worker_inspections").select("*")
        .gte("inspection_date", fromDate).lte("inspection_date", toDate)
        .order("inspection_date").order("worker_name");
      data = d || [];
    } else if (type === "daily-hipot") {
      const { data: d } = await supabase.from("daily_hipot_inspections").select("*")
        .gte("inspection_date", fromDate).lte("inspection_date", toDate).order("inspection_date");
      data = d || [];
    } else if (type === "monthly") {
      const { data: d } = await supabase.from("monthly_inspections").select("*")
        .gte("period", fromDate.slice(0, 7)).lte("period", toDate.slice(0, 7)).order("period");
      data = d || [];
    } else if (type === "biyearly") {
      const { data: d } = await supabase.from("biyearly_inspections").select("*").order("period");
      data = d || [];
    } else {
      const { data: d } = await supabase.from("hygiene_inspections").select("*")
        .gte("inspection_date", fromDate).lte("inspection_date", toDate).order("inspection_date");
      data = d || [];
    }
    setPrintData(data);
    setLoadingReport(false);
    setTimeout(() => window.print(), 150);
  }

  const reportTypes = [
    { key: "daily-worker" as ReportType, icon: "fas fa-user-check", color: "bg-blue-100 text-blue-600", title: "Daily Check Sheet (작업자 점검)", desc: "제전화 / 어스링 / Driver Torque" },
    { key: "daily-hipot" as ReportType, icon: "fas fa-bolt", color: "bg-amber-100 text-amber-600", title: "Daily Check Sheet (Safety Tester)", desc: "Dummy Hi-pot Test" },
    { key: "monthly" as ReportType, icon: "fas fa-calendar-alt", color: "bg-purple-100 text-purple-600", title: "Monthly Check Sheet", desc: "Dummy Load / Gloves / Vision Tool" },
    { key: "biyearly" as ReportType, icon: "fas fa-table", color: "bg-green-100 text-green-600", title: "Bi-yearly Check Sheet", desc: "Table ESD 접지 상태" },
    { key: "daily-hygiene" as ReportType, icon: "fas fa-broom", color: "bg-blue-100 text-blue-600", title: "Daily Check Sheet (위생관리 점검)", desc: "QP602-2 · 4구역 12항목" },
  ];

  return (
    <>
      {/* 화면 전용 */}
      <div className="animate-fadeIn no-print">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">보고서</h1>
          <p className="text-gray-500 text-sm mt-1">점검 현황 통계 및 QMS 양식 출력</p>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Daily 점검 Pass율", value: stats.dailyPass, color: "text-indigo-600" },
            { label: "Monthly 점검 Pass율", value: stats.monthlyPass, color: "text-green-600" },
            { label: "Bi-yearly 점검 Pass율", value: stats.biyearlyPass, color: "text-amber-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="text-sm text-gray-500 mb-1">{s.label}</div>
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-4">
            <i className="fas fa-file-pdf text-red-500 mr-2" />QMS 양식 출력 (DHR용)
          </h3>
          <div className="flex items-end gap-4 mb-6 flex-wrap">
            <div>
              <label className="text-xs text-gray-500 block mb-1">시작일</label>
              <input type="date" className="input-base" style={{ width: 150 }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">종료일</label>
              <input type="date" className="input-base" style={{ width: 150 }} value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <p className="text-xs text-gray-400 self-end pb-2">* Bi-yearly는 날짜 범위 무관 — 전체 기간 출력</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {reportTypes.map((r) => (
              <button key={r.key} onClick={() => handlePrint(r.key)} disabled={loadingReport}
                className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-left disabled:opacity-50">
                <div className={`w-11 h-11 ${r.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <i className={r.icon} />
                </div>
                <div>
                  <div className="font-medium text-gray-900 text-sm">{r.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{r.desc}</div>
                </div>
                {loadingReport
                  ? <i className="fas fa-spinner fa-spin text-gray-400 ml-auto" />
                  : <i className="fas fa-print text-gray-400 ml-auto" />}
              </button>
            ))}
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
            <i className="fas fa-info-circle mr-1" />
            버튼 클릭 시 데이터를 불러와 자동으로 인쇄 창이 열립니다. 용지: 가로(Landscape), 여백: 최소 설정 권장.
          </div>
        </div>
      </div>

      {/* 인쇄 전용 */}
      <div className="print-only">
        {printData && printType === "daily-worker" && <DailyWorkerPrint data={printData} fromDate={fromDate} toDate={toDate} />}
        {printData && printType === "daily-hipot" && <DailyHipotPrint data={printData} fromDate={fromDate} toDate={toDate} />}
        {printData && printType === "monthly" && <MonthlyPrint data={printData} fromDate={fromDate} toDate={toDate} />}
        {printData && printType === "biyearly" && <BiyearlyPrint data={printData} />}
        {printData && printType === "daily-hygiene" && <HygienePrint data={printData} fromDate={fromDate} toDate={toDate} />}
      </div>
    </>
  );
}
