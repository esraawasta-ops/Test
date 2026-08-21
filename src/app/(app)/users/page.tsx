import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/scope";
import { redirect } from "next/navigation";
import UsersClient from "./UsersClient";

export default async function UsersPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");

  const [users, hostels, units] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.hostel.findMany({ orderBy: { name: "asc" } }),
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
  ]);

  return <UsersClient currentUserId={user.id} users={users} hostels={hostels} units={units} />;
}
