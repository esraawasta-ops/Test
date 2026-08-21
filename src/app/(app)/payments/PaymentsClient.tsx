"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { recordPayment } from "@/actions/payments";
import { fmtMoney, fmtDate, obligationStatus, round2, roomLabel } from "@/lib/utils";
import { Card, Badge, Button, Input, Select, Field, EmptyState, MetricSecondary } from "@/components/ui";

type Obligation = {
  id: string;
  tenantId: string;
  roomId: string;
  dueDate: string | Date;
  amount: number;
  paidAmount: number;
  tenant: { fullName: string };
  room: { name: string; unit: { name: string } };
  hostel: { name: string };
};

export default function PaymentsClient({ obligations, summary }: { obligations: Obligation[]; summary: { received: number; outstanding: number; overdue: number } }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [pay, setPay] = useState<Obligation | null>(null);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("Cash");
  const [reference, setReference] = useState("");

  const withStatus = useMemo(
    () => obligations.map((o) => ({ ...o, _status: obligationStatus({ amount: o.amount, paidAmount: o.paidAmount, dueDate: new Date(o.dueDate) }) })),
    [obligations]
  );
  const filtered = filter === "all" ? withStatus : withStatus.filter((o) => o._status === filter);

  const openPay = (o: Obligation) => {
    setPay(o);
    setAmount(round2(o.amount - o.paidAmount));
    setMethod("Cash");
    setReference("");
  };

  const confirm = () => {
    if (!pay) return;
    setError("");
    startTransition(async () => {
      try {
        await recordPayment({ obligationId: pay.id, amount, method, reference });
        setPay(null);
      } catch (e: any) {
        setError(e?.message || "Something went wrong.");
      }
    });
  };

  const filters = ["all", "Overdue", "Due", "Upcoming", "Partially Paid", "Paid"];

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">Payments</h1>
        <p className="text-sm text-slate-500">Rent schedule and payment recording</p>
      </div>
      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-3 gap-4">
          <MetricSecondary label="Received" value={fmtMoney(summary.received)} />
          <MetricSecondary label="Outstanding" value={fmtMoney(summary.outstanding)} />
          <MetricSecondary label="Overdue" value={fmtMoney(summary.overdue)} />
        </div>
      </Card>

      <div className="mb-3 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${filter === f ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState title="Nothing here" detail="No obligations match this filter." />
        ) : (
          <div>
            <div className="hidden border-b border-slate-100 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[0.8fr_1.1fr_1.2fr_0.8fr_0.8fr_0.8fr_0.9fr_auto]">
              <span>Due</span><span>Tenant</span><span>Hostel / Room</span><span className="text-right">Amount</span><span className="text-right">Paid</span><span className="text-right">Remaining</span><span>Status</span><span></span>
            </div>
            <ul className="divide-y divide-slate-100">
              {filtered.map((o) => (
                <li key={o.id} className="flex flex-col gap-1 px-4 py-3 hover:bg-slate-50 sm:grid sm:grid-cols-[0.8fr_1.1fr_1.2fr_0.8fr_0.8fr_0.8fr_0.9fr_auto] sm:items-center sm:gap-0">
                  <p className="text-sm text-slate-500 sm:text-slate-700">{fmtDate(o.dueDate)}</p>
                  <Link href={`/tenants/${o.tenantId}`} className="text-sm font-medium text-slate-900 hover:underline">{o.tenant.fullName}</Link>
                  <p className="text-sm text-slate-500">{o.hostel.name} · <Link href={`/rooms/${o.roomId}`} className="hover:underline">{roomLabel(o.room)}</Link></p>
                  <p className="font-mono text-sm text-slate-700 sm:text-right">{fmtMoney(o.amount)}</p>
                  <p className="font-mono text-sm text-slate-700 sm:text-right">{fmtMoney(o.paidAmount)}</p>
                  <p className="font-mono text-sm text-slate-900 sm:text-right">{fmtMoney(round2(o.amount - o.paidAmount))}</p>
                  <div><Badge status={o._status} /></div>
                  <div>{o._status !== "Paid" && <Button size="sm" onClick={() => openPay(o)}>Record</Button>}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {pay && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-16">
          <Card className="w-full max-w-md p-5 shadow-xl">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Record Payment — {pay.tenant.fullName}</h3>
            <div className="mb-3 rounded-lg bg-slate-50 p-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Due</span><span className="font-mono">{fmtMoney(pay.amount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Already paid</span><span className="font-mono">{fmtMoney(pay.paidAmount)}</span></div>
              <div className="flex justify-between font-medium"><span>Remaining</span><span className="font-mono">{fmtMoney(round2(pay.amount - pay.paidAmount))}</span></div>
            </div>
            <div className="space-y-3">
              <Field label="Amount"><Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field>
              <Field label="Payment Method">
                <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option>Cash</option><option>Bank Transfer</option><option>Card</option><option>Other</option>
                </Select>
              </Field>
              <Field label="Reference Number"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPay(null)}>Cancel</Button>
              <Button size="sm" disabled={pending} onClick={confirm}>{pending ? "Saving…" : "Save Payment"}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
