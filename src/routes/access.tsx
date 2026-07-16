import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Users, Wrench, Headphones, Plus, Trash2, Save, X, Tag } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { accessQueryOptions } from "@/lib/aux/queries";
import { useAccess } from "@/hooks/use-access";
import { NAV_PAGES } from "@/lib/aux/nav";
import { toast } from "sonner";
import { SortableTh, useSort } from "@/components/ui/sortable-th";

export const Route = createFileRoute("/access")({
  loader: ({ context }) => context.queryClient.ensureQueryData(accessQueryOptions),
  head: () => ({
    meta: [
      { title: "Access Console — AUX ASC Dashboard" },
      { name: "description", content: "Admin console: manage users, roles and per-page permissions." },
    ],
  }),
  component: AccessPage,
});

const num = new Intl.NumberFormat("en-US");

type Draft = {
  email: string;
  asc: string;
  branch: string;
  role: string;
  pages: string[]; // paths or ["all"]
  admin: boolean;
  parts: string;
  callCenter: boolean;
  original?: string; // original email (for rename)
};

function emptyDraft(): Draft {
  return { email: "", asc: "", branch: "", role: "", pages: [], admin: false, parts: "", callCenter: false };
}

async function postWrite(body: unknown): Promise<{ ok: boolean; error?: string; detail?: string }> {
  const r = await fetch("/api/public/access-write", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

function AccessPage() {
  const { data } = useSuspenseQuery(accessQueryOptions);
  const { access, ready } = useAccess();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (ready && access && !access.isAdmin && !access.isAllAccess) {
      navigate({ to: "/" });
    }
  }, [ready, access, navigate]);

  const [editing, setEditing] = useState<Draft | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleDraft, setRoleDraft] = useState<{ name: string; pages: string[] }>({ name: "", pages: [] });
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const rolesMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of data.roles) m.set(r.name.toLowerCase(), r.pages);
    return m;
  }, [data.roles]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.users;
    return data.users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.asc.toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q),
    );
  }, [data.users, search]);

  const userSort = useSort(filteredUsers, {
    email: (u) => u.email,
    asc: (u) => u.asc,
    branch: (u) => u.branch,
    role: (u) => u.role,
    pages: (u) => u.pages.length,
    adminAccess: (u) => u.adminAccess,
    parts: (u) => u.parts,
    callCenter: (u) => u.callCenter,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["aux", "access"] });

  const startEdit = (email?: string) => {
    if (!email) return setEditing({ ...emptyDraft() });
    const u = data.users.find((x) => x.email === email);
    if (!u) return;
    setEditing({
      email: u.email,
      asc: u.asc === "—" ? "" : u.asc,
      branch: u.branch,
      role: u.role,
      pages: u.pages,
      admin: u.adminAccess.toLowerCase() === "yes",
      parts: u.parts,
      callCenter: u.callCenter.toLowerCase() === "yes",
      original: u.email,
    });
  };

  const applyRole = (roleName: string) => {
    if (!editing) return;
    const pages = rolesMap.get(roleName.toLowerCase());
    setEditing({ ...editing, role: roleName, pages: pages ? [...pages] : editing.pages });
  };

  const togglePage = (path: string) => {
    if (!editing) return;
    const has = editing.pages.includes(path);
    setEditing({
      ...editing,
      pages: has ? editing.pages.filter((p) => p !== path) : [...editing.pages, path],
    });
  };

  const saveUser = async () => {
    if (!editing || !access) return;
    if (!editing.email.trim()) return toast.error("Email required");
    setBusy(true);
    const r = await postWrite({
      actorEmail: access.email,
      action: "upsertUser",
      user: {
        email: editing.email.trim().toLowerCase(),
        asc: editing.asc,
        branch: editing.branch,
        role: editing.role,
        pages: editing.pages,
        admin: editing.admin,
        parts: editing.parts,
        callCenter: editing.callCenter,
      },
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.detail || r.error || "Save failed");
    toast.success("User saved");
    setEditing(null);
    refresh();
  };

  const deleteUser = async (email: string) => {
    if (!access) return;
    if (!confirm(`Delete access for ${email}?`)) return;
    setBusy(true);
    const r = await postWrite({
      actorEmail: access.email,
      action: "deleteUser",
      user: { email },
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.detail || r.error || "Delete failed");
    toast.success("User removed");
    refresh();
  };

  const saveRole = async () => {
    if (!access) return;
    if (!roleDraft.name.trim()) return toast.error("Role name required");
    setBusy(true);
    const r = await postWrite({
      actorEmail: access.email,
      action: "upsertRole",
      role: { name: roleDraft.name.trim(), pages: roleDraft.pages },
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.detail || r.error || "Save failed");
    toast.success("Role saved");
    setShowRoleModal(false);
    setRoleDraft({ name: "", pages: [] });
    refresh();
  };

  const deleteRole = async (name: string) => {
    if (!access) return;
    if (!confirm(`Delete role "${name}"?`)) return;
    setBusy(true);
    const r = await postWrite({ actorEmail: access.email, action: "deleteRole", role: { name, pages: [] } });
    setBusy(false);
    if (!r.ok) return toast.error(r.detail || r.error || "Delete failed");
    toast.success("Role removed");
    refresh();
  };

  return (
    <DashboardLayout
      title="Access Console"
      subtitle="Manage users, roles and per-page permissions"
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRoleModal(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <Tag className="h-3.5 w-3.5" /> New role
          </button>
          <button
            type="button"
            onClick={() => startEdit()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> New user
          </button>
        </div>
      }
    >
      {data.error ? (
        <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Sheet error: {data.error}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Users" value={num.format(data.total)} icon={Users} tone="primary" />
        <KpiCard label="Admins" value={num.format(data.admins)} icon={ShieldCheck} tone="accent" />
        <KpiCard label="Call Center" value={num.format(data.callCenter)} icon={Headphones} tone="success" />
        <KpiCard label="Parts Access" value={num.format(data.partsAccess)} icon={Wrench} tone="warning" />
      </section>

      {/* Roles strip */}
      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Roles ({data.roles.length})</h2>
          <p className="text-xs text-muted-foreground">Apply a role in the user editor to prefill pages.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.roles.length === 0 && (
            <span className="text-xs text-muted-foreground">No custom roles yet. Click "New role" to create one.</span>
          )}
          {data.roles.map((r) => (
            <span
              key={r.name}
              className="group inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs"
              title={r.pages.join(", ") || "all"}
            >
              <span className="font-medium">{r.name}</span>
              <span className="text-muted-foreground">· {r.pages.length || "all"} pages</span>
              <button
                type="button"
                onClick={() => deleteRole(r.name)}
                className="ml-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </section>

      {/* Users table */}
      <section className="mt-6 rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-3">
          <h2 className="text-sm font-semibold">Users</h2>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, ASC, role…"
            className="h-8 w-64 rounded-md border border-input bg-background px-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">ASC</th>
                <th className="p-2 text-left">Branch</th>
                <th className="p-2 text-left">Role</th>
                <th className="p-2 text-left">Pages</th>
                <th className="p-2 text-center">Admin</th>
                <th className="p-2 text-center">Parts</th>
                <th className="p-2 text-center">Call Center</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.email} className="border-t border-border hover:bg-muted/20">
                  <td className="p-2 font-mono text-xs">{u.email}</td>
                  <td className="p-2">{u.asc}</td>
                  <td className="p-2 text-muted-foreground">{u.branch || "—"}</td>
                  <td className="p-2">
                    {u.role ? (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                        {u.role}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2">
                    {u.pages.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground">all</span>
                    ) : (
                      <span className="text-[11px]">{u.pages.length} tagged</span>
                    )}
                  </td>
                  <td className="p-2 text-center">{yesNo(u.adminAccess)}</td>
                  <td className="p-2 text-center">{yesNo(u.parts)}</td>
                  <td className="p-2 text-center">{yesNo(u.callCenter)}</td>
                  <td className="p-2 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(u.email)}
                      className="mr-1 rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteUser(u.email)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-sm text-muted-foreground">
                    No users match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <UserEditor
          draft={editing}
          roles={data.roles}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={saveUser}
          onApplyRole={applyRole}
          onTogglePage={togglePage}
          busy={busy}
        />
      )}

      {showRoleModal && (
        <RoleEditor
          draft={roleDraft}
          onChange={setRoleDraft}
          onCancel={() => {
            setShowRoleModal(false);
            setRoleDraft({ name: "", pages: [] });
          }}
          onSave={saveRole}
          busy={busy}
        />
      )}
    </DashboardLayout>
  );
}

function yesNo(v: string) {
  const yes = v.trim().toLowerCase() === "yes";
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${yes ? "bg-success" : "bg-muted-foreground/30"}`}
      title={yes ? "Yes" : v || "No"}
    />
  );
}

function Modal({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card/95 px-5 py-3 backdrop-blur">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function UserEditor({
  draft,
  roles,
  onChange,
  onCancel,
  onSave,
  onApplyRole,
  onTogglePage,
  busy,
}: {
  draft: Draft;
  roles: { name: string; pages: string[] }[];
  onChange: (d: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
  onApplyRole: (name: string) => void;
  onTogglePage: (path: string) => void;
  busy: boolean;
}) {
  return (
    <Modal title={draft.original ? `Edit ${draft.original}` : "New user"} onClose={onCancel}>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <input
              type="email"
              value={draft.email}
              onChange={(e) => onChange({ ...draft, email: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary"
            />
          </Field>
          <Field label="Role">
            <div className="flex gap-2">
              <input
                type="text"
                value={draft.role}
                onChange={(e) => onChange({ ...draft, role: e.target.value })}
                placeholder="e.g. Manager"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary"
              />
              {roles.length > 0 && (
                <select
                  value=""
                  onChange={(e) => e.target.value && onApplyRole(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">Apply…</option>
                  {roles.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </Field>
          <Field label="ASC">
            <input
              type="text"
              value={draft.asc}
              onChange={(e) => onChange({ ...draft, asc: e.target.value })}
              placeholder="Company or All"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary"
            />
          </Field>
          <Field label="Branch">
            <input
              type="text"
              value={draft.branch}
              onChange={(e) => onChange({ ...draft, branch: e.target.value })}
              placeholder="Branch or Always CC"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary"
            />
          </Field>
          <Field label="Parts">
            <input
              type="text"
              value={draft.parts}
              onChange={(e) => onChange({ ...draft, parts: e.target.value })}
              placeholder="Yes / No / All"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary"
            />
          </Field>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.admin}
                onChange={(e) => onChange({ ...draft, admin: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              Admin
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.callCenter}
                onChange={(e) => onChange({ ...draft, callCenter: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              Call Center
            </label>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pages ({draft.pages.length === 0 ? "all" : draft.pages.length + " tagged"})
            </label>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => onChange({ ...draft, pages: NAV_PAGES.map((p) => p.path) })}
                className="text-primary hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...draft, pages: [] })}
                className="text-muted-foreground hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="grid max-h-64 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-border bg-muted/20 p-2">
            {NAV_PAGES.map((page) => {
              const checked = draft.pages.includes(page.path);
              return (
                <label
                  key={page.path}
                  className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent ${
                    checked ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onTogglePage(page.path)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  <span className="truncate">{page.label}</span>
                  {page.admin && <span className="ml-auto text-[9px] font-semibold uppercase text-accent">Admin</span>}
                </label>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Empty = show all pages (filtered by ASC/Branch as before). Any tag added → user sees only those pages.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RoleEditor({
  draft,
  onChange,
  onCancel,
  onSave,
  busy,
}: {
  draft: { name: string; pages: string[] };
  onChange: (d: { name: string; pages: string[] }) => void;
  onCancel: () => void;
  onSave: () => void;
  busy: boolean;
}) {
  const toggle = (path: string) => {
    const has = draft.pages.includes(path);
    onChange({ ...draft, pages: has ? draft.pages.filter((p) => p !== path) : [...draft.pages, path] });
  };
  return (
    <Modal title="Create / update role" onClose={onCancel}>
      <div className="grid gap-4">
        <Field label="Role name">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="e.g. Manager, Call Center Agent"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary"
          />
        </Field>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Default pages
          </label>
          <div className="grid max-h-64 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-border bg-muted/20 p-2">
            {NAV_PAGES.map((page) => {
              const checked = draft.pages.includes(page.path);
              return (
                <label
                  key={page.path}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(page.path)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  <span className="truncate">{page.label}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <button onClick={onCancel} className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> {busy ? "Saving…" : "Save role"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
