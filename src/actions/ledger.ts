"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserOrThrow, assertAccess } from "@/lib/scope";

export async function createIncome(data: {
  date: string;
  hostelId: string;
  unitId?: string;
  category: string;
  amount: number;
  method: string;
  reference?: string;
  description?: string;
}) {
  const user = await requireUserOrThrow();
  assertAccess(user, data.hostelId, data.unitId);
  if (!data.amount || data.amount <= 0) throw new Error("Amount must be greater than zero.");

  await prisma.income.create({ data: { ...data, date: new Date(data.date) } });
  revalidatePath("/income");
  revalidatePath("/dashboard");
}

export async function createExpense(data: {
  date: string;
  hostelId: string;
  unitId?: string;
  category: string;
  amount: number;
  method: string;
  vendor?: string;
  reference?: string;
  description?: string;
}) {
  const user = await requireUserOrThrow();
  assertAccess(user, data.hostelId, data.unitId);
  if (!data.amount || data.amount <= 0) throw new Error("Amount must be greater than zero.");

  await prisma.expense.create({ data: { ...data, date: new Date(data.date) } });
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}
