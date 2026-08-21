"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserOrThrow } from "@/lib/scope";

export async function createTenant(data: {
  fullName: string;
  phone: string;
  altPhone?: string;
  email?: string;
  nationality?: string;
  idType?: string;
  idNumber?: string;
  idExpiry?: string;
  dob?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  address?: string;
  notes?: string;
}) {
  await requireUserOrThrow();
  if (!data.fullName || !data.phone) throw new Error("Name and phone are required.");

  await prisma.tenant.create({
    data: {
      ...data,
      idExpiry: data.idExpiry ? new Date(data.idExpiry) : undefined,
      dob: data.dob ? new Date(data.dob) : undefined,
      status: "Inactive",
    },
  });
  revalidatePath("/tenants");
}

// status/roomId/hostelId are intentionally excluded — they're derived server-side by
// check-in/check-out/assign/move actions, never set directly from a form.
export async function updateTenant(id: string, data: Partial<{
  fullName: string; phone: string; altPhone: string; email: string; nationality: string;
  idType: string; idNumber: string; idExpiry: string; dob: string;
  emergencyContact: string; emergencyPhone: string; address: string; notes: string;
}>) {
  await requireUserOrThrow();
  await prisma.tenant.update({
    where: { id },
    data: {
      ...data,
      idExpiry: data.idExpiry ? new Date(data.idExpiry) : undefined,
      dob: data.dob ? new Date(data.dob) : undefined,
    },
  });
  revalidatePath("/tenants");
}
