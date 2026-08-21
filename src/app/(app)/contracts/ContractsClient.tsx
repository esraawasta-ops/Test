"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createContract, terminateContract } from "@/actions/contracts";
import { fmtMoney, fmtDate, roomLabel } from "@/lib/utils";
import { Card, Badge, Button, Input, Select, EmptyState } from "@/components/ui";

type Contract = {
  id: string;
  tenantId: string;
  roomId: string;
  rentAmount: number;
  billingFrequency: string;
  startDate: string | Date;
  endDate: string | Date | null;
  checkInDate: string | Date | null;
  checkOutDate: string | Date | null;
  status: string;
  tenant: { fullName: string };
  room: { name: string; monthlyPrice: number; deposit: number; unit: { name: string } };
  hostel: { name: string };
  endReason: string | null;
};
type Room = { id: string; name: string; monthlyPrice: number; deposit: number; unit: { name: string } };
type Tenant = { id: string; fullName: string };

function contractStatus(c: Contract) {
  return c.checkOutDate ? "Terminated" : !c.checkInDate ? "Draft" : "Active";
}

export default function ContractsClient({ contracts, rooms, tenants }: { contracts: Contract[]; rooms: Room[]; tenants: Tenant[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [tenantId, setTenantId] = useState(tenants[0]?.id || "");
  const [roomId, setRoomId] = useState(rooms[0]?.id || "");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [months, setMonths] = useState(12);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Active" | "Awaiting Check-in" | "Archived" | "All">("Active");

  const selectedRoom = rooms.find((r) => r.id === roomId);

  const save = () => {
    setError("");
    const end = new Date(startDate);
    end.setMonth(end.getMonth() + months);
    startTransition(async () => {
      try {
        await createContract({
          tenantId,
          roomId,
          startDate,
          endDate: end.toISOString().slice(0, 10),
          billingFrequency: "Monthly",
          rentAmount: selectedRoom?.monthlyPrice || 0,
          deposit: selectedRoom?.deposit || 0,
        });
        setOpen(false);
      } catch (e: any) {
        setError(e?.message || "Something went wrong.");
      }
    });
  };

  const terminate = (id: string) => {
    if (!confirm("Terminate this contract? Historical records are kept.")) return;
    startTransition(async () => {
      try {
        await terminateContract(id);
      } catch (e: any) {
        setError(e?.message || "Something went wrong.");
      }
    });
  };

  const searched = contracts.filter((c) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return [c.tenant.fullName, roomLabel(c.room), c.hostel.name, c.endReason || ""].join(" ").toLowerCase().includes(needle);
  });
  const filtered = searched.filter((c) => {
    const label = contractStatus(c);
    if (statusFilter === "All") return true;
    if (statusFilter === "Awaiting Check-in") return label === "Draft";
    if (statusFilter === "Archived") return label === "Terminated";
    return label === "Active";
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Contracts</h1>
          <p className="text-sm text-slate-500">{contracts.length} contract{contracts.length !== 1 ? "s" : ""} total</p>
        </div>
        <Button onClick={() => setOpen((v) => !v)}>+ New Contract</Button>
      </div>

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

      {open && (
        <Card className="mb-4 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
            </Select>
            <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              {rooms.map((r) => <option key={r.id} value={r.id}>{roomLabel(r)} ({fmtMoney(r.monthlyPrice)})</option>)}
            </Select>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input type="number" value={months} onChange={(e) => setMonths(Number(e.target.value))} placeholder="Term (months)" />
          </div>
          <p className="mt-2 text-xs text-slate-400">The tenant becomes Active once checked in from the Check-in page.</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={pending || !tenantId || !roomId} onClick={save}>{pending ? "Saving…" : "Save Contract"}</Button>
          </div>
        </Card>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(["Active", "Awaiting Check-in", "Archived", "All"] as const).map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${statusFilter === f ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"}`}>{f}</button>
          ))}
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 sm:max-w-xs">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tenant, room, hostel…" className="w-full border-0 p-0 text-sm focus:outline-none focus:ring-0" />
        </div>
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState title={statusFilter === "Archived" ? "No archived contracts match" : "No contracts found"} detail="New contracts appear here once a tenant is signed to a room." />
        ) : (
          <div>
            <div className="hidden border-b border-slate-100 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[1.3fr_1.3fr_0.8fr_1.2fr_1.2fr_auto]">
              <span>Tenant</span><span>Hostel / Room</span><span>Rent</span><span>Term</span><span>Status</span><span></span>
            </div>
            <ul className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <li key={c.id} className="flex flex-col gap-1 px-4 py-3 hover:bg-slate-50 sm:grid sm:grid-cols-[1.3fr_1.3fr_0.8fr_1.2fr_1.2fr_auto] sm:items-center sm:gap-0">
                  <Link href={`/tenants/${c.tenantId}`} className="text-sm font-medium text-slate-900 hover:underline">{c.tenant.fullName}</Link>
                  <p className="text-sm text-slate-500">{c.hostel.name} · <Link href={`/rooms/${c.roomId}`} className="hover:underline">{roomLabel(c.room)}</Link></p>
                  <p className="font-mono text-sm text-slate-700">{fmtMoney(c.rentAmount)}</p>
                  <p className="text-sm text-slate-500">{fmtDate(c.startDate)} – {fmtDate(c.endDate)}</p>
                  <div>
                    <Badge status={contractStatus(c)}>{c.checkOutDate ? "Terminated" : !c.checkInDate ? "Awaiting Check-in" : "Active"}</Badge>
                    {c.checkOutDate && c.endReason && <p className="mt-0.5 text-xs text-slate-400">{c.endReason} · {fmtDate(c.checkOutDate)}</p>}
                  </div>
                  <div>
                    {!c.checkOutDate && c.status === "Active" && (
                      <button onClick={() => terminate(c.id)} className="text-xs font-medium text-rose-600 hover:underline">Terminate</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
