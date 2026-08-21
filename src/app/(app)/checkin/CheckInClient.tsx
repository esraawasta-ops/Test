"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { checkInContract } from "@/actions/contracts";
import { fmtMoney, fmtDate, roomLabel } from "@/lib/utils";
import { Card, Button, Input, EmptyState } from "@/components/ui";

type Contract = {
  id: string;
  tenantId: string;
  roomId: string;
  rentAmount: number;
  startDate: string | Date;
  tenant: { fullName: string };
  room: { name: string; unit: { name: string } };
  hostel: { name: string };
};

export default function CheckInClient({ contracts }: { contracts: Contract[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const checkIn = (id: string) => {
    setError("");
    startTransition(async () => {
      try {
        await checkInContract(id, date);
      } catch (e: any) {
        setError(e?.message || "Something went wrong.");
      }
    });
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">Check-in</h1>
        <p className="text-sm text-slate-500">Contracts awaiting move-in</p>
      </div>
      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-slate-600">Check-in date</label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-48" />
      </div>
      <Card className="overflow-hidden">
        {contracts.length === 0 ? (
          <EmptyState title="Nobody is waiting to check in" detail="New contracts show up here until they're checked in." />
        ) : (
          <div>
            <div className="hidden border-b border-slate-100 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[1.3fr_1.3fr_0.9fr_0.8fr_auto]">
              <span>Tenant</span><span>Hostel / Room</span><span>Contract Start</span><span>Rent</span><span></span>
            </div>
            <ul className="divide-y divide-slate-100">
              {contracts.map((c) => (
                <li key={c.id} className="flex flex-col gap-1 px-4 py-3 hover:bg-slate-50 sm:grid sm:grid-cols-[1.3fr_1.3fr_0.9fr_0.8fr_auto] sm:items-center sm:gap-0">
                  <Link href={`/tenants/${c.tenantId}`} className="text-sm font-medium text-slate-900 hover:underline">{c.tenant.fullName}</Link>
                  <p className="text-sm text-slate-500">{c.hostel.name} · <Link href={`/rooms/${c.roomId}`} className="hover:underline">{roomLabel(c.room)}</Link></p>
                  <p className="text-sm text-slate-500">{fmtDate(c.startDate)}</p>
                  <p className="font-mono text-sm text-slate-700">{fmtMoney(c.rentAmount)}</p>
                  <div><Button size="sm" disabled={pending} onClick={() => checkIn(c.id)}>Check In</Button></div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
