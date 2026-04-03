"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Worker } from "@/lib/types";

export default function SettingsPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [newName, setNewName] = useState("");
  const [newEmpId, setNewEmpId] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmpId, setEditEmpId] = useState("");

  const [videoLinks, setVideoLinks] = useState<Record<string, string>>({
    esd: "", wrist: "", torque: "", hipot: "", load: "", gloves: "", mvFixture: "", mvTray: "",
  });
  const [videoSaving, setVideoSaving] = useState(false);
  const [videoMsg, setVideoMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function loadAll() {
    const [{ data: ws }, { data: vids }] = await Promise.all([
      supabase.from("workers").select("*").eq("is_active", true).order("name"),
      supabase.from("video_configs").select("*"),
    ]);
    setWorkers(ws || []);
    const m: Record<string, string> = {};
    (vids || []).forEach((v) => { m[v.key] = v.url || ""; });
    setVideoLinks((prev) => ({ ...prev, ...m }));
  }

  useEffect(() => { loadAll(); }, []);

  async function addWorker() {
    if (!newName.trim()) return;
    setSaving(true);
    await supabase.from("workers").insert({ name: newName.trim(), emp_id: newEmpId.trim() || null });
    setNewName(""); setNewEmpId("");
    await loadAll();
    setSaving(false);
  }

  async function deleteWorker(id: string) {
    if (!confirm("이 작업자를 비활성화하시겠습니까?")) return;
    await supabase.from("workers").update({ is_active: false }).eq("id", id);
    await loadAll();
  }

  function openEdit(w: Worker) {
    setEditId(w.id); setEditName(w.name); setEditEmpId(w.emp_id || "");
  }

  async function saveEdit() {
    if (!editId || !editName.trim()) return;
    await supabase.from("workers").update({ name: editName.trim(), emp_id: editEmpId.trim() || null }).eq("id", editId);
    setEditId(null);
    await loadAll();
  }

  async function saveVideoLinks() {
    setVideoSaving(true);
    const upserts = Object.entries(videoLinks).map(([key, url]) => ({ key, url, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from("video_configs").upsert(upserts, { onConflict: "key" });
    setVideoSaving(false);
    setVideoMsg(error ? { type: "err", text: "저장 실패" } : { type: "ok", text: "영상 링크 저장 완료!" });
    setTimeout(() => setVideoMsg(null), 3000);
  }

  const videoFields = [
    { section: "Daily 점검", items: [
      { key: "esd", label: "제전화 (ESD Shoes)" },
      { key: "wrist", label: "어스링 (Wrist Strap)" },
      { key: "torque", label: "전동드라이버 Torque" },
      { key: "hipot", label: "Hi-pot Test" },
    ]},
    { section: "Monthly 점검", items: [
      { key: "load", label: "Dummy Load Test" },
      { key: "gloves", label: "Insulating Gloves" },
      { key: "mvFixture", label: "M/V Setting Fixture" },
      { key: "mvTray", label: "M/V Test Tray" },
    ]},
  ];

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="text-gray-500 text-sm mt-1">시스템 설정 및 작업자 관리</p>
      </div>

      {/* 작업자 관리 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5">
        <h3 className="font-bold text-gray-900 mb-4">
          <i className="fas fa-users text-indigo-500 mr-2" />작업자 관리
        </h3>

        <table className="w-full mb-5">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">이름</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">사번</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">관리</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <tr key={w.id} className="border-b hover:bg-gray-50">
                {editId === w.id ? (
                  <>
                    <td className="py-2 px-4">
                      <input className="input-base" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </td>
                    <td className="py-2 px-4">
                      <input className="input-base" value={editEmpId} onChange={(e) => setEditEmpId(e.target.value)} />
                    </td>
                    <td className="py-2 px-4 text-center">
                      <div className="flex gap-2 justify-center">
                        <button onClick={saveEdit} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700">저장</button>
                        <button onClick={() => setEditId(null)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-200">취소</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-3 px-4 font-medium text-gray-900">{w.name}</td>
                    <td className="py-3 px-4 text-gray-500">{w.emp_id || "-"}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex gap-2 justify-center">
                        <button onClick={() => openEdit(w)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-200">
                          <i className="fas fa-edit mr-1" />수정
                        </button>
                        <button onClick={() => deleteWorker(w.id)} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100">
                          <i className="fas fa-trash mr-1" />삭제
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-700 mb-3 text-sm">작업자 추가</h4>
          <div className="flex gap-3">
            <input className="input-base" style={{ width: 200 }} placeholder="이름"
              value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input className="input-base" style={{ width: 150 }} placeholder="사번"
              value={newEmpId} onChange={(e) => setNewEmpId(e.target.value)} />
            <button onClick={addWorker} disabled={saving || !newName.trim()}
              className="px-5 py-2 rounded-xl font-semibold text-white text-sm disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              <i className="fas fa-plus mr-1" />추가
            </button>
          </div>
        </div>
      </div>

      {/* Deep How 영상 링크 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-gray-900 mb-4">
          <i className="fas fa-video text-red-500 mr-2" />Deep How 영상 링크 설정
        </h3>

        {videoFields.map((section) => (
          <div key={section.section} className="mb-6">
            <h4 className="font-medium text-gray-700 mb-3 text-sm border-b pb-2">{section.section}</h4>
            <div className="space-y-3">
              {section.items.map((item) => (
                <div key={item.key} className="flex items-center gap-4">
                  <label className="w-48 text-sm text-gray-600 flex-shrink-0">{item.label}</label>
                  <input className="input-base flex-1" placeholder="Deep How 딥링크 URL"
                    value={videoLinks[item.key] || ""}
                    onChange={(e) => setVideoLinks((prev) => ({ ...prev, [item.key]: e.target.value }))} />
                  {videoLinks[item.key] && (
                    <a href={videoLinks[item.key]} target="_blank" rel="noreferrer"
                      className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center hover:bg-red-600 flex-shrink-0">
                      <i className="fas fa-play text-white text-xs" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {videoMsg && (
          <p className={`text-sm mb-3 ${videoMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>{videoMsg.text}</p>
        )}
        <button onClick={saveVideoLinks} disabled={videoSaving}
          className="px-6 py-2.5 rounded-xl font-semibold text-white text-sm disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
          {videoSaving ? "저장 중..." : <><i className="fas fa-save mr-2" />저장</>}
        </button>
      </div>
    </div>
  );
}
