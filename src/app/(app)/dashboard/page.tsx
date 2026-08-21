import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, hostelScopeWhere, hostelUnitScopeWhere } from "@/lib/scope";
import { fmtMoney, fmtDate, obligationStatus, roomLabel, round2 } from "@/lib/utils";
import { Card, Badge, Alert, MetricPrimary, MetricSecondary, RingStat, TrendChart, EmptyState, Button } from "@/components/ui";
import DashboardFilters from "./DashboardFilters";

function dateRange(period: string, from?: string, to?: string) {
  const now = new Date();
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
  if (period === "today") return [startOfDay(now), endOfDay(now)];
  if (period === "week") { const s = new Date(now); s.setDate(s.getDate() - 6); return [startOfDay(s), endOfDay(now)]; }
  if (period === "custom" && from && to) return [startOfDay(new Date(from)), endOfDay(new Date(to))];
  const s = new Date(now.getFullYear(), now.getMonth(), 1);
  return [startOfDay(s), endOfDay(now)];
}

/* ============================== SECTIONS ============================== */
// Each section is a small pure function over pre-fetched data, composed twice below (once for
// the mobile priority order, once for the desktop structure) rather than trying to make one
// DOM order serve both — see the brief's mobile-first requirement.

function FinancialOverviewFull({ income, expenses, outstanding }: { income: number; expenses: number; outstanding: number }) {
  const net = income - expenses;
  return (
    <Card className="p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Financial Overview</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <MetricPrimary label="Net Result" value={fmtMoney(net)} tone={net >= 0 ? "good" : "bad"} />
        <MetricPrimary label="Outstanding" value={fmtMoney(outstanding)} tone={outstanding > 0 ? "warn" : "neutral"} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
        <MetricSecondary label="Income" value={fmtMoney(income)} />
        <MetricSecondary label="Expenses" value={fmtMoney(expenses)} />
      </div>
    </Card>
  );
}

function PaymentAlertSection({ count, total }: { count: number; total: number }) {
  if (count === 0) {
    return <Alert tone="good" title="All payments are up to date" />;
  }
  return (
    <Alert
      tone="bad"
      title={`${count} overdue payment${count > 1 ? "s" : ""}`}
      detail={`${fmtMoney(total)} outstanding`}
      action={
        <Link href="/payments"><Button variant="danger" size="sm">View overdue</Button></Link>
      }
    />
  );
}

function OccupancyModule({ occPct, occupied, total, available, maintenance }: { occPct: number; occupied: number; total: number; available: number; maintenance: number }) {
  return (
    <Card className="p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Occupancy</p>
      <RingStat percent={occPct} label="occupied" sub={`${occupied} / ${total} rooms`} />
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
        <MetricSecondary label="Available" value={String(available)} />
        <MetricSecondary label="Maintenance" value={String(maintenance)} />
      </div>
    </Card>
  );
}

function RevenuePotentialModule({ potential, occupied, opportunity, captureRate }: { potential: number; occupied: number; opportunity: number; captureRate: number }) {
  return (
    <Card className="p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Revenue Potential</p>
      <MetricPrimary label="Potential Monthly Income" value={fmtMoney(potential)} sub="If every room were rented" />
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.min(100, captureRate)}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <MetricSecondary label="Occupied" value={fmtMoney(occupied)} />
        <MetricSecondary label="Opportunity" value={fmtMoney(opportunity)} />
        <MetricSecondary label="Capture" value={`${captureRate}%`} />
      </div>
    </Card>
  );
}

type ObligationRow = { id: string; tenantId: string; roomId: string; tenantName: string; roomText: string; hostelName: string; dueDate: Date; amount: number; paidAmount: number; status: string };

function OutstandingPayments({ rows }: { rows: ObligationRow[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Outstanding Payments</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Everyone is up to date." detail="No outstanding rent right now." />
      ) : (
        <div>
          <div className="hidden border-b border-slate-100 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.7fr_auto]">
            <span>Tenant</span><span>Room</span><span>Due</span><span className="text-right">Amount</span><span>Status</span><span></span>
          </div>
          <ul className="divide-y divide-slate-100">
            {rows.slice(0, 8).map((r) => (
              <li key={r.id} className="flex flex-col gap-1 px-4 py-3 sm:grid sm:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.7fr_auto] sm:items-center sm:gap-0">
                <div>
                  <Link href={`/tenants/${r.tenantId}`} className="text-sm font-medium text-slate-900 hover:underline">{r.tenantName}</Link>
                  <p className="text-xs text-slate-400 sm:hidden">{r.hostelName} · {r.roomText} · due {fmtDate(r.dueDate)}</p>
                </div>
                <p className="hidden text-sm text-slate-500 sm:block"><Link href={`/rooms/${r.roomId}`} className="hover:underline">{r.hostelName} · {r.roomText}</Link></p>
                <p className="hidden text-sm text-slate-500 sm:block">{fmtDate(r.dueDate)}</p>
                <p className="text-right font-mono text-sm text-slate-900 sm:text-sm">{fmtMoney(round2(r.amount - r.paidAmount))}</p>
                <div><Badge status={r.status} /></div>
                <Link href="/payments" className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline sm:justify-self-end">View</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function TenantOverview({ active, newCount, checkOuts, expiring }: { active: number; newCount: number; checkOuts: number; expiring: number }) {
  return (
    <Card className="p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Tenants</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricSecondary label="Active" value={String(active)} />
        <MetricSecondary label="New (period)" value={String(newCount)} />
        <MetricSecondary label="Check-outs" value={String(checkOuts)} />
        <MetricSecondary label="Expiring ≤30d" value={String(expiring)} />
      </div>
    </Card>
  );
}

function TrendSection({ data }: { data: { label: string; income: number; expense: number }[] }) {
  return (
    <Card className="p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Income vs Expenses — last 6 months</p>
      <TrendChart data={data} />
    </Card>
  );
}

/* ============================== PAGE ============================== */

export default async function DashboardPage({ searchParams }: { searchParams: { period?: string; hostel?: string; from?: string; to?: string } }) {
  const user = await requireUser();
  const accessibleHostels = await prisma.hostel.findMany({ where: hostelScopeWhere(user), orderBy: { name: "asc" } });

  const period = searchParams.period || "month";
  const requestedHostel = searchParams.hostel || "all";
  const selectedHostelId = requestedHostel !== "all" && accessibleHostels.some((h) => h.id === requestedHostel) ? requestedHostel : "all";
  const [rangeStart, rangeEnd] = dateRange(period, searchParams.from, searchParams.to);

  const roomWhere: Record<string, unknown> = selectedHostelId !== "all"
    ? { hostelId: selectedHostelId, ...(user.unitIds.length ? { unitId: { in: user.unitIds } } : {}) }
    : hostelUnitScopeWhere(user);

  const rooms = await prisma.room.findMany({ where: roomWhere });
  const occupied = rooms.filter((r) => r.status === "Occupied").length;
  const available = rooms.filter((r) => r.status === "Available").length;
  const maintenance = rooms.filter((r) => r.status === "Maintenance").length;
  const occPct = rooms.length ? Math.round((occupied / rooms.length) * 100) : 0;

  const potentialMonthly = rooms.reduce((s, r) => s + r.monthlyPrice, 0);
  const occupiedMonthly = rooms.filter((r) => r.status === "Occupied").reduce((s, r) => s + r.monthlyPrice, 0);
  const availableMonthly = rooms.filter((r) => r.status === "Available").reduce((s, r) => s + r.monthlyPrice, 0);
  const captureRate = potentialMonthly ? Math.round((occupiedMonthly / potentialMonthly) * 100) : 0;

  const incomeExpenseWhere: Record<string, unknown> = selectedHostelId !== "all"
    ? { hostelId: selectedHostelId, ...(user.unitIds.length ? { OR: [{ unitId: { in: user.unitIds } }, { unitId: null }] } : {}) }
    : hostelUnitScopeWhere(user);

  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.income.aggregate({ where: { ...incomeExpenseWhere, date: { gte: rangeStart, lte: rangeEnd } }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { ...incomeExpenseWhere, date: { gte: rangeStart, lte: rangeEnd } }, _sum: { amount: true } }),
  ]);
  const totalIncome = incomeAgg._sum.amount ?? 0;
  const totalExpenses = expenseAgg._sum.amount ?? 0;

  const obligationWhere: Record<string, unknown> = {};
  if (selectedHostelId !== "all") obligationWhere.hostelId = selectedHostelId;
  else if (user.hostelIds.length) obligationWhere.hostelId = { in: user.hostelIds };
  if (user.unitIds.length) obligationWhere.room = { unitId: { in: user.unitIds } };

  const obligations = await prisma.rentObligation.findMany({
    where: obligationWhere,
    include: { tenant: true, room: { include: { unit: true } }, hostel: true },
    orderBy: { dueDate: "asc" },
  });
  const today = new Date();
  const withStatus = obligations.map((o) => ({
    id: o.id,
    tenantId: o.tenantId,
    roomId: o.roomId,
    tenantName: o.tenant.fullName,
    roomText: roomLabel(o.room),
    hostelName: o.hostel.name,
    dueDate: o.dueDate,
    amount: o.amount,
    paidAmount: o.paidAmount,
    status: obligationStatus({ amount: o.amount, paidAmount: o.paidAmount, dueDate: o.dueDate }, today),
  }));
  const overdueList = withStatus.filter((o) => o.status === "Overdue");
  const outstanding = withStatus.reduce((s, o) => s + Math.max(0, round2(o.amount - o.paidAmount)), 0);
  const overdueTotal = overdueList.reduce((s, o) => s + round2(o.amount - o.paidAmount), 0);
  const outstandingRows = withStatus.filter((o) => o.status !== "Paid").sort((a, b) => (a.status === "Overdue" ? -1 : b.status === "Overdue" ? 1 : 0));

  const contractWhere: Record<string, unknown> = selectedHostelId !== "all"
    ? { hostelId: selectedHostelId, ...(user.unitIds.length ? { unitId: { in: user.unitIds } } : {}) }
    : hostelUnitScopeWhere(user);
  const contracts = await prisma.contract.findMany({ where: contractWhere });
  const activeTenants = contracts.filter((c) => c.status === "Active" && c.checkInDate && !c.checkOutDate).length;
  const newCount = contracts.filter((c) => c.checkInDate && c.checkInDate >= rangeStart && c.checkInDate <= rangeEnd).length;
  const checkOutsCount = contracts.filter((c) => c.checkOutDate && c.checkOutDate >= rangeStart && c.checkOutDate <= rangeEnd).length;
  const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
  const expiring = contracts.filter((c) => c.status === "Active" && c.endDate && c.endDate >= today && c.endDate <= in30).length;

  // Last 6 months trend, independent of the period filter — a single-period bar pair doesn't
  // show a trend, so this always looks back 6 months regardless of the selector above.
  const trendData: { label: string; income: number; expense: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const mStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const mEnd = i === 0 ? today : new Date(today.getFullYear(), today.getMonth() - i + 1, 0, 23, 59, 59);
    const [inc, exp] = await Promise.all([
      prisma.income.aggregate({ where: { ...incomeExpenseWhere, date: { gte: mStart, lte: mEnd } }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { ...incomeExpenseWhere, date: { gte: mStart, lte: mEnd } }, _sum: { amount: true } }),
    ]);
    trendData.push({ label: mStart.toLocaleDateString("en-GB", { month: "short" }), income: inc._sum.amount ?? 0, expense: exp._sum.amount ?? 0 });
  }

  const financial = <FinancialOverviewFull income={totalIncome} expenses={totalExpenses} outstanding={outstanding} />;
  const alert = <PaymentAlertSection count={overdueList.length} total={overdueTotal} />;
  const occupancy = <OccupancyModule occPct={occPct} occupied={occupied} total={rooms.length} available={available} maintenance={maintenance} />;
  const revenue = <RevenuePotentialModule potential={potentialMonthly} occupied={occupiedMonthly} opportunity={availableMonthly} captureRate={captureRate} />;
  const outstandingTable = <OutstandingPayments rows={outstandingRows} />;
  const trend = <TrendSection data={trendData} />;
  const tenantOverview = <TenantOverview active={activeTenants} newCount={newCount} checkOuts={checkOutsCount} expiring={expiring} />;

  return (
    <div>
      {/* Header — compact, filters live here */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
        <DashboardFilters hostels={accessibleHostels} />
      </div>

      {/* Mobile: strict priority order per the brief. Desktop: separate structure below. */}
      <div className="flex flex-col gap-4 lg:hidden">
        {alert}
        {financial}
        {occupancy}
        {outstandingTable}
        {revenue}
        {trend}
        {tenantOverview}
      </div>

      <div className="hidden lg:flex lg:flex-col lg:gap-4">
        {financial}
        {alert}
        <div className="grid grid-cols-2 gap-4">
          {occupancy}
          {revenue}
        </div>
        {trend}
        {outstandingTable}
        {tenantOverview}
      </div>
    </div>
  );
}
