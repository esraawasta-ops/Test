import { prisma } from "@/lib/prisma";
import { requireUser, hostelScopeWhere } from "@/lib/scope";
import Link from "next/link";
import { fmtMoney, fmtDate, roomLabel } from "@/lib/utils";
import { Card, Badge, EmptyState } from "@/components/ui";

export default async function DepositsPage() {
  const user = await requireUser();
  const deposits = await prisma.deposit.findMany({
    where: hostelScopeWhere(user),
    include: { tenant: true, room: { include: { unit: true } }, hostel: true },
    orderBy: { date: "desc" },
  });
  const held = deposits.filter((d) => d.status === "Held").reduce((s, d) => s + d.amount, 0);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">Deposits</h1>
        <p className="text-sm text-slate-500">{fmtMoney(held)} currently held</p>
      </div>
      <Card className="overflow-hidden">
        {deposits.length === 0 ? (
          <EmptyState title="No deposits recorded" />
        ) : (
          <div>
            <div className="hidden border-b border-slate-100 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[1.2fr_1.3fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr]">
              <span>Tenant</span><span>Hostel / Room</span><span>Date</span><span className="text-right">Amount</span><span className="text-right">Deductions</span><span className="text-right">Refund</span><span>Status</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {deposits.map((d) => (
                <li key={d.id} className="flex flex-col gap-1 px-4 py-3 hover:bg-slate-50 sm:grid sm:grid-cols-[1.2fr_1.3fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr] sm:items-center sm:gap-0">
                  <Link href={`/tenants/${d.tenantId}`} className="text-sm font-medium text-slate-900 hover:underline">{d.tenant.fullName}</Link>
                  <p className="text-sm text-slate-500">{d.hostel.name} · <Link href={`/rooms/${d.roomId}`} className="hover:underline">{roomLabel(d.room)}</Link></p>
                  <p className="text-sm text-slate-500">{fmtDate(d.date)}</p>
                  <p className="font-mono text-sm text-slate-700 sm:text-right">{fmtMoney(d.amount)}</p>
                  <p className="font-mono text-sm text-slate-700 sm:text-right">{fmtMoney(d.deductions)}</p>
                  <p className="font-mono text-sm text-slate-700 sm:text-right">{fmtMoney(d.refundAmount)}</p>
                  <div><Badge status={d.status} /></div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs text-slate-400">Refundable deposits are tracked separately and are never counted toward rental income.</p>
    </div>
  );
}
