import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  ShieldCheck,
  Users,
  UserCog,
  Eye,
  Landmark,
  Database,
  AlertTriangle,
  Search,
} from "lucide-react";
import { AppShell, Card, StatusPill } from "@/components/app-shell";
import { USERS as INITIAL_USERS } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/users")({
  head: () => ({ meta: [{ title: "Users & Roles — CoopData" }] }),
  component: UsersPage,
});

const ROLES_CONFIG = [
  {
    role: "Ministry Official",
    count: 38,
    desc: "National statistics, all cooperatives, compliance monitoring and national sign-offs.",
    icon: Landmark,
    edgeCls: "card-edge",
    iconBg: "text-accent bg-accent/10",
  },
  {
    role: "Federation Officer",
    count: 142,
    desc: "Federation-scoped cooperatives, submission validation, federation user management.",
    icon: UserCog,
    edgeCls: "card-edge-info",
    iconBg: "text-info bg-info/10",
  },
  {
    role: "Cooperative Manager",
    count: 9421,
    desc: "Submit data, update records, view own reports, manage cooperative membership.",
    icon: Users,
    edgeCls: "card-edge-success",
    iconBg: "text-success bg-success/10",
  },
  {
    role: "Regional Officer",
    count: 612,
    desc: "Field data collection, questionnaire submission, record verification.",
    icon: Database,
    edgeCls: "card-edge-warning",
    iconBg: "text-warning-foreground bg-warning/15",
  },
  {
    role: "Read-only Auditor",
    count: 18,
    desc: "View all data, reports, and audit logs. No editing rights.",
    icon: Eye,
    edgeCls: "card-edge-primary",
    iconBg: "text-muted-foreground bg-muted",
  },
];

function UsersPage() {
  const { role } = useAuth();
  const [usersList, setUsersList] = useState(INITIAL_USERS);
  const [search, setSearch] = useState("");

  const isReadOnly = false; // Read-only access can be granted to ministry users via settings
  const hasEditRights = role === "ministry";

  const filtered = usersList.filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

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

  return (
    <AppShell
      title="Users & Roles"
      subtitle="10,235 total accounts across 6 permission archetypes"
      actions={
        <button
          onClick={() =>
            isReadOnly
              ? toast.error("Auditors cannot invite users.")
              : toast.success("Invitation dispatched.")
          }
          className={`press-feedback inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${isReadOnly ? "bg-muted text-muted-foreground opacity-50" : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-elev-1)]"}`}
        >
          <Plus className="size-4" /> Invite user
        </button>
      }
    >
      <div className="space-y-6">
        {isReadOnly && (
          <div className="flex items-center gap-3 rounded-xl border border-warning/50 bg-warning/10 px-4 py-3 text-xs font-semibold text-warning-foreground">
            <AlertTriangle className="size-4 shrink-0" />
            AUDIT MODE — User and role configuration is read-only.
          </div>
        )}

        <Card
          title="Role Archetypes"
          subtitle="Permission levels assigned to all platform accounts"
        >
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {ROLES_CONFIG.map((r) => (
              <li
                key={r.role}
                className={`rounded-xl border border-border bg-background p-4 hover-lift ${r.edgeCls}`}
              >
                <div className="flex items-center justify-between">
                  <div className={`size-9 rounded-xl grid place-items-center ${r.iconBg}`}>
                    <r.icon className="size-4" />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground num font-bold">
                    {r.count.toLocaleString()}
                  </span>
                </div>
                <p className="font-heading mt-3 font-bold text-foreground text-sm">{r.role}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Account Directory"
          subtitle="Recently active and registered platform accounts"
          action={
            <div className="relative w-52">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search accounts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-input bg-muted/40 py-1.5 pl-9 pr-3 text-xs focus:border-ring focus:bg-surface focus:ring-2 focus:ring-ring/10 focus:outline-none transition-all"
              />
            </div>
          }
        >
          <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="px-5 py-3">Account</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3 hidden md:table-cell">Region</th>
                  <th className="px-5 py-3 hidden lg:table-cell">Last Active</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((u) => {
                  const initials = u.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2);
                  return (
                    <tr key={u.id} className="hover:bg-muted/25 transition-colors duration-150">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-accent/15 grid place-items-center text-xs font-bold text-accent shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">{u.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{u.role}</td>
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
                      <td className="px-5 py-3.5 text-right">
                        {hasEditRights ? (
                          <button
                            onClick={() => handleToggleStatus(u.id, u.name)}
                            className="press-feedback text-xs font-bold text-accent hover:underline"
                          >
                            {u.status === "Active" ? "Suspend" : "Activate"}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            {isReadOnly ? "Audit View" : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
