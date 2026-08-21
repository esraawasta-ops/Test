import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/scope";
import TenantsClient from "./TenantsClient";

export default async function TenantsPage() {
  await requireUser();
  const tenants = await prisma.tenant.findMany({
    orderBy: { fullName: "asc" },
    include: {
      room: { include: { unit: true } },
      documents: { select: { type: true } },
      contracts: { where: { checkInDate: { not: null }, checkOutDate: null, status: "Active" }, include: { hostel: true }, take: 1 },
      obligations: { select: { amount: true, paidAmount: true } },
    },
  });

  const rows = tenants.map((t) => {
    const activeContract = t.contracts[0] ?? null;
    const outstanding = t.obligations.reduce((s, o) => s + Math.max(0, o.amount - o.paidAmount), 0);
    return {
      id: t.id,
      fullName: t.fullName,
      phone: t.phone,
      status: t.status,
      room: t.room,
      documents: t.documents,
      hostelName: activeContract?.hostel.name ?? null,
      rent: activeContract?.rentAmount ?? null,
      outstanding,
    };
  });

  return <TenantsClient tenants={rows} />;
}
