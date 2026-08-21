import { requireUser } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";

const ROLE_ACCESS: Record<string, string[]> = {
  ADMIN: ["dashboard", "properties", "tenants", "contracts", "checkin", "checkout", "payments", "income", "expenses", "deposits", "users"],
  MANAGER: ["dashboard", "properties", "tenants", "contracts", "checkin", "checkout", "payments", "income", "expenses", "deposits"],
  RECEPTION: ["dashboard", "properties", "tenants", "checkin", "checkout", "payments"],
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const allowedTabs = ROLE_ACCESS[user.role] ?? [];

  // Always reflects the user's full access scope (not any page-level filter) so it's a
  // reliable "is anything late right now" signal no matter which page they're on.
  const obligationWhere: Record<string, unknown> = { dueDate: { lt: new Date() } };
  if (user.hostelIds.length) obligationWhere.hostelId = { in: user.hostelIds };
  if (user.unitIds.length) obligationWhere.room = { unitId: { in: user.unitIds } };
  const lateObligations = await prisma.rentObligation.findMany({ where: obligationWhere, select: { amount: true, paidAmount: true } });
  const overdueCount = lateObligations.filter((o) => o.paidAmount < o.amount).length;

  return (
    <AppShell user={{ name: user.name, role: user.role }} allowedTabs={allowedTabs} overdueCount={overdueCount}>
      {children}
    </AppShell>
  );
}
