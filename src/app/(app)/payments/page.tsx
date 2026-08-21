import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/scope";
import { obligationStatus, round2 } from "@/lib/utils";
import PaymentsClient from "./PaymentsClient";

export default async function PaymentsPage() {
  const user = await requireUser();

  const obligationWhere: Record<string, unknown> = {};
  if (user.hostelIds.length) obligationWhere.hostelId = { in: user.hostelIds };
  if (user.unitIds.length) obligationWhere.room = { unitId: { in: user.unitIds } };

  const obligations = await prisma.rentObligation.findMany({
    where: obligationWhere,
    include: { tenant: true, room: { include: { unit: true } }, hostel: true },
    orderBy: { dueDate: "asc" },
  });

  const paymentWhere: Record<string, unknown> = {};
  if (user.hostelIds.length) paymentWhere.hostelId = { in: user.hostelIds };
  if (user.unitIds.length) paymentWhere.room = { unitId: { in: user.unitIds } };
  const receivedAgg = await prisma.payment.aggregate({ where: paymentWhere, _sum: { amount: true } });

  const today = new Date();
  const outstanding = obligations.reduce((s, o) => s + Math.max(0, round2(o.amount - o.paidAmount)), 0);
  const overdue = obligations
    .filter((o) => obligationStatus({ amount: o.amount, paidAmount: o.paidAmount, dueDate: o.dueDate }, today) === "Overdue")
    .reduce((s, o) => s + round2(o.amount - o.paidAmount), 0);

  return <PaymentsClient obligations={obligations} summary={{ received: receivedAgg._sum.amount ?? 0, outstanding, overdue }} />;
}
