import { prisma } from "@/lib/prisma";
import { requireUser, hostelUnitScopeWhere } from "@/lib/scope";
import { roomLabel } from "@/lib/utils";
import CheckOutClient from "./CheckOutClient";

export default async function CheckOutPage() {
  const user = await requireUser();
  const active = await prisma.contract.findMany({
    where: { ...hostelUnitScopeWhere(user), checkInDate: { not: null }, checkOutDate: null },
    include: { tenant: true, room: { include: { unit: true } }, hostel: true, obligations: true, deposit_: true },
    orderBy: { checkInDate: "asc" },
  });

  const rows = active.map((c) => ({
    id: c.id,
    tenantId: c.tenantId,
    roomId: c.roomId,
    tenantName: c.tenant.fullName,
    hostelName: c.hostel.name,
    roomName: roomLabel(c.room),
    checkInDate: c.checkInDate,
    outstanding: c.obligations.reduce((s, o) => s + Math.max(0, o.amount - o.paidAmount), 0),
    depositAmount: c.deposit_?.amount ?? 0,
  }));

  return <CheckOutClient rows={rows} />;
}
