"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserOrThrow, userCanAccess, assertAccess } from "@/lib/scope";
import { generateObligationDates } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

/** Safety net: if a room is about to be handed to a (different) tenant, force-close any
 * contract still open on it first. Assign/Move only ever target Available rooms, so this is
 * normally a no-op — it just guarantees a room can never end up with two active contracts. */
async function cancelOrphanedContractsOnRoom(tx: Prisma.TransactionClient, roomId: string, exceptTenantId: string) {
  const orphans = await tx.contract.findMany({
    where: { roomId, tenantId: { not: exceptTenantId }, checkInDate: { not: null }, checkOutDate: null, status: "Active" },
  });
  const today = new Date();
  for (const c of orphans) {
    const reason = "Auto-cancelled — room reassigned to another tenant";
    await tx.contract.update({
      where: { id: c.id },
      data: { status: "Terminated", checkOutDate: today, endReason: reason, notes: c.notes ? `${c.notes} | ${reason}` : reason },
    });
    const other = await tx.contract.findFirst({
      where: { tenantId: c.tenantId, id: { not: c.id }, checkInDate: { not: null }, checkOutDate: null, status: "Active" },
    });
    await tx.tenant.update({
      where: { id: c.tenantId },
      data: other ? { roomId: other.roomId, hostelId: other.hostelId, status: "Active" } : { roomId: null, hostelId: null, status: "Inactive" },
    });
  }
}

export async function createRoom(data: {
  unitId: string;
  name: string;
  type?: string;
  capacity?: number;
  dailyPrice?: number;
  weeklyPrice?: number;
  monthlyPrice?: number;
  deposit?: number;
  depositRequired?: boolean;
  notes?: string;
}) {
  const user = await requireUserOrThrow();
  const unit = await prisma.unit.findUniqueOrThrow({ where: { id: data.unitId } });
  assertAccess(user, unit.hostelId, unit.id);
  if (!data.name) throw new Error("Room name is required.");

  await prisma.room.create({
    data: {
      hostelId: unit.hostelId,
      unitId: unit.id,
      name: data.name,
      type: data.type || "Single",
      capacity: data.capacity ?? 1,
      dailyPrice: data.dailyPrice ?? 0,
      weeklyPrice: data.weeklyPrice ?? 0,
      monthlyPrice: data.monthlyPrice ?? 0,
      deposit: data.deposit ?? 0,
      depositRequired: data.depositRequired ?? true,
      notes: data.notes,
    },
  });
  revalidatePath("/properties");
}

export async function updateRoom(id: string, data: Partial<{
  name: string; type: string; capacity: number; dailyPrice: number; weeklyPrice: number;
  monthlyPrice: number; deposit: number; depositRequired: boolean; status: string; notes: string;
}>) {
  const user = await requireUserOrThrow();
  const room = await prisma.room.findUniqueOrThrow({ where: { id } });
  assertAccess(user, room.hostelId, room.unitId);

  await prisma.room.update({ where: { id }, data });
  revalidatePath("/properties");
}

/**
 * Directly assigns a tenant with no current room into an available room — creates the
 * contract and checks them in immediately in a single step (mirrors "Assign" in the app).
 */
export async function assignTenantToRoom(input: {
  tenantId: string;
  roomId: string;
  startDate: string; // ISO date
  months: number;
  rentAmount: number;
  deposit: number;
}) {
  const user = await requireUserOrThrow();
  const room = await prisma.room.findUniqueOrThrow({ where: { id: input.roomId } });
  assertAccess(user, room.hostelId, room.unitId);
  if (room.status !== "Available") throw new Error("This room isn't available.");

  const start = new Date(input.startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + input.months);

  await prisma.$transaction(async (tx) => {
    await cancelOrphanedContractsOnRoom(tx, room.id, input.tenantId);

    const contract = await tx.contract.create({
      data: {
        tenantId: input.tenantId,
        hostelId: room.hostelId,
        unitId: room.unitId,
        roomId: room.id,
        startDate: start,
        endDate: end,
        billingFrequency: "Monthly",
        rentAmount: input.rentAmount,
        deposit: input.deposit,
        status: "Active",
        checkInDate: start,
        notes: "Assigned directly",
      },
    });

    if (input.deposit > 0) {
      await tx.deposit.create({
        data: { tenantId: input.tenantId, contractId: contract.id, hostelId: room.hostelId, roomId: room.id, amount: input.deposit, date: start, status: "Held" },
      });
    }

    const dates = generateObligationDates(start, end, "Monthly");
    await tx.rentObligation.createMany({
      data: dates.map((dueDate) => ({ contractId: contract.id, tenantId: input.tenantId, hostelId: room.hostelId, roomId: room.id, dueDate, amount: input.rentAmount })),
    });

    await tx.room.update({ where: { id: room.id }, data: { status: "Occupied" } });
    await tx.tenant.update({ where: { id: input.tenantId }, data: { status: "Active", roomId: room.id, hostelId: room.hostelId } });
  });

  revalidatePath("/properties");
  revalidatePath("/tenants");
  revalidatePath("/dashboard");
}

/** Moves a tenant who already has an active stay into a different available room. */
export async function moveTenantToRoom(input: { tenantId: string; newRoomId: string; updateRent: boolean }) {
  const user = await requireUserOrThrow();

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: input.tenantId } });
  const contract = await prisma.contract.findFirst({
    where: { tenantId: tenant.id, checkInDate: { not: null }, checkOutDate: null, status: "Active" },
  });
  if (!contract) throw new Error("This tenant has no active stay to move.");

  const newRoom = await prisma.room.findUniqueOrThrow({ where: { id: input.newRoomId } });
  assertAccess(user, contract.hostelId, contract.unitId);
  assertAccess(user, newRoom.hostelId, newRoom.unitId);
  if (newRoom.status !== "Available") throw new Error("The target room isn't available.");

  await prisma.$transaction(async (tx) => {
    await cancelOrphanedContractsOnRoom(tx, newRoom.id, tenant.id);
    await tx.room.update({ where: { id: contract.roomId }, data: { status: "Available" } });
    await tx.room.update({ where: { id: newRoom.id }, data: { status: "Occupied" } });
    await tx.contract.update({
      where: { id: contract.id },
      data: {
        roomId: newRoom.id,
        hostelId: newRoom.hostelId,
        unitId: newRoom.unitId,
        ...(input.updateRent ? { rentAmount: newRoom.monthlyPrice } : {}),
      },
    });
    await tx.tenant.update({ where: { id: tenant.id }, data: { roomId: newRoom.id, hostelId: newRoom.hostelId } });
  });

  revalidatePath("/properties");
  revalidatePath("/tenants");
  revalidatePath("/dashboard");
}
