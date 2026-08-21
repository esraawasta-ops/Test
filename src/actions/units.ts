"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserOrThrow, userCanAccess } from "@/lib/scope";

export async function createUnit(data: { hostelId: string; name: string; type?: string; description?: string; notes?: string }) {
  const user = await requireUserOrThrow();
  if (!userCanAccess(user, data.hostelId)) throw new Error("You don't have access to this hostel.");
  if (!data.name) throw new Error("Unit name is required.");

  await prisma.unit.create({
    data: { hostelId: data.hostelId, name: data.name, type: data.type || "Apartment", description: data.description, notes: data.notes },
  });
  revalidatePath("/properties");
}

export async function updateUnit(id: string, data: Partial<{ name: string; type: string; description: string; status: string; notes: string }>) {
  const user = await requireUserOrThrow();
  const unit = await prisma.unit.findUniqueOrThrow({ where: { id } });
  if (!userCanAccess(user, unit.hostelId, unit.id)) throw new Error("You don't have access to this unit.");

  await prisma.unit.update({ where: { id }, data });
  revalidatePath("/properties");
}
