import { prisma } from "@/lib/prisma";
import { requireUser, userCanAccess } from "@/lib/scope";
import { notFound } from "next/navigation";
import RoomDetailClient from "./RoomDetailClient";

export default async function RoomDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const room = await prisma.room.findUnique({
    where: { id: params.id },
    include: {
      unit: true,
      hostel: true,
      tenants: true, // tenants currently pointing roomId at this room (should be 0 or 1)
      contracts: { include: { tenant: true }, orderBy: { startDate: "desc" } },
    },
  });
  if (!room) notFound();
  if (!userCanAccess(user, room.hostelId, room.unitId)) notFound();

  const occupant = room.tenants[0] ?? null;
  const activeContract = occupant
    ? room.contracts.find((c) => c.tenantId === occupant.id && c.checkInDate && !c.checkOutDate && c.status === "Active")
    : null;

  const data = {
    id: room.id,
    name: room.name,
    type: room.type,
    capacity: room.capacity,
    monthlyPrice: room.monthlyPrice,
    deposit: room.deposit,
    status: room.status,
    hostelName: room.hostel.name,
    unitName: room.unit.name,
    occupant: occupant ? { id: occupant.id, fullName: occupant.fullName } : null,
    activeContract: activeContract ? { checkInDate: activeContract.checkInDate, endDate: activeContract.endDate } : null,
    history: room.contracts.map((c) => ({
      id: c.id,
      tenantId: c.tenantId,
      tenantName: c.tenant.fullName,
      startDate: c.startDate,
      endDate: c.endDate,
      checkOutDate: c.checkOutDate,
      rentAmount: c.rentAmount,
      status: c.checkOutDate ? "Terminated" : !c.checkInDate ? "Draft" : "Active",
      endReason: c.endReason,
    })),
  };

  return <RoomDetailClient room={data} />;
}
