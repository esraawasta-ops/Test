"use client";

import { useState, useTransition } from "react";
import { createHostel } from "@/actions/hostels";
import { createUnit } from "@/actions/units";
import { createRoom, assignTenantToRoom, moveTenantToRoom } from "@/actions/rooms";
import { fmtMoney } from "@/lib/utils";
import { Card, Badge, Button, Input, Select, Field, EmptyState } from "@/components/ui";

type Hostel = { id: string; name: string; code: string; address: string | null; active: boolean };
type Unit = { id: string; hostelId: string; name: string; type: string };
type Room = { id: string; hostelId: string; unitId: string; name: string; type: string; capacity: number; monthlyPrice: number; deposit: number; status: string };
type Tenant = { id: string; fullName: string; roomId: string | null };

export default function PropertiesTree({
  user,
  hostels,
  units,
  rooms,
  tenants,
}: {
  user: { role: string; hostelIds: string[] };
  hostels: Hostel[];
  units: Unit[];
  rooms: Room[];
  tenants: Tenant[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [openHostelForm, setOpenHostelForm] = useState(false);
  const [openUnitForm, setOpenUnitForm] = useState<string | null>(null); // hostelId
  const [openRoomForm, setOpenRoomForm] = useState<string | null>(null); // unitId
  const [assignRoom, setAssignRoom] = useState<Room | null>(null);
  const [moveTenant, setMoveTenant] = useState<{ tenantId: string; name: string } | null>(null);

  const canAddHostel = user.role !== "RECEPTION" && user.hostelIds.length === 0;
  const canManage = user.role !== "RECEPTION";

  const run = (fn: () => Promise<void>) => {
    setError("");
    startTransition(async () => {
      try {
        await fn();
      } catch (e: any) {
        setError(e?.message || "Something went wrong.");
      }
    });
  };

  const occupantOf = (roomId: string) => tenants.find((t) => t.roomId === roomId);
  const availableRoomsForAssign = rooms.filter((r) => r.status === "Available");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Properties</h1>
          <p className="text-sm text-slate-500">Hostel → Unit → Room</p>
        </div>
        {canAddHostel && <Button onClick={() => setOpenHostelForm((v) => !v)}>+ Add Hostel</Button>}
      </div>

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

      {openHostelForm && (
        <NewHostelForm
          onCancel={() => setOpenHostelForm(false)}
          onSubmit={(data) => run(async () => { await createHostel(data); setOpenHostelForm(false); })}
        />
      )}

      <div className="space-y-3">
        {hostels.map((hostel) => {
          const hostelUnits = units.filter((u) => u.hostelId === hostel.id);
          return (
            <Card key={hostel.id}>
              <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                <span className="font-semibold text-slate-900">{hostel.name}</span>
                <span className="text-xs text-slate-400">{hostel.code}</span>
                <span className="text-xs text-slate-400">
                  {hostelUnits.length} unit{hostelUnits.length !== 1 ? "s" : ""} · {rooms.filter((r) => r.hostelId === hostel.id).length} rooms
                </span>
                {canManage && (
                  <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setOpenUnitForm(openUnitForm === hostel.id ? null : hostel.id)}>
                    + Unit
                  </Button>
                )}
              </div>

              {openUnitForm === hostel.id && (
                <div className="border-t border-slate-100 px-4 py-3">
                  <NewUnitForm
                    onCancel={() => setOpenUnitForm(null)}
                    onSubmit={(data) => run(async () => { await createUnit({ ...data, hostelId: hostel.id }); setOpenUnitForm(null); })}
                  />
                </div>
              )}

              <div className="space-y-1 border-t border-slate-100 pb-2 pl-6 pr-3 pt-2 sm:pl-8">
                {hostelUnits.length === 0 && <p className="py-2 text-sm text-slate-400">No units yet.</p>}
                {hostelUnits.map((unit) => {
                  const unitRooms = rooms.filter((r) => r.unitId === unit.id);
                  return (
                    <div key={unit.id} className="border-l border-slate-200 pl-3">
                      <div className="flex flex-wrap items-center gap-2 py-2">
                        <span className="text-sm font-medium text-slate-800">{unit.name}</span>
                        <span className="text-xs text-slate-400">{unit.type}</span>
                        <span className="text-xs text-slate-400">{unitRooms.length} room{unitRooms.length !== 1 ? "s" : ""}</span>
                        {canManage && (
                          <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setOpenRoomForm(openRoomForm === unit.id ? null : unit.id)}>
                            + Room
                          </Button>
                        )}
                      </div>

                      {openRoomForm === unit.id && (
                        <div className="pb-2">
                          <NewRoomForm
                            onCancel={() => setOpenRoomForm(null)}
                            onSubmit={(data) => run(async () => { await createRoom({ ...data, unitId: unit.id }); setOpenRoomForm(null); })}
                          />
                        </div>
                      )}

                      <div className="space-y-1 border-l border-slate-100 pb-2 pl-6">
                        {unitRooms.length === 0 && <p className="py-1 text-xs text-slate-400">No rooms yet.</p>}
                        {unitRooms.map((room) => {
                          const occupant = occupantOf(room.id);
                          return (
                            <div key={room.id} className="flex flex-wrap items-center gap-2 rounded-lg py-1.5 text-sm hover:bg-slate-50 sm:gap-3">
                              <span className="font-medium text-slate-800">{room.name}</span>
                              <span className="text-xs text-slate-400">{room.type} · cap {room.capacity}</span>
                              <span className="font-mono text-xs text-slate-600">{fmtMoney(room.monthlyPrice)}</span>
                              <Badge status={room.status} />
                              {occupant && <span className="text-xs text-slate-500">— {occupant.fullName}</span>}
                              <div className="ml-auto flex items-center gap-2">
                                {room.status === "Available" && (
                                  <Button size="sm" onClick={() => setAssignRoom(room)}>Assign</Button>
                                )}
                                {room.status === "Occupied" && occupant && (
                                  <Button size="sm" variant="secondary" onClick={() => setMoveTenant({ tenantId: occupant.id, name: occupant.fullName })}>Move</Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
        {hostels.length === 0 && <Card><EmptyState title="No hostels in your access scope" /></Card>}
      </div>

      {assignRoom && (
        <AssignModal
          room={assignRoom}
          units={units}
          pending={pending}
          onCancel={() => setAssignRoom(null)}
          onSubmit={(data) =>
            run(async () => {
              await assignTenantToRoom({ ...data, roomId: assignRoom.id });
              setAssignRoom(null);
            })
          }
        />
      )}

      {moveTenant && (
        <MoveModal
          tenantName={moveTenant.name}
          rooms={availableRoomsForAssign}
          units={units}
          pending={pending}
          onCancel={() => setMoveTenant(null)}
          onSubmit={(roomId, updateRent) =>
            run(async () => {
              await moveTenantToRoom({ tenantId: moveTenant.tenantId, newRoomId: roomId, updateRent });
              setMoveTenant(null);
            })
          }
        />
      )}
    </div>
  );
}

function NewHostelForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (d: any) => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  return (
    <Card className="mb-4 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <Input placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={() => onSubmit({ name, code, address })}>Save</Button>
      </div>
    </Card>
  );
}

function NewUnitForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (d: any) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("Apartment");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input placeholder="Unit name (e.g. 1306)" value={name} onChange={(e) => setName(e.target.value)} className="max-w-[220px]" />
      <Select value={type} onChange={(e) => setType(e.target.value)} className="max-w-[160px]">
        <option>Apartment</option><option>Studio</option><option>Villa</option><option>Other</option>
      </Select>
      <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
      <Button size="sm" onClick={() => onSubmit({ name, type })}>Save Unit</Button>
    </div>
  );
}

function NewRoomForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (d: any) => void }) {
  const [name, setName] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [capacity, setCapacity] = useState(1);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input placeholder="Room name (e.g. 101)" value={name} onChange={(e) => setName(e.target.value)} className="w-32" />
      <Input type="number" placeholder="Capacity" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="w-24" />
      <Input type="number" placeholder="Monthly price" value={monthlyPrice} onChange={(e) => setMonthlyPrice(Number(e.target.value))} className="w-32" />
      <Input type="number" placeholder="Deposit" value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} className="w-28" />
      <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
      <Button size="sm" onClick={() => onSubmit({ name, monthlyPrice, deposit, capacity })}>Save Room</Button>
    </div>
  );
}

function AssignModal({ room, units, pending, onCancel, onSubmit }: { room: Room; units: Unit[]; pending: boolean; onCancel: () => void; onSubmit: (d: any) => void }) {
  const [tenantId, setTenantId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [months, setMonths] = useState(12);
  const [rentAmount, setRentAmount] = useState(room.monthlyPrice);
  const [deposit, setDeposit] = useState(room.deposit);
  const label = units.find((u) => u.id === room.unitId)?.name ? `${units.find((u) => u.id === room.unitId)!.name}-${room.name}` : room.name;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-16">
      <Card className="w-full max-w-md p-5 shadow-xl">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Assign Tenant — {label}</h3>
        <p className="mb-2 text-xs text-slate-500">
          Enter the tenant ID to assign (in a full UI this would be a searchable picker of unassigned tenants).
        </p>
        <div className="space-y-2">
          <Field label="Tenant ID"><Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} /></Field>
          <Field label="Start Date"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Months"><Input type="number" value={months} onChange={(e) => setMonths(Number(e.target.value))} /></Field>
            <Field label="Rent"><Input type="number" value={rentAmount} onChange={(e) => setRentAmount(Number(e.target.value))} /></Field>
            <Field label="Deposit"><Input type="number" value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} /></Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" disabled={pending || !tenantId} onClick={() => onSubmit({ tenantId, startDate, months, rentAmount, deposit })}>
            {pending ? "Saving…" : "Assign & Check In"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function MoveModal({ tenantName, rooms, units, pending, onCancel, onSubmit }: { tenantName: string; rooms: Room[]; units: Unit[]; pending: boolean; onCancel: () => void; onSubmit: (roomId: string, updateRent: boolean) => void }) {
  const [roomId, setRoomId] = useState(rooms[0]?.id || "");
  const [updateRent, setUpdateRent] = useState(true);
  const labelFor = (r: Room) => { const u = units.find((x) => x.id === r.unitId); return u ? `${u.name}-${r.name}` : r.name; };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-16">
      <Card className="w-full max-w-md p-5 shadow-xl">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Move Room — {tenantName}</h3>
        <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          {rooms.length === 0 && <option value="">No available rooms</option>}
          {rooms.map((r) => <option key={r.id} value={r.id}>{labelFor(r)} ({fmtMoney(r.monthlyPrice)})</option>)}
        </Select>
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={updateRent} onChange={(e) => setUpdateRent(e.target.checked)} /> Update rent to new room's price
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" disabled={pending || !roomId} onClick={() => onSubmit(roomId, updateRent)}>
            {pending ? "Saving…" : "Move Tenant"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
