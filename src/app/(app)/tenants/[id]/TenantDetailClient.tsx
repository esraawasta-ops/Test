"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { roomLabel, fmtMoney, fmtDate } from "@/lib/utils";
import { Card, Badge, MetricPrimary, MetricSecondary, EmptyState } from "@/components/ui";

type Doc = { id: string; type: string; filename: string; uploadedAt: string };
type Payment = { id: string; date: string | Date; amount: number; method: string; status: string };
type ContractRow = {
  id: string;
  roomId: string;
  roomLabel: string;
  startDate: string | Date;
  endDate: string | Date | null;
  checkOutDate: string | Date | null;
  rentAmount: number;
  status: string;
  endReason: string | null;
};
type Tenant = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  status: string;
  room: { name: string; unit: { name: string } } | null;
  documents: Doc[];
  hostelName: string | null;
  rent: number | null;
  outstanding: number;
  payments: Payment[];
  contracts: ContractRow[];
};

export default function TenantDetailClient({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const idDoc = tenant.documents.find((d) => d.type === "ID");
  const passportDoc = tenant.documents.find((d) => d.type === "PASSPORT");
  const [docType, setDocType] = useState<"ID" | "PASSPORT">("ID");

  return (
    <div className="max-w-2xl">
      <Link href="/tenants" className="mb-3 inline-block text-xs font-medium text-slate-500 hover:text-slate-700">← Back to Tenants</Link>
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">{tenant.fullName}</h1>
        <p className="text-sm text-slate-500">
          {tenant.phone}{tenant.email ? ` · ${tenant.email}` : ""}{tenant.hostelName ? ` · ${tenant.hostelName}` : ""}{tenant.room ? ` · ${roomLabel(tenant.room)}` : ""}
        </p>
      </div>

      <Card className="mb-5 p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <MetricSecondary label="Monthly Rent" value={tenant.rent != null ? fmtMoney(tenant.rent) : "—"} />
          <MetricPrimary label="Current Balance" value={fmtMoney(tenant.outstanding)} tone={tenant.outstanding > 0 ? "warn" : "good"} />
        </div>
      </Card>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Identity Document</p>
      <Card className="mb-5 p-3">
        <div className="mb-2 flex gap-1.5">
          <button onClick={() => setDocType("ID")} className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${docType === "ID" ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"}`}>ID</button>
          <button onClick={() => setDocType("PASSPORT")} className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${docType === "PASSPORT" ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"}`}>Passport</button>
        </div>
        <DocUploader tenantId={tenant.id} type={docType} doc={docType === "ID" ? idDoc : passportDoc} onDone={() => router.refresh()} />
      </Card>
      <p className="mb-5 text-xs text-slate-400">
        Files are stored on the server outside the public directory and are only reachable through this signed-in,
        access-scoped route — not by direct URL.
      </p>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Contract History</p>
      <Card className="mb-5 overflow-hidden">
        {tenant.contracts.length === 0 ? (
          <EmptyState title="No contracts yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {tenant.contracts.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/rooms/${c.roomId}`} className="truncate text-sm font-medium text-slate-900 hover:underline">{c.roomLabel}</Link>
                  <p className="truncate text-xs text-slate-400">
                    {fmtDate(c.startDate)} – {fmtDate(c.endDate)}{c.checkOutDate ? ` · ended ${fmtDate(c.checkOutDate)}` : ""}
                    {c.endReason ? ` · ${c.endReason}` : ""}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className="font-mono text-sm text-slate-700">{fmtMoney(c.rentAmount)}</span>
                  <Badge status={c.status}>{c.status === "Draft" ? "Awaiting Check-in" : c.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Payment History</p>
      <Card className="overflow-hidden">
        {tenant.payments.length === 0 ? (
          <EmptyState title="No payments recorded yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {tenant.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <p className="text-slate-700">{fmtDate(p.date)}</p>
                  <p className="text-xs text-slate-400">{p.method}{p.status === "Partial" ? " · Partial" : ""}</p>
                </div>
                <span className="font-mono text-slate-900">{fmtMoney(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function DocUploader({ tenantId, type, doc, onDone }: { tenantId: string; type: string; doc?: Doc; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const upload = (file: File) => {
    setError("");
    const fd = new FormData();
    fd.append("type", type);
    fd.append("file", file);
    startTransition(async () => {
      const res = await fetch(`/api/tenants/${tenantId}/documents`, { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Upload failed.");
        return;
      }
      onDone();
    });
  };

  return (
    <div>
      {doc ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="truncate text-slate-700">{doc.filename}</span>
          <a href={`/api/tenants/${tenantId}/documents/${doc.id}`} target="_blank" rel="noreferrer" className="ml-auto text-xs font-medium text-slate-900 hover:underline">
            View
          </a>
          <label className="cursor-pointer text-xs font-medium text-slate-500 hover:underline">
            {pending ? "Uploading…" : "Replace"}
            <input type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" disabled={pending} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-between text-sm">
          <span className="text-slate-400">No file uploaded</span>
          <span className="text-xs font-medium text-slate-900 hover:underline">{pending ? "Uploading…" : "Upload"}</span>
          <input type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" disabled={pending} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      )}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
