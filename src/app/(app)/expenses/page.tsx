import { prisma } from "@/lib/prisma";
import { requireUser, hostelScopeWhere } from "@/lib/scope";
import LedgerClient from "@/components/LedgerClient";

export default async function ExpensesPage() {
  const user = await requireUser();
  const [expenses, hostels] = await Promise.all([
    prisma.expense.findMany({ where: hostelScopeWhere(user), include: { hostel: true }, orderBy: { date: "desc" } }),
    prisma.hostel.findMany({ where: hostelScopeWhere(user) }),
  ]);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const thisMonthTotal = expenses.filter((x) => new Date(x.date) >= monthStart).reduce((s, x) => s + x.amount, 0);
  const rows = expenses.map((e) => ({ id: e.id, date: e.date, hostelName: e.hostel.name, category: e.category, method: e.method, amount: e.amount, description: e.description, vendor: e.vendor }));
  return <LedgerClient kind="expense" rows={rows} hostels={hostels} thisMonthTotal={thisMonthTotal} />;
}
