"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PassFail, OkNg, MonthlyInspection } from "@/lib/types";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5 ${className}`}>
      {children}
    </div>
  );
}

function CheckBtn({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  const isOk = label === "OK" || label === "Pass";
  const base = "px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border-2 cursor-pointer";
  const style = isOk
    ? selected ? `${base} bg-green-600 text-white border-green-600` : `${base} bg-green-50 text-green-700 border-green-500 hover:bg-green-600 hover:text-white`
    : selected ? `${base} bg-red-600 text-white border-red-600` : `${base} bg-red-50 text-red-700 border-red-500 hover:bg-red-600 hover:text-white`;
  return <button className={style} onClick={onClick}>{label}</button>;
}

function AutoJudge({ result }: { result: PassFail | null | "pending" }) {
  if (!result || result === "pending") return <div className="px-3 py-1.5 text-sm font-bold rounded-lg bg-gray-100 text-gray-400 text-center">입력 대기</div>;
  return <div className={`px-3 py-1.5 text-sm font-bold rounded-lg text-center ${result === "Pass" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{result}</div>;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function MonthlyPage() {
  const [period, setPeriod] = useState(getCurrentMonth());
  const [inspector, setInspector] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [videoLinks, setVideoLinks] = useState<Record<string, string>>({});

  // Dummy Load
  const [loadPassValue, setLoadPassValue] = useState("");
  const [loadFailValue, setLoadFailValue] = useState("");
  const [loadPassResult, setLoadPassResult] = useState<PassFail | null>(null);
  const [loadFailResult, setLoadFailResult] = useState<PassFail | null>(null);

  // Gloves
  const [glovesOpenDate, setGlovesOpenDate] = useState("");
  const [glovesExpiry, setGlovesExpiry] = useState("");
  const [glovesResult, setGlovesResult] = useState<PassFail | null>(null);

  // MV Fixture (3대)
  const [mvFixtures, setMvFixtures] = useState([
    { serial: "", check1: null as OkNg | null, check2: null as OkNg | null, result: null as PassFail | null },
    { serial: "", check1: null as OkNg | null, check2: null as OkNg | null, result: null as PassFail | null },
    { serial: "", check1: null as OkNg | null, check2: null as OkNg | null, result: null as PassFail | null },
  ]);
  const [mvFixtureRemarks, setMvFixtureRemarks] = useState("");

  // MV Tray
  const [mvTraySerial, setMvTraySerial] = useState("");
  const [mvTrayCheck1, setMvTrayCheck1] = useState<OkNg | null>(null);
  const [mvTrayCheck2, setMvTrayCheck2] = useState<OkNg | null>(null);
  const [mvTrayResult, setMvTrayResult] = useState<PassFail | null>(null);
  const [mvTrayRemarks, setMvTrayRemarks] = useState("");

  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [existing, setExisting] = useState(false);

  useEffect(() => {
    // 비디오 링크 로드
    supabase.from("video_configs").select("*").then(({ data }) => {
      const m: Record<string, string> = {};
      (data || []).forEach((v) => { m[v.key] = v.url; });
      setVideoLinks(m);
    });
    // 로그인 작업자 이름 로드
    const wid = localStorage.getItem("pm_selected_worker_id");
    if (wid) {
      supabase.from("workers").select("name").eq("id", wid).maybeSingle()
        .then(({ data }) => { if (data?.name) setWorkerName(data.name); });
    }
  }, []);

  useEffect(() => {
    supabase.from("monthly_inspections").select("*").eq("period", period).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExisting(true);
          const d = data as MonthlyInspection;
          setInspector(d.inspector || "");
          setLoadPassValue(String(d.load_pass_value || ""));
          setLoadFailValue(String(d.load_fail_value || ""));
          setLoadPassResult(d.load_pass_result);
          setLoadFailResult(d.load_fail_result);
          setGlovesOpenDate(d.gloves_open_date || "");
          setGlovesExpiry(d.gloves_expiry || "");
          setGlovesResult(d.gloves_result);
          setMvFixtures([
            { serial: d.mv_fixture1_serial || "", check1: d.mv_fixture1_check1, check2: d.mv_fixture1_check2, result: d.mv_fixture1_result },
            { serial: d.mv_fixture2_serial || "", check1: d.mv_fixture2_check1, check2: d.mv_fixture2_check2, result: d.mv_fixture2_result },
            { serial: d.mv_fixture3_serial || "", check1: d.mv_fixture3_check1, check2: d.mv_fixture3_check2, result: d.mv_fixture3_result },
          ]);
          setMvFixtureRemarks(d.mv_fixture_remarks || "");
          setMvTraySerial(d.mv_tray_serial || "");
          setMvTrayCheck1(d.mv_tray_check1);
          setMvTrayCheck2(d.mv_tray_check2);
          setMvTrayResult(d.mv_tray_result);
          setMvTrayRemarks(d.mv_tray_remarks || "");
          setRemarks(d.remarks || "");
        } else {
          setExisting(false);
          // 신규 입력 시 현재 작업자로 inspector 초기화
          setInspector(workerName);
          // 입력 필드 초기화
          setLoadPassValue(""); setLoadFailValue("");
          setLoadPassResult(null); setLoadFailResult(null);
          setGlovesOpenDate(""); setGlovesExpiry(""); setGlovesResult(null);
          setMvFixtures([
            { serial: "", check1: null, check2: null, result: null },
            { serial: "", check1: null, check2: null, result: null },
            { serial: "", check1: null, check2: null, result: null },
          ]);
          setMvFixtureRemarks(""); setMvTraySerial("");
          setMvTrayCheck1(null); setMvTrayCheck2(null);
          setMvTrayResult(null); setMvTrayRemarks(""); setRemarks("");
        }
      });
  }, [period, workerName]);

  // Gloves 만료일 자동 계산
  useEffect(() => {
    if (!glovesOpenDate) { setGlovesExpiry(""); setGlovesResult(null); return; }
    const open = new Date(glovesOpenDate);
    const exp = new Date(open);
    exp.setMonth(exp.getMonth() + 6);
    const expStr = exp.toISOString().slice(0, 10);
    setGlovesExpiry(expStr);
    setGlovesResult(new Date() <= exp ? "Pass" : "Fail");
  }, [glovesOpenDate]);

  // Load 자동 판정
  useEffect(() => {
    const v = parseFloat(loadPassValue);
    if (isNaN(v)) { setLoadPassResult(null); return; }
    setLoadPassResult(v >= 1507 && v <= 1513 ? "Pass" : "Fail");
  }, [loadPassValue]);

  useEffect(() => {
    const v = parseFloat(loadFailValue);
    if (isNaN(v)) { setLoadFailResult(null); return; }
    setLoadFailResult(v >= 1487 && v <= 1493 ? "Pass" : "Fail");
  }, [loadFailValue]);

  // MV Fixture 자동 판정
  function updateFixture(idx: number, field: "serial" | "check1" | "check2", value: string) {
    setMvFixtures((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      const f = next[idx];
      const result = f.check1 === "OK" && f.check2 === "OK" ? "Pass"
        : f.check1 === "NG" || f.check2 === "NG" ? "Fail" : null;
      next[idx] = { ...f, result };
      return next;
    });
  }

  // MV Tray 자동 판정
  useEffect(() => {
    if (mvTrayCheck1 && mvTrayCheck2) {
      setMvTrayResult(mvTrayCheck1 === "OK" && mvTrayCheck2 === "OK" ? "Pass" : "Fail");
    }
  }, [mvTrayCheck1, mvTrayCheck2]);

  const overallResult: PassFail | null = (() => {
    const results = [loadPassResult, loadFailResult, glovesResult,
      ...mvFixtures.map((f) => f.result), mvTrayResult].filter(Boolean);
    if (results.length === 0) return null;
    return results.every((r) => r === "Pass") ? "Pass" : "Fail";
  })();

  async function handleSubmit() {
    setSaving(true);
    const { error } = await supabase.from("monthly_inspections").upsert({
      period, inspector: inspector || null,
      load_pass_value: parseFloat(loadPassValue) || null,
      load_pass_result: loadPassResult,
      load_fail_value: parseFloat(loadFailValue) || null,
      load_fail_result: loadFailResult,
      gloves_open_date: glovesOpenDate || null,
      gloves_expiry: glovesExpiry || null,
      gloves_result: glovesResult,
      mv_fixture1_serial: mvFixtures[0].serial || null, mv_fixture1_check1: mvFixtures[0].check1, mv_fixture1_check2: mvFixtures[0].check2, mv_fixture1_result: mvFixtures[0].result,
      mv_fixture2_serial: mvFixtures[1].serial || null, mv_fixture2_check1: mvFixtures[1].check1, mv_fixture2_check2: mvFixtures[1].check2, mv_fixture2_result: mvFixtures[1].result,
      mv_fixture3_serial: mvFixtures[2].serial || null, mv_fixture3_check1: mvFixtures[2].check1, mv_fixture3_check2: mvFixtures[2].check2, mv_fixture3_result: mvFixtures[2].result,
      mv_fixture_remarks: mvFixtureRemarks || null,
      mv_tray_serial: mvTraySerial || null, mv_tray_check1: mvTrayCheck1, mv_tray_check2: mvTrayCheck2,
      mv_tray_result: mvTrayResult, mv_tray_remarks: mvTrayRemarks || null,
      overall_result: overallResult, remarks: remarks || null,
    }, { onConflict: "period" });
    setSaving(false);
    if (error) setMsg({ type: "err", text: "저장 실패: " + error.message });
    else { setExisting(true); setMsg({ type: "ok", text: "저장 완료!" }); }
  }

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Monthly PM Inspection</h1>
        <p className="text-gray-500 text-sm mt-1">매월 수행하는 장비 및 안전용품 점검</p>
      </div>

      <Card>
        {/* 헤더 */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div>
            <label className="text-xs text-gray-500 block mb-1">점검 연월</label>
            <input type="month" className="input-base" style={{ width: 160 }} value={period}
              onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">검사자</label>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-medium text-indigo-800" style={{ width: 160, minHeight: 38 }}>
              <i className="fas fa-user text-indigo-400 text-xs" />
              {inspector || <span className="text-gray-400 text-xs">작업자 미선택</span>}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {existing && period === getCurrentMonth() && (
              <span className="bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-green-200">
                <i className="fas fa-check-circle mr-1" />이번 달 완료 · {inspector || "-"}
              </span>
            )}
            {existing && period !== getCurrentMonth() && (
              <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                <i className="fas fa-edit mr-1" />기존 데이터 수정 모드
              </span>
            )}
          </div>
        </div>

        {/* 1. Dummy Load Test */}
        <InspectionItem num={1} title="Safety Tester Dummy Load Test" badge="GPT-9904" color="purple" videoUrl={videoLinks.load}>
          <div className="text-sm text-gray-600 mb-4">DMM으로 더미로드 저항값 측정</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 rounded-xl">
              <div className="text-sm font-medium text-green-800 mb-1">Pass 시료 측정</div>
              <div className="text-xs text-green-600 mb-3">Spec: 1510 ± 3Ω (1507~1513Ω)</div>
              <div className="flex items-center gap-3">
                <input type="number" className="input-base" style={{ width: 120 }} placeholder="측정값" step="0.1"
                  value={loadPassValue} onChange={(e) => setLoadPassValue(e.target.value)} />
                <span className="text-sm text-gray-500">Ω</span>
                <AutoJudge result={loadPassResult} />
              </div>
            </div>
            <div className="p-4 bg-red-50 rounded-xl">
              <div className="text-sm font-medium text-red-800 mb-1">Fail 시료 측정</div>
              <div className="text-xs text-red-600 mb-3">Spec: 1490 ± 3Ω (1487~1493Ω)</div>
              <div className="flex items-center gap-3">
                <input type="number" className="input-base" style={{ width: 120 }} placeholder="측정값" step="0.1"
                  value={loadFailValue} onChange={(e) => setLoadFailValue(e.target.value)} />
                <span className="text-sm text-gray-500">Ω</span>
                <AutoJudge result={loadFailResult} />
              </div>
            </div>
          </div>
        </InspectionItem>

        {/* 2. Insulating Gloves */}
        <InspectionItem num={2} title="Insulating Gloves (절연장갑)" color="purple" videoUrl={videoLinks.gloves}>
          <div className="text-sm text-gray-600 mb-4">유효기간 확인 (개봉일로부터 6개월 이내)</div>
          <div className="grid grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-xs text-gray-500 block mb-1">개봉일</label>
              <input type="date" className="input-base" value={glovesOpenDate}
                onChange={(e) => setGlovesOpenDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">만료 예정일</label>
              <input type="text" className="input-base bg-gray-50" readOnly placeholder="자동 계산"
                value={glovesExpiry} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">상태</label>
              <AutoJudge result={glovesResult} />
            </div>
          </div>
        </InspectionItem>

        {/* 3. MV Setting Fixture */}
        <InspectionItem num={3} title="Machine Vision Setting Fixture" badge="3대" color="purple" videoUrl={videoLinks.mvFixture}>
          <div className="text-sm text-gray-600 mb-3">외관 점검 - 손상 및 유실 여부 확인</div>
          <div className="mb-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
            ① Fixture 및 Cartridge 손상 및 유실 없을 것 &nbsp;|&nbsp; ② Guide line 및 Focus Threshold label 손상 없을 것
          </div>
          <div className="grid grid-cols-3 gap-4">
            {mvFixtures.map((f, i) => (
              <div key={i} className="p-4 bg-gray-50 rounded-xl border-2 border-transparent" style={{ borderColor: f.result === "Pass" ? "#86efac" : f.result === "Fail" ? "#fca5a5" : "transparent" }}>
                <div className="text-center font-bold text-purple-600 mb-3">#{i + 1}</div>
                <div className="mb-2">
                  <label className="text-xs text-gray-500 block mb-1">관리 번호</label>
                  <input className="input-base text-sm" placeholder="관리번호" value={f.serial}
                    onChange={(e) => updateFixture(i, "serial", e.target.value)} />
                </div>
                <div className="space-y-2">
                  {[1, 2].map((n) => {
                    const ck = `check${n}` as "check1" | "check2";
                    return (
                      <div key={n} className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">항목 {n === 1 ? "①" : "②"}</span>
                        <div className="flex gap-1">
                          <CheckBtn label="OK" selected={f[ck] === "OK"} onClick={() => updateFixture(i, ck, "OK")} />
                          <CheckBtn label="NG" selected={f[ck] === "NG"} onClick={() => updateFixture(i, ck, "NG")} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {f.result && (
                  <div className={`mt-3 text-center text-xs font-bold py-1 rounded ${f.result === "Pass" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {f.result}
                  </div>
                )}
              </div>
            ))}
          </div>
          <input className="input-base mt-3" placeholder="이상 발견 시 내용 기재..."
            value={mvFixtureRemarks} onChange={(e) => setMvFixtureRemarks(e.target.value)} />
        </InspectionItem>

        {/* 4. MV Test Tray */}
        <InspectionItem num={4} title="Machine Vision Test Tray" color="purple" videoUrl={videoLinks.mvTray}>
          <div className="text-sm text-gray-600 mb-3">외관 점검 - 손상 및 유실 여부 확인</div>
          <div className="mb-3">
            <label className="text-xs text-gray-500 block mb-1">관리 번호</label>
            <input className="input-base" style={{ width: 200 }} placeholder="관리 번호 입력"
              value={mvTraySerial} onChange={(e) => setMvTraySerial(e.target.value)} />
          </div>
          <div className="space-y-2 p-4 bg-gray-50 rounded-xl">
            {[
              { label: "1. Cartridge, Plunger, Tube 손상 및 유실 없을 것", state: mvTrayCheck1, setter: setMvTrayCheck1 },
              { label: "2. Foil 찍힘, 찢어짐 등 손상 없을 것", state: mvTrayCheck2, setter: setMvTrayCheck2 },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-gray-700 flex-1 mr-4">{item.label}</span>
                <div className="flex gap-2">
                  <CheckBtn label="OK" selected={item.state === "OK"} onClick={() => item.setter("OK")} />
                  <CheckBtn label="NG" selected={item.state === "NG"} onClick={() => item.setter("NG")} />
                </div>
              </div>
            ))}
          </div>
          {mvTrayResult && (
            <div className={`mt-2 text-center text-sm font-bold py-1.5 rounded-lg ${mvTrayResult === "Pass" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              판정: {mvTrayResult}
            </div>
          )}
          <input className="input-base mt-3" placeholder="이상 발견 시 내용 기재..."
            value={mvTrayRemarks} onChange={(e) => setMvTrayRemarks(e.target.value)} />
        </InspectionItem>

        {/* 비고 & 제출 */}
        <div className="mt-6 pt-5 border-t">
          <div className="flex items-end gap-4">
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
                {saving ? "저장 중..." : <><i className="fas fa-check mr-2" />Monthly 점검 완료</>}
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function InspectionItem({ num, title, badge, color = "purple", videoUrl, children }: {
  num: number; title: string; badge?: string; color?: string; videoUrl?: string; children: React.ReactNode;
}) {
  const colors: Record<string, string> = { purple: "bg-purple-100 text-purple-600", blue: "bg-blue-100 text-blue-600" };
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 mb-4 hover:border-purple-200 transition-colors">
      <div className="flex items-center gap-3 mb-4">
        <span className={`w-6 h-6 ${colors[color]} rounded-full flex items-center justify-center text-[10px] font-bold`}>{num}</span>
        <h4 className="font-bold text-gray-900">{title}</h4>
        {badge && <span className="bg-purple-50 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full">{badge}</span>}
        {videoUrl && (
          <a href={videoUrl} target="_blank" rel="noreferrer"
            className="w-7 h-7 bg-red-500 rounded-lg flex items-center justify-center hover:bg-red-600 transition-colors ml-1">
            <i className="fas fa-play text-white text-[9px]" />
          </a>
        )}
      </div>
      <div className="ml-9">{children}</div>
    </div>
  );
}
