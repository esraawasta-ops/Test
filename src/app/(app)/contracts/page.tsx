import { prisma } from "@/lib/prisma";
import { requireUser, hostelUnitScopeWhere } from "@/lib/scope";
import ContractsClient from "./ContractsClient";

export default async function ContractsPage() {
  const user = await requireUser();
  const [contracts, rooms, tenants] = await Promise.all([
    prisma.contract.findMany({ where: hostelUnitScopeWhere(user), include: { tenant: true, room: { include: { unit: true } }, hostel: true }, orderBy: { createdAt: "desc" } }),
    prisma.room.findMany({ where: hostelUnitScopeWhere(user), include: { unit: true }, orderBy: { name: "asc" } }),
    prisma.tenant.findMany({ orderBy: { fullName: "asc" } }),
  ]);
  return <ContractsClient contracts={contracts} rooms={rooms} tenants={tenants} />;
}
