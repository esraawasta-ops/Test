import { prisma } from "@/lib/prisma";
import { requireUser, userCanAccess } from "@/lib/scope";
import { notFound } from "next/navigation";
import { roomLabel } from "@/lib/utils";
import TenantDetailClient from "./TenantDetailClient";

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    include: {
      documents: true,
      room: { include: { unit: true } },
      contracts: {
        include: { hostel: true, room: { include: { unit: true } } },
        orderBy: { startDate: "desc" },
      },
      obligations: { select: { amount: true, paidAmount: true } },
      payments: { orderBy: { date: "desc" }, take: 20 },
    },
  });
  if (!tenant) notFound();
  if (!userCanAccess(user, tenant.hostelId, undefined)) notFound();

  const activeContract = tenant.contracts.find((c) => c.checkInDate && !c.checkOutDate && c.status === "Active") ?? null;
  const outstanding = tenant.obligations.reduce((s, o) => s + Math.max(0, o.amount - o.paidAmount), 0);

  const data = {
    id: tenant.id,
    fullName: tenant.fullName,
    phone: tenant.phone,
    email: tenant.email,
    status: tenant.status,
    room: tenant.room,
    documents: tenant.documents,
    hostelName: activeContract?.hostel.name ?? null,
    rent: activeContract?.rentAmount ?? null,
    outstanding,
    payments: tenant.payments.map((p) => ({ id: p.id, date: p.date, amount: p.amount, method: p.method, status: p.status })),
    contracts: tenant.contracts.map((c) => ({
      id: c.id,
      roomId: c.roomId,
      roomLabel: roomLabel(c.room),
      startDate: c.startDate,
      endDate: c.endDate,
      checkOutDate: c.checkOutDate,
      rentAmount: c.rentAmount,
      status: c.checkOutDate ? "Terminated" : !c.checkInDate ? "Draft" : "Active",
      endReason: c.endReason,
    })),
  };

  return <TenantDetailClient tenant={data} />;
}
