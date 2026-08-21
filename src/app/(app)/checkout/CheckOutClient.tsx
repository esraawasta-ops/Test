"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { checkOutContract } from "@/actions/contracts";
import { fmtMoney, fmtDate, round2 } from "@/lib/utils";
import { Card, Button, Input, Textarea, Field, EmptyState } from "@/components/ui";

type Row = {
  id: string;
  tenantId: string;
  roomId: string;
  tenantName: string;
  hostelName: string;
  roomName: string;
  checkInDate: string | Date | null;
  outstanding: number;
  depositAmount: number;
};

export default function CheckOutClient({ rows }: { rows: Row[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [sel, setSel] = useState<Row | null>(null);
  const [checkoutDate, setCheckoutDate] = useState(new Date().toISOString().slice(0, 10));
  const [deductions, setDeductions] = useState(0);
  const [notes, setNotes] = useState("");

  const openFor = (r: Row) => {
    setSel(r);
    setCheckoutDate(new Date().toISOString().slice(0, 10));
    setDeductions(0);
    setNotes("");
  };

  const confirm = () => {
    if (!sel) return;
    setError("");
    startTransition(async () => {
      try {
        await checkOutContract({ contractId: sel.id, checkOutDate: checkoutDate, deductions, notes });
        setSel(null);
      } catch (e: any) {
        setError(e?.message || "Something went wrong.");
      }
    });
  };

  const refund = sel ? round2(sel.depositAmount - Math.min(Math.max(0, deductions), sel.depositAmount)) : 0;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">Check-out</h1>
        <p className="text-sm text-slate-500">Active stays</p>
      </div>
      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState title="No active stays" detail="Checked-in tenants will show up here." />
        ) : (
          <div>
            <div className="hidden border-b border-slate-100 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[1.3fr_1.3fr_0.9fr_0.8fr_0.8fr_auto]">
              <span>Tenant</span><span>Hostel / Room</span><span>Checked in</span><span>Outstanding</span><span>Deposit</span><span></span>
            </div>
            <ul className="divide-y divide-slate-100">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 px-4 py-3 hover:bg-slate-50 sm:grid sm:grid-cols-[1.3fr_1.3fr_0.9fr_0.8fr_0.8fr_auto] sm:items-center sm:gap-0">
                  <Link href={`/tenants/${r.tenantId}`} className="text-sm font-medium text-slate-900 hover:underline">{r.tenantName}</Link>
                  <p className="text-sm text-slate-500">{r.hostelName} · <Link href={`/rooms/${r.roomId}`} className="hover:underline">{r.roomName}</Link></p>
                  <p className="text-sm text-slate-500">{fmtDate(r.checkInDate)}</p>
                  <p className="font-mono text-sm text-slate-700">{fmtMoney(r.outstanding)}</p>
                  <p className="font-mono text-sm text-slate-700">{fmtMoney(r.depositAmount)}</p>
                  <div><Button size="sm" variant="secondary" onClick={() => openFor(r)}>Check Out</Button></div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {sel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-16">
          <Card className="w-full max-w-md p-5 shadow-xl">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Check Out — {sel.tenantName}</h3>
            {sel.outstanding > 0 && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Outstanding rent of {fmtMoney(sel.outstanding)} is not yet settled.
              </div>
            )}
            <Field label="Check-out Date"><Input type="date" value={checkoutDate} onChange={(e) => setCheckoutDate(e.target.value)} /></Field>
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Original deposit</span><span className="font-mono">{fmtMoney(sel.depositAmount)}</span></div>
              <div className="mt-2"><Field label="Deductions"><Input type="number" min={0} max={sel.depositAmount} value={deductions} onChange={(e) => setDeductions(Number(e.target.value))} /></Field></div>
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-medium"><span>Refund amount</span><span className="font-mono text-emerald-700">{fmtMoney(refund)}</span></div>
            </div>
            <div className="mt-3"><Field label="Checkout Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field></div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setSel(null)}>Cancel</Button>
              <Button size="sm" disabled={pending} onClick={confirm}>{pending ? "Saving…" : "Confirm Check-out"}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
