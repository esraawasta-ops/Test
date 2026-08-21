import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function addMonths(d: Date, n: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

async function main() {
  console.log("Seeding...");

  const marina = await prisma.hostel.create({
    data: {
      name: "Marina Hostel",
      code: "MAR",
      address: "Dubai Marina, Dubai",
      phone: "+971 4 123 4567",
      email: "marina@hostels.ae",
      currency: "AED",
      vatEnabled: true,
      vatPercent: 5,
    },
  });
  const deira = await prisma.hostel.create({
    data: {
      name: "Deira Hostel",
      code: "DEI",
      address: "Deira, Dubai",
      phone: "+971 4 765 4321",
      email: "deira@hostels.ae",
      currency: "AED",
      vatEnabled: true,
      vatPercent: 5,
    },
  });

  const building1 = await prisma.unit.create({ data: { hostelId: marina.id, name: "Building 1", type: "Apartment" } });
  const building2 = await prisma.unit.create({ data: { hostelId: marina.id, name: "Building 2", type: "Apartment" } });
  const annex = await prisma.unit.create({ data: { hostelId: marina.id, name: "Annex", type: "Studio" } });
  const mainHouse = await prisma.unit.create({ data: { hostelId: deira.id, name: "Main House", type: "Villa" } });
  const eastWing = await prisma.unit.create({ data: { hostelId: deira.id, name: "East Wing", type: "Apartment" } });

  const roomDefs: [string, string, string, number, number, number, number, number][] = [
    [building1.id, "101", "Single", 1, 120, 700, 2200, 2200],
    [building1.id, "102", "Shared", 2, 80, 480, 1500, 1500],
    [building1.id, "103", "Suite", 2, 220, 1300, 4200, 4200],
    [building1.id, "104", "Single", 1, 120, 700, 2200, 2200],
    [building2.id, "201", "Single", 1, 110, 650, 2000, 2000],
    [building2.id, "202", "Shared", 3, 75, 450, 1400, 1400],
    [annex.id, "A1", "Studio", 2, 210, 1250, 4000, 4000],
    [annex.id, "A2", "Studio", 2, 210, 1250, 4000, 4000],
    [mainHouse.id, "V1", "Single", 1, 90, 550, 1700, 1700],
    [mainHouse.id, "V2", "Shared", 2, 60, 380, 1200, 1200],
    [eastWing.id, "E1", "Single", 1, 85, 520, 1600, 1600],
    [eastWing.id, "E2", "Shared", 2, 58, 360, 1150, 1150],
  ];

  const roomIdByUnitName: Record<string, { id: string; hostelId: string; unitId: string; monthlyPrice: number; deposit: number }> = {};
  for (const [unitId, name, type, capacity, dailyPrice, weeklyPrice, monthlyPrice, deposit] of roomDefs) {
    const unit = [building1, building2, annex, mainHouse, eastWing].find((u) => u.id === unitId)!;
    const room = await prisma.room.create({
      data: { hostelId: unit.hostelId, unitId, name, type, capacity, dailyPrice, weeklyPrice, monthlyPrice, deposit, depositRequired: true, status: "Available" },
    });
    roomIdByUnitName[name] = { id: room.id, hostelId: room.hostelId, unitId: room.unitId, monthlyPrice, deposit };
  }

  const tenantDefs = [
    ["Amara Okafor", "+971 50 111 2222", "amara.o@example.com", "Nigerian"],
    ["Rohan Mehta", "+971 50 222 3333", "rohan.m@example.com", "Indian"],
    ["Elena Petrova", "+971 50 333 4444", "elena.p@example.com", "Russian"],
    ["Youssef Haddad", "+971 50 444 5555", "youssef.h@example.com", "Lebanese"],
  ];
  const tenants = [];
  for (const [fullName, phone, email, nationality] of tenantDefs) {
    tenants.push(await prisma.tenant.create({ data: { fullName, phone, email, nationality, status: "Inactive" } }));
  }

  // Give the first two tenants an active, checked-in contract in Room 101 and Room 103.
  const today = new Date();
  async function checkInTenant(tenant: (typeof tenants)[number], roomName: string, months: number) {
    const room = roomIdByUnitName[roomName];
    const start = addMonths(today, -1);
    const contract = await prisma.contract.create({
      data: {
        tenantId: tenant.id,
        hostelId: room.hostelId,
        unitId: room.unitId,
        roomId: room.id,
        startDate: start,
        endDate: addMonths(start, months),
        billingFrequency: "Monthly",
        rentAmount: room.monthlyPrice,
        deposit: room.deposit,
        status: "Active",
        checkInDate: start,
      },
    });
    if (room.deposit > 0) {
      await prisma.deposit.create({
        data: { tenantId: tenant.id, contractId: contract.id, hostelId: room.hostelId, roomId: room.id, amount: room.deposit, date: start, status: "Held" },
      });
    }
    await prisma.rentObligation.create({
      data: { contractId: contract.id, tenantId: tenant.id, hostelId: room.hostelId, roomId: room.id, dueDate: start, amount: room.monthlyPrice, paidAmount: room.monthlyPrice },
    });
    await prisma.rentObligation.create({
      data: { contractId: contract.id, tenantId: tenant.id, hostelId: room.hostelId, roomId: room.id, dueDate: addMonths(start, 1), amount: room.monthlyPrice, paidAmount: 0 },
    });
    await prisma.room.update({ where: { id: room.id }, data: { status: "Occupied" } });
    await prisma.tenant.update({ where: { id: tenant.id }, data: { status: "Active", roomId: room.id, hostelId: room.hostelId } });
  }
  await checkInTenant(tenants[0], "101", 12);
  await checkInTenant(tenants[1], "103", 6);

  await prisma.expense.create({ data: { date: addDays(today, -3), hostelId: marina.id, category: "Electricity", amount: 640, method: "Bank Transfer", vendor: "DEWA" } });
  await prisma.expense.create({ data: { date: addDays(today, -8), hostelId: deira.id, category: "Maintenance", amount: 310, method: "Cash", vendor: "Al Noor Fix-It" } });

  // Users
  async function makeUser(name: string, username: string, password: string, role: "ADMIN" | "MANAGER" | "RECEPTION", hostelIds: string[] = [], unitIds: string[] = []) {
    const passwordHash = await bcrypt.hash(password, 12);
    return prisma.user.create({ data: { name, username, passwordHash, role, hostelIds, unitIds } });
  }

  await makeUser("Admin", "admin", "admin123", "ADMIN");
  await makeUser("Property Manager", "manager", "manager123", "MANAGER");
  await makeUser("Marina Reception", "marina.reception", "marina123", "RECEPTION", [marina.id]);
  await makeUser("Building 1 Reception", "b1.reception", "flat123", "RECEPTION", [marina.id], [building1.id]);

  console.log("Seed complete.");
  console.log("Login with: admin / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
