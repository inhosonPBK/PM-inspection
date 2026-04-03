"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  {
    group: "점검 기록",
    items: [
      { href: "/daily", label: "Daily 점검", icon: "fas fa-calendar-day", badge: "D", badgeColor: "bg-blue-500" },
      { href: "/monthly", label: "Monthly 점검", icon: "fas fa-calendar-alt", badge: "M", badgeColor: "bg-purple-500" },
      { href: "/biyearly", label: "Bi-yearly 점검", icon: "fas fa-calendar", badge: "B", badgeColor: "bg-amber-500" },
    ],
  },
  {
    group: "조회",
    items: [
      { href: "/history", label: "점검 이력", icon: "fas fa-history" },
      { href: "/trend", label: "트렌드 분석", icon: "fas fa-chart-line" },
      { href: "/reports", label: "보고서", icon: "fas fa-chart-bar" },
    ],
  },
  {
    group: "관리",
    items: [
      { href: "/settings", label: "설정", icon: "fas fa-cog" },
    ],
  },
];

interface DailyStatus {
  name: string;
  done: boolean;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [today, setToday] = useState("");
  const [dailyStatus, setDailyStatus] = useState<DailyStatus[]>([]);

  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;
    setToday(`${y}년 ${m}월 ${d}일`);

    async function loadStatus() {
      const { data: workers } = await supabase
        .from("workers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      const { data: done } = await supabase
        .from("daily_worker_inspections")
        .select("worker_id")
        .eq("inspection_date", todayStr);

      const doneIds = new Set((done || []).map((r) => r.worker_id));
      setDailyStatus(
        (workers || []).map((w) => ({ name: w.name, done: doneIds.has(w.id) }))
      );
    }
    loadStatus();
  }, []);

  return (
    <aside className="sidebar-scroll fixed left-0 top-0 w-[260px] min-h-screen overflow-y-auto z-50"
      style={{ background: "linear-gradient(180deg, #1a1f36 0%, #0d1025 100%)" }}>
      {/* Logo */}
      <div className="px-6 py-5 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            <i className="fas fa-clipboard-check text-white text-sm" />
          </div>
          <div>
            <div className="text-white font-bold text-sm">PBK</div>
            <div className="text-gray-500 text-xs">PM Inspection</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      {NAV_ITEMS.map((group) => (
        <div key={group.group}>
          <div className="text-gray-600 text-[10px] uppercase tracking-wider px-6 mb-1 mt-4">
            {group.group}
          </div>
          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 text-sm transition-all rounded-lg ${
                  active
                    ? "bg-amber-500 text-white font-medium"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <i className={`${item.icon} w-4 text-center`} />
                <span className="flex-1">{item.label}</span>
                {"badge" in item && item.badge && (
                  <span className={`${active ? "bg-white/30" : ("badgeColor" in item ? item.badgeColor : "")} text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}

      {/* Today status */}
      <div className="px-4 mt-6">
        <div className="bg-gray-800/50 rounded-xl p-4">
          <div className="text-gray-500 text-xs mb-2">오늘 Daily 점검</div>
          <div className="space-y-1">
            {dailyStatus.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <i className={`fas ${s.done ? "fa-check-circle text-green-400" : "fa-circle text-gray-600"} text-[10px]`} />
                <span className={s.done ? "text-green-400" : "text-gray-500"}>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 mt-3 pb-8">
        <div className="bg-gray-800/50 rounded-xl p-3">
          <div className="text-gray-500 text-[10px]">현재 일자</div>
          <div className="text-white text-xs font-medium mt-0.5">{today}</div>
        </div>
      </div>
    </aside>
  );
}
