import { prisma } from "@/lib/prisma";
import { requireUser, hostelScopeWhere, hostelUnitScopeWhere } from "@/lib/scope";
import PropertiesTree from "./PropertiesTree";

export default async function PropertiesPage() {
  const user = await requireUser();

  const [hostels, units, rooms, tenants] = await Promise.all([
    prisma.hostel.findMany({ where: hostelScopeWhere(user), orderBy: { name: "asc" } }),
    prisma.unit.findMany({ where: hostelUnitScopeWhere(user), orderBy: { name: "asc" } }),
    prisma.room.findMany({ where: hostelUnitScopeWhere(user), orderBy: { name: "asc" } }),
    prisma.tenant.findMany({ where: { roomId: { not: null } } }),
  ]);

  return (
    <PropertiesTree
      user={{ role: user.role, hostelIds: user.hostelIds }}
      hostels={hostels}
      units={units}
      rooms={rooms}
      tenants={tenants}
    />
  );
}
