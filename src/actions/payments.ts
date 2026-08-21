"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserOrThrow, assertAccess } from "@/lib/scope";
import { round2 } from "@/lib/utils";

export async function recordPayment(input: { obligationId: string; amount: number; method: string; reference?: string }) {
  const user = await requireUserOrThrow();
  const obligation = await prisma.rentObligation.findUniqueOrThrow({ where: { id: input.obligationId } });
  assertAccess(user, obligation.hostelId, undefined);
  if (input.amount <= 0) throw new Error("Amount must be greater than zero.");

  const newPaid = round2(obligation.paidAmount + input.amount);

  await prisma.$transaction(async (tx) => {
    await tx.rentObligation.update({ where: { id: obligation.id }, data: { paidAmount: newPaid } });

    const room = await tx.room.findUniqueOrThrow({ where: { id: obligation.roomId } });

    await tx.payment.create({
      data: {
        tenantId: obligation.tenantId,
        contractId: obligation.contractId,
        obligationId: obligation.id,
        hostelId: obligation.hostelId,
        roomId: obligation.roomId,
        dueDate: obligation.dueDate,
        amount: input.amount,
        method: input.method,
        reference: input.reference,
        status: newPaid >= obligation.amount ? "Paid" : "Partial",
      },
    });

    await tx.income.create({
      data: {
        hostelId: obligation.hostelId,
        unitId: room.unitId,
        roomId: obligation.roomId,
        tenantId: obligation.tenantId,
        category: "Rent",
        amount: input.amount,
        method: input.method,
        reference: input.reference,
        description: "Rent payment",
      },
    });
  });

  revalidatePath("/payments");
  revalidatePath("/income");
  revalidatePath("/dashboard");
}
