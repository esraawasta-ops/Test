"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserOrThrow, requireAdmin } from "@/lib/scope";
import { hashPassword } from "@/lib/password";

export async function createUser(data: {
  name: string;
  username: string;
  password: string;
  role: "ADMIN" | "MANAGER" | "RECEPTION";
  hostelIds: string[];
  unitIds: string[];
}) {
  const user = await requireUserOrThrow();
  requireAdmin(user);

  if (!data.name || !data.username) throw new Error("Name and username are required.");
  if (!data.password || data.password.length < 8) throw new Error("Password must be at least 8 characters.");

  const existing = await prisma.user.findUnique({ where: { username: data.username } });
  if (existing) throw new Error("That username is already taken.");

  const passwordHash = await hashPassword(data.password);
  await prisma.user.create({
    data: { name: data.name, username: data.username.trim(), passwordHash, role: data.role, hostelIds: data.hostelIds, unitIds: data.unitIds },
  });

  revalidatePath("/users");
}

export async function updateUserAccess(id: string, data: { name: string; username: string; role: "ADMIN" | "MANAGER" | "RECEPTION"; hostelIds: string[]; unitIds: string[] }) {
  const user = await requireUserOrThrow();
  requireAdmin(user);

  const existing = await prisma.user.findFirst({ where: { username: data.username, NOT: { id } } });
  if (existing) throw new Error("That username is already taken.");

  await prisma.user.update({
    where: { id },
    data: { name: data.name, username: data.username.trim(), role: data.role, hostelIds: data.hostelIds, unitIds: data.unitIds },
  });

  revalidatePath("/users");
}

export async function resetUserPassword(id: string, newPassword: string) {
  const user = await requireUserOrThrow();
  requireAdmin(user);

  if (!newPassword || newPassword.length < 8) throw new Error("Password must be at least 8 characters.");

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id }, data: { passwordHash } });

  revalidatePath("/users");
}
