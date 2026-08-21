"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserOrThrow, userCanAccess } from "@/lib/scope";

export async function createHostel(data: {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  currency?: string;
  vatEnabled?: boolean;
  vatPercent?: number;
}) {
  const user = await requireUserOrThrow();
  // Only unrestricted users (typically Admin) can create new top-level hostels.
  if (user.hostelIds.length > 0) throw new Error("You don't have permission to add hostels.");
  if (!data.name || !data.code) throw new Error("Name and code are required.");

  await prisma.hostel.create({
    data: {
      name: data.name,
      code: data.code.toUpperCase(),
      address: data.address,
      phone: data.phone,
      email: data.email,
      description: data.description,
      currency: data.currency || "AED",
      vatEnabled: data.vatEnabled ?? true,
      vatPercent: data.vatPercent ?? 5,
    },
  });
  revalidatePath("/properties");
}

export async function updateHostel(id: string, data: Partial<{
  name: string; code: string; address: string; phone: string; email: string;
  description: string; currency: string; vatEnabled: boolean; vatPercent: number; active: boolean;
}>) {
  const user = await requireUserOrThrow();
  if (!userCanAccess(user, id)) throw new Error("You don't have access to this hostel.");

  await prisma.hostel.update({ where: { id }, data });
  revalidatePath("/properties");
}
