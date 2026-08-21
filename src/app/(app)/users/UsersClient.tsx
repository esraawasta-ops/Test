"use client";

import { useState, useTransition } from "react";
import { createUser, updateUserAccess, resetUserPassword } from "@/actions/users";
import { Card, Button, Input, Select, EmptyState } from "@/components/ui";

type User = { id: string; name: string; username: string; role: string; hostelIds: string[]; unitIds: string[] };
type Hostel = { id: string; name: string };
type Unit = { id: string; hostelId: string; name: string };

export default function UsersClient({ currentUserId, users, hostels, units }: { currentUserId: string; users: User[]; hostels: Hostel[]; units: Unit[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [modal, setModal] = useState<{ mode: "new" | "edit"; id?: string } | null>(null);
  const [pwUser, setPwUser] = useState<User | null>(null);
  const empty = { name: "", username: "", role: "RECEPTION" as const, hostelIds: [] as string[], unitIds: [] as string[], password: "", confirm: "" };
  const [form, setForm] = useState(empty);

  const openNew = () => { setForm(empty); setModal({ mode: "new" }); };
  const openEdit = (u: User) => { setForm({ ...u, role: u.role as any, password: "", confirm: "" }); setModal({ mode: "edit", id: u.id }); };

  const toggleHostel = (id: string) => {
    setForm((f) => {
      const has = f.hostelIds.includes(id);
      const hostelIds = has ? f.hostelIds.filter((x) => x !== id) : [...f.hostelIds, id];
      return { ...f, hostelIds, unitIds: hostelIds.length === 1 ? f.unitIds : [] };
    });
  };
  const toggleUnit = (id: string) => {
    setForm((f) => ({ ...f, unitIds: f.unitIds.includes(id) ? f.unitIds.filter((x) => x !== id) : [...f.unitIds, id] }));
  };
  const scopeUnits = form.hostelIds.length === 1 ? units.filter((u) => u.hostelId === form.hostelIds[0]) : [];

  const save = () => {
    setError("");
    if (modal?.mode === "new" && form.password !== form.confirm) { setError("Passwords don't match."); return; }
    startTransition(async () => {
      try {
        if (modal?.mode === "new") {
          await createUser({ name: form.name, username: form.username, password: form.password, role: form.role, hostelIds: form.hostelIds, unitIds: form.unitIds });
        } else if (modal?.id) {
          await updateUserAccess(modal.id, { name: form.name, username: form.username, role: form.role, hostelIds: form.hostelIds, unitIds: form.unitIds });
        }
        setModal(null);
      } catch (e: any) {
        setError(e?.message || "Something went wrong.");
      }
    });
  };

  const scopeLabel = (u: User) => {
    if (!u.hostelIds.length) return "All hostels";
    const names = u.hostelIds.map((id) => hostels.find((h) => h.id === id)?.name).filter(Boolean);
    if (u.unitIds.length) {
      const unitNames = u.unitIds.map((id) => units.find((x) => x.id === id)?.name).filter(Boolean);
      return `${names.join(", ")} — ${unitNames.join(", ")}`;
    }
    return names.join(", ");
  };

  const pill = (active: boolean) => `rounded-lg px-2.5 py-1.5 text-xs font-medium ${active ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-600"}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500">{users.length} account{users.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openNew}>+ Add User</Button>
      </div>

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

      <Card className="overflow-hidden">
        {users.length === 0 ? (
          <EmptyState title="No user accounts yet" />
        ) : (
          <div>
            <div className="hidden border-b border-slate-100 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[1.1fr_1fr_0.7fr_1.4fr_auto]">
              <span>Name</span><span>Username</span><span>Role</span><span>Access Scope</span><span></span>
            </div>
            <ul className="divide-y divide-slate-100">
              {users.map((u) => (
                <li key={u.id} className="flex flex-col gap-1 px-4 py-3 hover:bg-slate-50 sm:grid sm:grid-cols-[1.1fr_1fr_0.7fr_1.4fr_auto] sm:items-center sm:gap-0">
                  <p className="text-sm font-medium text-slate-900">{u.name}{u.id === currentUserId && <span className="ml-1.5 text-xs text-slate-400">(you)</span>}</p>
                  <p className="text-sm text-slate-500">{u.username}</p>
                  <p className="text-sm text-slate-700">{u.role}</p>
                  <p className="text-sm text-slate-500">{scopeLabel(u)}</p>
                  <div className="flex gap-3">
                    <button onClick={() => openEdit(u)} className="text-xs font-medium text-slate-600 hover:underline">Edit</button>
                    <button onClick={() => setPwUser(u)} className="text-xs font-medium text-slate-600 hover:underline">Reset Password</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-10">
          <Card className="w-full max-w-xl p-5 shadow-xl">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">{modal.mode === "new" ? "Add User" : "Edit User"}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as any })}>
                <option value="ADMIN">Admin</option><option value="MANAGER">Manager</option><option value="RECEPTION">Reception</option>
              </Select>
              {modal.mode === "new" && (
                <>
                  <Input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  <Input type="password" placeholder="Confirm Password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
                </>
              )}
            </div>

            <p className="mb-1.5 mt-4 text-xs font-medium text-slate-600">Hostel Access</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setForm({ ...form, hostelIds: [], unitIds: [] })} className={pill(form.hostelIds.length === 0)}>All Hostels</button>
              {hostels.map((h) => (
                <button key={h.id} onClick={() => toggleHostel(h.id)} className={pill(form.hostelIds.includes(h.id))}>{h.name}</button>
              ))}
            </div>

            {form.hostelIds.length === 1 && (
              <>
                <p className="mb-1.5 mt-3 text-xs font-medium text-slate-600">Unit Access</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setForm({ ...form, unitIds: [] })} className={pill(form.unitIds.length === 0)}>All Units</button>
                  {scopeUnits.map((u) => (
                    <button key={u.id} onClick={() => toggleUnit(u.id)} className={pill(form.unitIds.includes(u.id))}>{u.name}</button>
                  ))}
                </div>
              </>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setModal(null)}>Cancel</Button>
              <Button size="sm" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save User"}</Button>
            </div>
          </Card>
        </div>
      )}

      {pwUser && (
        <ResetPasswordModal
          user={pwUser}
          pending={pending}
          onCancel={() => setPwUser(null)}
          onSave={(pw) =>
            startTransition(async () => {
              try {
                await resetUserPassword(pwUser.id, pw);
                setPwUser(null);
              } catch (e: any) {
                setError(e?.message || "Something went wrong.");
              }
            })
          }
        />
      )}
    </div>
  );
}

function ResetPasswordModal({ user, pending, onCancel, onSave }: { user: User; pending: boolean; onCancel: () => void; onSave: (pw: string) => void }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-16">
      <Card className="w-full max-w-sm p-5 shadow-xl">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Reset Password — {user.name}</h3>
        <div className="space-y-2">
          <Input type="password" placeholder="New Password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Input type="password" placeholder="Confirm Password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" disabled={pending || pw.length < 8 || pw !== confirm} onClick={() => onSave(pw)}>
            {pending ? "Saving…" : "Reset Password"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
