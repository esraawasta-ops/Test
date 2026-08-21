import { prisma } from "@/lib/prisma";
import { requireUser, hostelUnitScopeWhere } from "@/lib/scope";
import CheckInClient from "./CheckInClient";

export default async function CheckInPage() {
  const user = await requireUser();
  const pending = await prisma.contract.findMany({
    where: { ...hostelUnitScopeWhere(user), checkInDate: null, checkOutDate: null },
    include: { tenant: true, room: { include: { unit: true } }, hostel: true },
    orderBy: { startDate: "asc" },
  });
  return <CheckInClient contracts={pending} />;
}
