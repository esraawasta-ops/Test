"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom" },
];

export default function DashboardFilters({ hostels }: { hostels: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const period = searchParams.get("period") || "month";
  const hostel = searchParams.get("hostel") || "all";
  const [from, setFrom] = useState(searchParams.get("from") || "");
  const [to, setTo] = useState(searchParams.get("to") || "");

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={hostel}
        onChange={(e) => setParam("hostel", e.target.value)}
        className="rounded-lg border border-slate-300 bg-white py-1.5 pl-2 pr-7 text-xs font-medium text-slate-700 focus:border-slate-500 focus:outline-none"
      >
        <option value="all">All Hostels</option>
        {hostels.map((h) => (
          <option key={h.id} value={h.id}>{h.name}</option>
        ))}
      </select>

      <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setParam("period", p.key)}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${period === p.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {period === "custom" && (
        <div className="flex items-center gap-1.5">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs" />
          <span className="text-xs text-slate-400">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs" />
          <button
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("period", "custom");
              if (from) params.set("from", from);
              if (to) params.set("to", to);
              router.push(`${pathname}?${params.toString()}`);
            }}
            className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
