"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createTenant } from "@/actions/tenants";
import { fmtMoney, roomLabel } from "@/lib/utils";
import { Card, Badge, Button, Input, EmptyState } from "@/components/ui";

type Tenant = {
  id: string;
  fullName: string;
  phone: string;
  status: string;
  room: { id: string; name: string; unit: { name: string } } | null;
  documents: { type: string }[];
  hostelName: string | null;
  rent: number | null;
  outstanding: number;
};

export default function TenantsClient({ tenants }: { tenants: Tenant[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", nationality: "" });

  const save = () => {
    setError("");
    startTransition(async () => {
      try {
        await createTenant(form);
        setForm({ fullName: "", phone: "", email: "", nationality: "" });
        setOpen(false);
      } catch (e: any) {
        setError(e?.message || "Something went wrong.");
      }
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Tenants</h1>
          <p className="text-sm text-slate-500">{tenants.length} tenant{tenants.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setOpen((v) => !v)}>+ Add Tenant</Button>
      </div>

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

      {open && (
        <Card className="mb-4 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Nationality" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save Tenant"}</Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        {tenants.length === 0 ? (
          <EmptyState title="No tenants yet" detail="Add your first tenant to start tracking occupancy and payments." />
        ) : (
          <div>
            <div className="hidden border-b border-slate-100 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[1.2fr_1fr_1fr_0.8fr_0.8fr_0.8fr_0.9fr]">
              <span>Name</span><span>Room</span><span>Hostel</span><span className="text-right">Rent</span><span className="text-right">Outstanding</span><span>Status</span><span>Documents</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {tenants.map((t) => (
                <li key={t.id} className="px-4 py-3 hover:bg-slate-50 sm:grid sm:grid-cols-[1.2fr_1fr_1fr_0.8fr_0.8fr_0.8fr_0.9fr] sm:items-center">
                  <Link href={`/tenants/${t.id}`} className="text-sm font-medium text-slate-900 hover:underline">{t.fullName}</Link>
                  <p className="text-sm text-slate-500">{t.room ? <Link href={`/rooms/${t.room.id}`} className="hover:underline">{roomLabel(t.room)}</Link> : "—"}</p>
                  <p className="text-sm text-slate-500">{t.hostelName ?? "—"}</p>
                  <p className="font-mono text-sm text-slate-700 sm:text-right">{t.rent != null ? fmtMoney(t.rent) : "—"}</p>
                  <p className={`font-mono text-sm sm:text-right ${t.outstanding > 0 ? "text-amber-700" : "text-slate-700"}`}>{fmtMoney(t.outstanding)}</p>
                  <div className="my-1 sm:my-0"><Badge status={t.status} /></div>
                  <p className="text-xs text-slate-400">
                    {t.documents.some((d) => d.type === "ID") ? "ID ✓" : "ID —"} · {t.documents.some((d) => d.type === "PASSPORT") ? "Passport ✓" : "Passport —"}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
