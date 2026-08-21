import { prisma } from "@/lib/prisma";
import { requireUser, hostelScopeWhere } from "@/lib/scope";
import LedgerClient from "@/components/LedgerClient";

export default async function IncomePage() {
  const user = await requireUser();
  const [income, hostels] = await Promise.all([
    prisma.income.findMany({ where: hostelScopeWhere(user), include: { hostel: true, tenant: true }, orderBy: { date: "desc" } }),
    prisma.hostel.findMany({ where: hostelScopeWhere(user) }),
  ]);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const thisMonthTotal = income.filter((x) => new Date(x.date) >= monthStart).reduce((s, x) => s + x.amount, 0);
  const rows = income.map((i) => ({ id: i.id, date: i.date, hostelName: i.hostel.name, category: i.category, method: i.method, amount: i.amount, description: i.description, tenantId: i.tenantId, tenantName: i.tenant?.fullName ?? null }));
  return <LedgerClient kind="income" rows={rows} hostels={hostels} thisMonthTotal={thisMonthTotal} />;
}
