import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  ShieldCheck,
  Users,
  UserCog,
  Eye,
  Landmark,
  Database,
  Search,
  X,
  Mail,
  CheckCircle2,
  Pencil,
  Trash2,
} from "lucide-react";
import { AppShell, Card, StatusPill } from "@/components/app-shell";
import { USERS as INITIAL_USERS, FEDERATIONS, APEXES, COOPERATIVES } from "@/lib/mock-data";
import { useAuth, type Role } from "@/lib/auth";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { requireRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/users")({
  beforeLoad: () => {
    requireRole("ministry", "federation", "apex");
  },
  head: () => ({ meta: [{ title: "Users & Roles — CoopData" }] }),
  component: UsersPage,
});

// Which roles each parent role can create
const CAN_CREATE: Record<Role, string[]> = {
  ministry: ["Federation Officer", "Ministry Official", "Read-only Auditor"],
  federation: ["Apex Officer", "Federation Officer"],
  apex: ["Cooperative Manager", "Apex Officer"],
  cooperative: ["Cooperative Manager"],
};

// Which role archetype cards each role can see
const VISIBLE_ROLES: Record<Role, string[]> = {
  ministry: [
    "Ministry Official",
    "Federation Officer",
    "Apex Officer",
    "Cooperative Manager",
    "Read-only Auditor",
  ],
  federation: ["Federation Officer", "Apex Officer"],
  apex: ["Apex Officer", "Cooperative Manager"],
  cooperative: ["Cooperative Manager"],
};

// Parent entity options per role
const PARENT_ENTITY: Record<Role, { label: string; options: { id: string; name: string }[] }> = {
  ministry: {
    label: "Assign to Federation",
    options: FEDERATIONS.map((f) => ({ id: f.id, name: f.name })),
  },
  federation: { label: "Assign to Apex", options: APEXES.map((a) => ({ id: a.id, name: a.name })) },
  apex: {
    label: "Assign to Cooperative",
    options: COOPERATIVES.map((c) => ({ id: c.id, name: c.name })),
  },
  cooperative: { label: "Cooperative", options: [] },
};

const ROLES_CONFIG = [
  {
    role: "Ministry Official",
    count: 38,
    desc: "National statistics, all cooperatives, compliance monitoring and national sign-offs.",
    icon: Landmark,
  },
  {
    role: "Federation Officer",
    count: 142,
    desc: "Federation-scoped cooperatives, submission validation, federation user management.",
    icon: UserCog,
  },
  {
    role: "Apex Officer",
    count: 612,
    desc: "Review cooperative submissions, manage cooperatives, approve or request changes.",
    icon: Database,
  },
  {
    role: "Cooperative Manager",
    count: 9421,
    desc: "Submit data, update records, view own reports, manage cooperative membership.",
    icon: Users,
  },
  {
    role: "Read-only Auditor",
    count: 18,
    desc: "View all data, reports, and audit logs. No editing rights.",
    icon: Eye,
  },
];

const ROLE_ICON_MAP: Record<string, string> = {
  "Ministry Official": "Landmark",
  "Federation Officer": "UserCog",
  "Apex Officer": "Database",
  "Cooperative Manager": "Users",
  "Read-only Auditor": "Eye",
};

function UsersPage() {
  const { role } = useAuth();
  const [usersList, setUsersList] = useState(INITIAL_USERS);
  const [search, setSearch] = useState("");
  const [activeRoleFilter, setActiveRoleFilter] = useState("All roles");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formParentEntity, setFormParentEntity] = useState("");

  // Edit modal state
  const [editingUser, setEditingUser] = useState<(typeof INITIAL_USERS)[number] | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("");

  const canCreate = CAN_CREATE[role];
  const visibleRoles = VISIBLE_ROLES[role];
  const parentEntity = PARENT_ENTITY[role];

  const hasEditRights = role === "ministry" || role === "federation" || role === "apex";

  const roleLabelByRole: Record<Role, string> = {
    ministry: "National User Administration",
    federation: "Federation User Management",
    apex: "Apex User Management",
    cooperative: "Cooperative Members",
  };

  const subtitleByRole: Record<Role, string> = {
    ministry: "Create and manage users across all levels of the cooperative hierarchy",
    federation: "Manage apex officers and federation staff under your jurisdiction",
    apex: "Manage cooperative managers and apex staff under your supervision",
    cooperative: "View and manage members within your cooperative",
  };

  const pageTitle = roleLabelByRole[role];
  const pageSubtitle = subtitleByRole[role];

  const filteredRoles = ROLES_CONFIG.filter((r) => visibleRoles.includes(r.role));

  const filtered = usersList.filter((u) => {
    const matchesSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());

    const matchesRole = activeRoleFilter === "All roles" || u.role === activeRoleFilter;

    const scopeRoles = canCreate;
    const matchesScope =
      scopeRoles.includes(u.role) ||
      u.role ===
        ROLES_CONFIG.find((r) => {
          const roleMap: Record<Role, string> = {
            ministry: "Ministry Official",
            federation: "Federation Officer",
            apex: "Apex Officer",
            cooperative: "Cooperative Manager",
          };
          return r.role === roleMap[role];
        })?.role;

    return matchesSearch && matchesRole && matchesScope;
  });

  const handleToggleStatus = (id: string, name: string) => {
    if (!hasEditRights) {
      toast.error("Insufficient permissions.");
      return;
    }
    setUsersList((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, status: u.status === "Active" ? ("Suspended" as const) : ("Active" as const) }
          : u,
      ),
    );
    toast.success(`Account state toggled for ${name}`);
  };

  const handleEditUser = (user: (typeof INITIAL_USERS)[number]) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editName || !editEmail || !editRole) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setUsersList((prev) =>
      prev.map((u) =>
        u.id === editingUser.id ? { ...u, name: editName, email: editEmail, role: editRole } : u,
      ),
    );
    toast.success(`Updated ${editName}'s account`);
    setEditingUser(null);
  };

  const handleDeleteUser = (id: string, name: string) => {
    setUsersList((prev) => prev.filter((u) => u.id !== id));
    toast.success(`Deleted "${name}"`, { description: "User account removed." });
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formEmail || !formRole) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const newUser = {
      id: "u" + (usersList.length + 1),
      name: formName,
      email: formEmail,
      role: formRole,
      region: parentEntity.options.find((o) => o.id === formParentEntity)?.name || "National",
      lastActive: "Just now",
      status: "Active" as const,
    };

    setUsersList([newUser, ...usersList]);
    setIsModalOpen(false);
    toast.success(`Invitation sent to ${formName} (${formRole})`);

    setFormName("");
    setFormEmail("");
    setFormRole("");
    setFormParentEntity("");
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    startTransition(() => {
      setSearch(val);
    });
  };

  const roleFilterOptions = ["All roles", ...canCreate];

  return (
    <AppShell
      title={pageTitle}
      subtitle={pageSubtitle}
      actions={
        <button
          onClick={() => setIsModalOpen(true)}
          className="press-feedback inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-[var(--shadow-elev-2)]"
        >
          <Plus className="size-4" /> Invite user
        </button>
      }
    >
      <div className="space-y-8">
        {/* Role Archetypes — clean grid, no colored edges */}
        <Card title="Role Archetypes" subtitle="Permission levels available in your scope">
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredRoles.map((r) => (
              <li
                key={r.role}
                className="rounded-lg border border-border bg-background p-4 hover-lift"
              >
                <div className="flex items-center justify-between">
                  <div className="size-9 rounded-lg grid place-items-center bg-muted text-muted-foreground">
                    <r.icon className="size-4" />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground num font-semibold">
                    {r.count.toLocaleString()}
                  </span>
                </div>
                <p className="font-heading mt-3 font-bold text-foreground text-sm">{r.role}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
              </li>
            ))}
          </ul>
        </Card>

        {/* Account Directory */}
        <Card
          title="Account Directory"
          subtitle={`Users within your ${role === "ministry" ? "national" : role === "federation" ? "federation" : role === "apex" ? "apex" : "cooperative"} scope`}
          action={
            <div className="flex items-center gap-3">
              <div className="relative w-52">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search accounts..."
                  value={search}
                  onChange={handleSearchChange}
                  className="w-full rounded-lg border border-input bg-muted/40 py-1.5 pl-9 pr-3 text-xs focus:border-ring focus:bg-surface focus:ring-2 focus:ring-ring/10 focus:outline-none transition-all"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {roleFilterOptions.map((r) => (
                  <button
                    key={r}
                    onClick={() => setActiveRoleFilter(r)}
                    className={`press-feedback rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                      activeRoleFilter === r
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border text-muted-foreground hover:bg-muted/50 bg-surface"
                    }`}
                  >
                    {r === "All roles"
                      ? "All"
                      : r
                          .replace(" Officer", "")
                          .replace(" Manager", "")
                          .replace(" Official", "")
                          .replace(" Auditor", "")}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="px-5 py-3">Account</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3 hidden md:table-cell">
                    {role === "ministry"
                      ? "Federation / Region"
                      : role === "federation"
                        ? "Apex / Region"
                        : role === "apex"
                          ? "Cooperative / Region"
                          : "Region"}
                  </th>
                  <th className="px-5 py-3 hidden lg:table-cell">Last Active</th>
                  <th className="px-5 py-3">Status</th>
                  {hasEditRights && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={hasEditRights ? 6 : 5}
                      className="py-12 text-center text-muted-foreground"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <Users className="size-8 text-muted-foreground/60 mb-2" />
                        <p className="font-semibold text-sm">No users match your query</p>
                        <p className="text-xs">Try adjusting your search or role filter.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => {
                    const initials = u.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2);
                    return (
                      <tr key={u.id} className="hover:bg-muted/25 transition-colors duration-150">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-muted grid place-items-center text-xs font-semibold text-foreground shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">{u.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            {ROLE_ICON_MAP[u.role] === "Landmark" && (
                              <Landmark className="size-3" />
                            )}
                            {ROLE_ICON_MAP[u.role] === "UserCog" && <UserCog className="size-3" />}
                            {ROLE_ICON_MAP[u.role] === "Database" && (
                              <Database className="size-3" />
                            )}
                            {ROLE_ICON_MAP[u.role] === "Users" && <Users className="size-3" />}
                            {ROLE_ICON_MAP[u.role] === "Eye" && <Eye className="size-3" />}
                            {u.role}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-muted-foreground hidden md:table-cell">
                          {u.region}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-muted-foreground hidden lg:table-cell">
                          {u.lastActive}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusPill tone={u.status === "Active" ? "success" : "danger"}>
                            {u.status}
                          </StatusPill>
                        </td>
                        {hasEditRights && (
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleEditUser(u)}
                                className="press-feedback inline-flex items-center justify-center size-7 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u.id, u.name)}
                                className="press-feedback inline-flex items-center justify-center size-7 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                              <button
                                onClick={() => handleToggleStatus(u.id, u.name)}
                                className="press-feedback text-xs font-semibold text-accent hover:underline"
                              >
                                {u.status === "Active" ? "Suspend" : "Activate"}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>
              Showing {filtered.length} of{" "}
              {
                usersList.filter(
                  (u) =>
                    canCreate.includes(u.role) ||
                    u.role ===
                      ROLES_CONFIG.find((r) => {
                        const roleMap: Record<Role, string> = {
                          ministry: "Ministry Official",
                          federation: "Federation Officer",
                          apex: "Apex Officer",
                          cooperative: "Cooperative Manager",
                        };
                        return r.role === roleMap[role];
                      })?.role,
                ).length
              }{" "}
              accounts in your scope
            </p>
          </div>
        </Card>
      </div>

      {/* Invite User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity"
          />
          <div className="relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-elev-3)] animate-panel z-10">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-5">
              <div>
                <h3 className="font-heading text-lg font-bold text-foreground">Invite User</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {role === "ministry"
                    ? "Create a user under your national jurisdiction"
                    : role === "federation"
                      ? "Create a user under your federation"
                      : role === "apex"
                        ? "Create a user under your apex organization"
                        : "Invite a member to your cooperative"}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="press-feedback rounded-md p-1.5 hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Nomsa Dlamini"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. n.dlamini@example.org"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Role
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring transition-all"
                >
                  <option value="">Select a role...</option>
                  {canCreate.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {parentEntity.options.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    {parentEntity.label}
                  </label>
                  <select
                    value={formParentEntity}
                    onChange={(e) => setFormParentEntity(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring transition-all"
                  >
                    <option value="">
                      Select{" "}
                      {role === "ministry"
                        ? "a federation"
                        : role === "federation"
                          ? "an apex"
                          : "a cooperative"}
                      ...
                    </option>
                    {parentEntity.options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
                <ShieldCheck className="size-4 shrink-0 text-accent mt-0.5" />
                <span>
                  {role === "ministry"
                    ? "The invited user will have access to national-level data and federation management tools."
                    : role === "federation"
                      ? "The invited user will be scoped to your federation and its apex organizations."
                      : role === "apex"
                        ? "The invited user will be scoped to your apex organization and its cooperatives."
                        : "The invited member will be added to your cooperative."}
                </span>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="press-feedback px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="press-feedback inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-colors shadow-sm"
                >
                  <CheckCircle2 className="size-3.5" /> Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setEditingUser(null)}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity"
          />
          <div className="relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-elev-3)] animate-panel z-10">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-5">
              <div>
                <h3 className="font-heading text-lg font-bold text-foreground">Edit User</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update account details for {editingUser.name}
                </p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="press-feedback rounded-md p-1.5 hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring transition-all"
                >
                  {canCreate.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="press-feedback px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="press-feedback inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-colors shadow-sm"
                >
                  <CheckCircle2 className="size-3.5" /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
