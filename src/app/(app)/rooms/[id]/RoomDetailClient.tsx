import Link from "next/link";
import { fmtMoney, fmtDate } from "@/lib/utils";
import { Card, Badge, EmptyState } from "@/components/ui";

type Room = {
  id: string;
  name: string;
  type: string;
  capacity: number;
  monthlyPrice: number;
  deposit: number;
  status: string;
  hostelName: string;
  unitName: string;
  occupant: { id: string; fullName: string } | null;
  activeContract: { checkInDate: string | Date | null; endDate: string | Date | null } | null;
  history: {
    id: string;
    tenantId: string;
    tenantName: string;
    startDate: string | Date;
    endDate: string | Date | null;
    checkOutDate: string | Date | null;
    rentAmount: number;
    status: string;
    endReason: string | null;
  }[];
};

export default function RoomDetailClient({ room }: { room: Room }) {
  return (
    <div className="max-w-2xl">
      <Link href="/properties" className="mb-3 inline-block text-xs font-medium text-slate-500 hover:text-slate-700">← Back to Properties</Link>
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">{room.unitName}-{room.name}</h1>
        <p className="text-sm text-slate-500">{room.hostelName} · {room.type} · cap {room.capacity}</p>
      </div>

      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge status={room.status} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div><p className="text-xs text-slate-500">Monthly Price</p><p className="font-mono text-sm text-slate-900">{fmtMoney(room.monthlyPrice)}</p></div>
          <div><p className="text-xs text-slate-500">Deposit</p><p className="font-mono text-sm text-slate-900">{fmtMoney(room.deposit)}</p></div>
        </div>
      </Card>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Current Tenant</p>
      <Card className="mb-5 p-4">
        {room.occupant ? (
          <>
            <Link href={`/tenants/${room.occupant.id}`} className="text-sm font-medium text-slate-900 hover:underline">{room.occupant.fullName}</Link>
            {room.activeContract && (
              <p className="mt-1 text-xs text-slate-500">
                Checked in {fmtDate(room.activeContract.checkInDate)} · Contract ends {fmtDate(room.activeContract.endDate)}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-400">No current tenant</p>
        )}
      </Card>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Contract History</p>
      <Card className="overflow-hidden">
        {room.history.length === 0 ? (
          <EmptyState title="No contracts recorded for this room yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {room.history.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/tenants/${c.tenantId}`} className="truncate text-sm font-medium text-slate-900 hover:underline">{c.tenantName}</Link>
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
    </div>
  );
}
