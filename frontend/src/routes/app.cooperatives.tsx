import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Download,
  MapPin,
  X,
  Building,
  ShieldAlert,
  Landmark,
  Users,
  Wallet,
  Activity,
  Pencil,
  Trash2,
} from "lucide-react";
import { AppShell, Card, StatusPill, StatCard } from "@/components/app-shell";
import { COOPERATIVES, KPI, formatCurrency, formatNumber } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/cooperatives")({
  head: () => ({ meta: [{ title: "Cooperatives — CoopData" }] }),
  component: CooperativesPage,
});

function CooperativesPage() {
  const { role } = useAuth();
  const [coops, setCoops] = useState(COOPERATIVES);
  const [search, setSearch] = useState("");
  const [activeSector, setActiveSector] = useState("All sectors");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Form states
  const [name, setName] = useState("");
  const [sector, setSector] = useState("Agriculture");
  const [region, setRegion] = useState("Manzini");
  const [members, setMembers] = useState("");
  const [portfolio, setPortfolio] = useState("");

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !members || !portfolio) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const regNo =
      "COP-" + new Date().getFullYear() + "-" + Math.floor(10000 + Math.random() * 90000);
    const newCoop = {
      id: (coops.length + 1).toString(),
      regNo,
      name,
      sector,
      region,
      members: parseInt(members) || 0,
      portfolio: parseInt(portfolio) || 0,
      compliance: "Pending" as const,
      status: "Active" as const,
      registeredOn: new Date().toISOString().split("T")[0],
    };

    setCoops([newCoop, ...coops]);
    setIsModalOpen(false);
    toast.success(`Successfully registered "${name}" with ID ${regNo}!`);

    // Reset form
    setName("");
    setSector("Agriculture");
    setRegion("Manzini");
    setMembers("");
    setPortfolio("");
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    startTransition(() => {
      setSearch(val);
    });
  };

  const handleEdit = (id: string, name: string) => {
    toast.info(`Editing cooperative: ${name}`, { description: "Opening editor..." });
  };

  const handleDelete = (id: string, name: string) => {
    setCoops((prev) => prev.filter((c) => c.id !== id));
    toast.success(`Deleted "${name}"`, { description: "Cooperative removed from registry." });
  };

  const filteredCoops = coops.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.regNo.toLowerCase().includes(search.toLowerCase()) ||
      c.sector.toLowerCase().includes(search.toLowerCase());

    const matchesSector =
      activeSector === "All sectors" || c.sector.toLowerCase() === activeSector.toLowerCase();

    return matchesSearch && matchesSector;
  });

  const activeCount = coops.filter((c) => c.status === "Active").length;
  const inactiveCount = coops.filter(
    (c) => c.status === "Inactive" || c.status === "Suspended",
  ).length;
  const combinedAssets = coops.reduce((sum, c) => sum + c.portfolio, 0);

  const titleByRole: Record<string, string> = {
    apex: "Cooperative Management",
    ministry: "National Cooperative Registry",
    federation: "Cooperative Oversight",
  };
  const subtitleByRole: Record<string, string> = {
    apex: "Manage cooperatives under your apex · register new cooperatives and monitor compliance",
    ministry: "Comprehensive national register of cooperative associations, unions, and SACCOs",
    federation:
      "Monitor cooperatives across your apex organizations · track compliance and performance",
  };
  const registerLabelByRole: Record<string, string> = {
    apex: "Register cooperative",
    ministry: "Register cooperative",
    federation: "Register cooperative",
  };

  const pageTitle = titleByRole[role] || "Cooperative Registry";
  const pageSubtitle = subtitleByRole[role] || "Comprehensive cooperative registry";
  const registerLabel = registerLabelByRole[role] || "Register cooperative";

  return (
    <AppShell
      title={pageTitle}
      subtitle={pageSubtitle}
      actions={
        <button
          onClick={() => setIsModalOpen(true)}
          className="press-feedback inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-[var(--shadow-elev-2)]"
        >
          <Plus className="size-4" /> {registerLabel}
        </button>
      }
    >
      <div className="space-y-6">
        {/* Statistics Row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={Landmark}
            label="Total registered"
            value={formatNumber(coops.length)}
            subtitle="Nationally recognized"
            tone="primary"
          />
          <StatCard
            icon={Activity}
            label="Active Status"
            value={formatNumber(activeCount)}
            subtitle="Operational cooperatives"
            tone="success"
          />
          <StatCard
            icon={Users}
            label="Inactive / Suspended"
            value={formatNumber(inactiveCount)}
            subtitle="Non-operational"
            tone="warning"
          />
          <StatCard
            icon={Wallet}
            label="Combined Portfolio"
            value={formatCurrency(combinedAssets)}
            subtitle="Aggregate capital base"
            tone="accent"
          />
        </div>

        {/* Registry Card Container */}
        <Card
          title="National Directory"
          subtitle="Search, filter, and review regional cooperative records"
          action={
            <div className="flex gap-2">
              <button
                onClick={() => toast.success("Exporting register data as CSV...")}
                className="press-feedback inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 transition-colors"
              >
                <Download className="size-3.5" /> Export CSV
              </button>
            </div>
          }
        >
          {/* Filters Area */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
            <div className="relative min-w-[280px] max-w-md w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                defaultValue={search}
                onChange={handleSearchChange}
                placeholder="Search by name, code, sector..."
                className="w-full rounded-lg border border-input bg-surface py-2 pl-9 pr-3 text-sm transition-all focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/10"
              />
            </div>
            <Pills
              items={[
                "All sectors",
                "Agriculture",
                "Finance",
                "Housing",
                "Transport",
                "Manufacturing",
              ]}
              active={activeSector}
              onChange={setActiveSector}
            />
          </div>

          {/* Table Directory */}
          <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="px-5 py-3">Registration</th>
                  <th className="px-5 py-3">Cooperative</th>
                  <th className="px-5 py-3">Sector</th>
                  <th className="px-5 py-3">Region</th>
                  <th className="px-5 py-3 text-right">Members</th>
                  <th className="px-5 py-3 text-right">Portfolio</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Compliance</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCoops.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <Building className="size-8 text-muted-foreground/60 mb-2" />
                        <p className="font-semibold text-sm">No cooperatives match query</p>
                        <p className="text-xs">
                          Try adjusting search search parameters or register a new cooperative.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCoops.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors duration-150">
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                        {c.regNo}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-foreground leading-tight">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Registered {c.registeredOn}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                          {c.sector}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        <span className="inline-flex items-center gap-1 text-xs">
                          <MapPin className="size-3 text-muted-foreground/75" /> {c.region}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right num text-foreground">
                        {c.members.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold num text-foreground">
                        {formatCurrency(c.portfolio)}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill tone={c.status === "Active" ? "success" : "danger"}>
                          {c.status}
                        </StatusPill>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill
                          tone={
                            c.compliance === "Verified"
                              ? "success"
                              : c.compliance === "Pending"
                                ? "warning"
                                : c.compliance === "Under Review"
                                  ? "info"
                                  : "danger"
                          }
                        >
                          {c.compliance}
                        </StatusPill>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(c.id, c.name)}
                            className="press-feedback inline-flex items-center justify-center size-7 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id, c.name)}
                            className="press-feedback inline-flex items-center justify-center size-7 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Directory Footer */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>
              Showing {filteredCoops.length} of {coops.length} cooperatives
            </p>
            <div className="flex gap-1">
              <button className="press-feedback rounded-lg border border-border px-2.5 py-1.5 transition-colors hover:bg-muted/50">
                Previous
              </button>
              <button className="press-feedback rounded-lg bg-primary px-3 py-1.5 font-bold text-primary-foreground">
                1
              </button>
              <button className="press-feedback rounded-lg border border-border px-2.5 py-1.5 transition-colors hover:bg-muted/50">
                2
              </button>
              <button className="press-feedback rounded-lg border border-border px-2.5 py-1.5 transition-colors hover:bg-muted/50">
                Next
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Creation Modal / Dialog Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop blur */}
          <div
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity"
          />

          {/* Dialog Body */}
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-elev-3)] animate-panel z-10">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Building className="size-5 text-accent" />
                <h3 className="font-heading text-lg font-bold text-foreground">
                  Register Cooperative
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="press-feedback rounded-lg p-1 hover:bg-muted text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Cooperative Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Peak Agro Savings Union"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Sector Guild
                  </label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring transition-all"
                  >
                    <option>Agriculture</option>
                    <option>Finance</option>
                    <option>Housing</option>
                    <option>Transport</option>
                    <option>Manufacturing</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Jurisdiction Region
                  </label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring transition-all"
                  >
                    <option>Manzini</option>
                    <option>Hhohho</option>
                    <option>Shiselweni</option>
                    <option>Lubombo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Initial Members *
                  </label>
                  <input
                    type="number"
                    required
                    value={members}
                    onChange={(e) => setMembers(e.target.value)}
                    placeholder="e.g. 150"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Initial Capital ($) *
                  </label>
                  <input
                    type="number"
                    required
                    value={portfolio}
                    onChange={(e) => setPortfolio(e.target.value)}
                    placeholder="e.g. 25000"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
                <ShieldAlert className="size-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  By submitting, you certify this cooperative operates in accordance with national
                  cooperative guidelines and has cleared local board validation.
                </span>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="press-feedback px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="press-feedback px-4 py-2 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-colors shadow-sm"
                >
                  Submit Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Pills({
  items,
  active,
  onChange,
}: {
  items: string[];
  active: string;
  onChange: (s: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {items.map((i) => {
        const isActive = active === i;
        return (
          <button
            key={i}
            onClick={() => onChange(i)}
            className={`press-feedback rounded-lg border px-3 py-1.5 font-bold transition-all ${
              isActive
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border text-muted-foreground hover:bg-muted/50 bg-surface"
            }`}
          >
            {i}
          </button>
        );
      })}
    </div>
  );
}
