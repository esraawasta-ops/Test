"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserOrThrow, assertAccess } from "@/lib/scope";
import { generateObligationDates, round2 } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

/** Re-derives a tenant's roomId/status from their contracts (mirrors the client-side sync). */
async function syncTenantRoom(tx: Prisma.TransactionClient, tenantId: string, excludeContractId?: string) {
  const current = await tx.contract.findFirst({
    where: { tenantId, id: excludeContractId ? { not: excludeContractId } : undefined, checkInDate: { not: null }, checkOutDate: null, status: "Active" },
  });
  await tx.tenant.update({
    where: { id: tenantId },
    data: { roomId: current?.roomId ?? null, hostelId: current?.hostelId ?? null, status: current ? "Active" : "Inactive" },
  });
}

export async function createContract(data: {
  tenantId: string;
  roomId: string;
  startDate: string;
  endDate?: string;
  billingFrequency: string;
  rentAmount: number;
  deposit: number;
  vat?: number;
  discount?: number;
  lateFeeType?: string;
  lateFeeValue?: number;
  dueDay?: number;
  notes?: string;
}) {
  const user = await requireUserOrThrow();
  const room = await prisma.room.findUniqueOrThrow({ where: { id: data.roomId } });
  assertAccess(user, room.hostelId, room.unitId);

  await prisma.contract.create({
    data: {
      tenantId: data.tenantId,
      hostelId: room.hostelId,
      unitId: room.unitId,
      roomId: room.id,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      billingFrequency: data.billingFrequency,
      rentAmount: data.rentAmount,
      deposit: data.deposit,
      vat: data.vat ?? 5,
      discount: data.discount ?? 0,
      lateFeeType: data.lateFeeType ?? "Fixed",
      lateFeeValue: data.lateFeeValue ?? 0,
      dueDay: data.dueDay ?? 1,
      status: "Active",
      notes: data.notes,
      // checkInDate stays null — the tenant only becomes Active once checked in.
    },
  });

  revalidatePath("/contracts");
  revalidatePath("/checkin");
}

export async function checkInContract(contractId: string, checkInDate: string) {
  const user = await requireUserOrThrow();
  const contract = await prisma.contract.findUniqueOrThrow({ where: { id: contractId } });
  assertAccess(user, contract.hostelId, contract.unitId);

  const start = new Date(checkInDate);

  await prisma.$transaction(async (tx) => {
    await tx.contract.update({ where: { id: contractId }, data: { checkInDate: start } });
    await tx.room.update({ where: { id: contract.roomId }, data: { status: "Occupied" } });
    await tx.tenant.update({ where: { id: contract.tenantId }, data: { status: "Active", roomId: contract.roomId, hostelId: contract.hostelId } });

    const existing = await tx.rentObligation.count({ where: { contractId } });
    if (existing === 0) {
      const dates = generateObligationDates(start, contract.endDate, contract.billingFrequency);
      await tx.rentObligation.createMany({
        data: dates.map((dueDate) => ({ contractId, tenantId: contract.tenantId, hostelId: contract.hostelId, roomId: contract.roomId, dueDate, amount: contract.rentAmount })),
      });
    }
  });

  revalidatePath("/checkin");
  revalidatePath("/contracts");
  revalidatePath("/tenants");
  revalidatePath("/dashboard");
}

export async function checkOutContract(input: { contractId: string; checkOutDate: string; deductions: number; notes?: string }) {
  const user = await requireUserOrThrow();
  const contract = await prisma.contract.findUniqueOrThrow({ where: { id: input.contractId } });
  assertAccess(user, contract.hostelId, contract.unitId);

  const checkoutDate = new Date(input.checkOutDate);

  await prisma.$transaction(async (tx) => {
    await tx.contract.update({
      where: { id: contract.id },
      data: { checkOutDate: checkoutDate, status: "Terminated", endReason: "Checked out", notes: input.notes ? `${contract.notes ?? ""} | ${input.notes}`.trim() : contract.notes },
    });
    await tx.room.update({ where: { id: contract.roomId }, data: { status: "Available" } });
    await syncTenantRoom(tx, contract.tenantId, contract.id);

    const deposit = await tx.deposit.findUnique({ where: { contractId: contract.id } });
    if (deposit) {
      const ded = Math.min(Math.max(0, input.deductions), deposit.amount);
      const refund = round2(deposit.amount - ded);
      await tx.deposit.update({
        where: { id: deposit.id },
        data: {
          deductions: ded,
          refundAmount: refund,
          refundDate: checkoutDate,
          status: ded >= deposit.amount ? "Deducted" : ded > 0 ? "Partially Refunded" : "Refunded",
        },
      });
      if (ded > 0) {
        await tx.income.create({
          data: {
            date: checkoutDate,
            hostelId: contract.hostelId,
            unitId: contract.unitId,
            roomId: contract.roomId,
            tenantId: contract.tenantId,
            category: "Deposit",
            amount: ded,
            method: "Cash",
            description: "Deposit deduction at checkout",
          },
        });
      }
    }
  });

  revalidatePath("/checkout");
  revalidatePath("/contracts");
  revalidatePath("/tenants");
  revalidatePath("/deposits");
  revalidatePath("/income");
  revalidatePath("/dashboard");
}

/** Directly terminates a contract without the full checkout/deposit flow — also frees the room. */
export async function terminateContract(contractId: string) {
  const user = await requireUserOrThrow();
  const contract = await prisma.contract.findUniqueOrThrow({ where: { id: contractId } });
  assertAccess(user, contract.hostelId, contract.unitId);

  await prisma.$transaction(async (tx) => {
    await tx.contract.update({ where: { id: contractId }, data: { status: "Terminated", checkOutDate: new Date(), endReason: "Terminated manually" } });
    await tx.room.update({ where: { id: contract.roomId }, data: { status: "Available" } });
    if (contract.checkInDate) await syncTenantRoom(tx, contract.tenantId, contract.id);
  });

  revalidatePath("/contracts");
  revalidatePath("/properties");
  revalidatePath("/dashboard");
}
