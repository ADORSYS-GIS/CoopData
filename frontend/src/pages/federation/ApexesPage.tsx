import {
  Plus,
  Search,
  Download,
  MapPin,
  X,
  Network,
  ShieldAlert,
  Building2,
  Users,
  Wallet,
  Activity,
  Pencil,
  Trash2,
} from "lucide-react";
import { AppShell, Card, StatusPill, StatCard } from "@/components/app-shell";
import { APEXES, formatCurrency, formatNumber } from "@/lib/mock-data";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { requireRole } from "@/lib/route-guards";

export const ApexesPage: React.FC = () => {
  const [apexes, setApexes] = useState(APEXES);
  const [search, setSearch] = useState("");
  const [activeRegion, setActiveRegion] = useState("All regions");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [region, setRegion] = useState("Manzini");
  const [federationName, setFederationName] = useState("Manzini Regional Federation");

  // Edit modal state
  const [editingApex, setEditingApex] = useState<(typeof APEXES)[number] | null>(null);
  const [editName, setEditName] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editFederation, setEditFederation] = useState("");

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const regNo = "APX-" + new Date().getFullYear() + "-" + Math.floor(100 + Math.random() * 900);
    const newApex = {
      id: "a" + (apexes.length + 1),
      regNo,
      name,
      region,
      federationName,
      coopCount: 0,
      totalMembers: 0,
      totalPortfolio: 0,
      compliance: "Pending" as const,
      status: "Active" as const,
      registeredOn: new Date().toISOString().split("T")[0],
    };

    setApexes([newApex, ...apexes]);
    setIsModalOpen(false);
    toast.success(`Successfully registered "${name}" with ID ${regNo}!`);
    setName("");
    setRegion("Manzini");
    setFederationName("Manzini Regional Federation");
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    startTransition(() => {
      setSearch(val);
    });
  };

  const handleEdit = (id: string, name: string) => {
    const apex = apexes.find((a) => a.id === id);
    if (apex) {
      setEditingApex(apex);
      setEditName(apex.name);
      setEditRegion(apex.region);
      setEditFederation(apex.federationName);
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingApex || !editName) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setApexes((prev) =>
      prev.map((a) =>
        a.id === editingApex.id
          ? { ...a, name: editName, region: editRegion, federationName: editFederation }
          : a,
      ),
    );
    toast.success(`Updated "${editName}"`);
    setEditingApex(null);
  };

  const handleDelete = (id: string, name: string) => {
    setApexes((prev) => prev.filter((a) => a.id !== id));
    toast.success(`Deleted "${name}"`, { description: "Apex organization removed from registry." });
  };

  const filteredApexes = apexes.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.regNo.toLowerCase().includes(search.toLowerCase()) ||
      a.region.toLowerCase().includes(search.toLowerCase()) ||
      a.federationName.toLowerCase().includes(search.toLowerCase());

    const matchesRegion =
      activeRegion === "All regions" || a.region.toLowerCase() === activeRegion.toLowerCase();

    return matchesSearch && matchesRegion;
  });

  const activeCount = apexes.filter((a) => a.status === "Active").length;
  const totalMembers = apexes.reduce((sum, a) => sum + a.totalMembers, 0);
  const totalPortfolio = apexes.reduce((sum, a) => sum + a.totalPortfolio, 0);

  return (
    <AppShell
      title="Apex Organizations"
      subtitle="Manage apex bodies · create and oversee cooperatives under each apex"
      actions={
        <button
          onClick={() => setIsModalOpen(true)}
          className="press-feedback inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-[var(--shadow-elev-2)]"
        >
          <Plus className="size-4" /> Register apex
        </button>
      }
    >
      <div className="space-y-6">
        {/* Statistics Row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={Network}
            label="Total Apexes"
            value={formatNumber(apexes.length)}
            subtitle="Cooperative oversight bodies"
            tone="primary"
          />
          <StatCard
            icon={Activity}
            label="Active"
            value={formatNumber(activeCount)}
            subtitle="Operational apexes"
            tone="success"
          />
          <StatCard
            icon={Users}
            label="Total Members"
            value={formatNumber(totalMembers)}
            subtitle="Across all apexes"
            tone="accent"
          />
          <StatCard
            icon={Wallet}
            label="Combined Portfolio"
            value={formatCurrency(totalPortfolio)}
            subtitle="Aggregate capital base"
            tone="info"
          />
        </div>

        {/* Registry Card */}
        <Card
          title="Apex Directory"
          subtitle="Search, filter, and manage apex organizations"
          action={
            <div className="flex gap-2">
              <button
                onClick={() => toast.success("Exporting apex data as CSV...")}
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
                placeholder="Search by name, code, region, federation..."
                className="w-full rounded-lg border border-input bg-surface py-2 pl-9 pr-3 text-sm transition-all focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/10"
              />
            </div>
            <Pills
              items={["All regions", "Manzini", "Hhohho", "Shiselweni", "Lubombo"]}
              active={activeRegion}
              onChange={setActiveRegion}
            />
          </div>

          {/* Table */}
          <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="px-5 py-3">Registration</th>
                  <th className="px-5 py-3">Apex Organization</th>
                  <th className="px-5 py-3">Region</th>
                  <th className="px-5 py-3 hidden md:table-cell">Federation</th>
                  <th className="px-5 py-3 text-right">Cooperatives</th>
                  <th className="px-5 py-3 text-right">Members</th>
                  <th className="px-5 py-3 text-right">Portfolio</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Compliance</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredApexes.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <Network className="size-8 text-muted-foreground/60 mb-2" />
                        <p className="font-semibold text-sm">No apexes match query</p>
                        <p className="text-xs">
                          Try adjusting search parameters or register a new apex.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredApexes.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/30 transition-colors duration-150">
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                        {a.regNo}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-foreground leading-tight">{a.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Registered {a.registeredOn}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 text-xs">
                          <MapPin className="size-3 text-muted-foreground/75" /> {a.region}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs hidden md:table-cell">
                        {a.federationName}
                      </td>
                      <td className="px-5 py-3.5 text-right num text-foreground">
                        <span className="inline-flex items-center gap-1 justify-end">
                          <Building2 className="size-3 text-muted-foreground" />
                          {a.coopCount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right num text-muted-foreground">
                        {formatNumber(a.totalMembers)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold num text-foreground">
                        {formatCurrency(a.totalPortfolio)}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill tone={a.status === "Active" ? "success" : "danger"}>
                          {a.status}
                        </StatusPill>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill
                          tone={
                            a.compliance === "Verified"
                              ? "success"
                              : a.compliance === "Pending"
                                ? "warning"
                                : a.compliance === "Under Review"
                                  ? "info"
                                  : "danger"
                          }
                        >
                          {a.compliance}
                        </StatusPill>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(a.id, a.name)}
                            className="press-feedback inline-flex items-center justify-center size-7 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(a.id, a.name)}
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

          {/* Footer */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>
              Showing {filteredApexes.length} of {apexes.length} apexes
            </p>
            <div className="flex gap-1">
              <button className="press-feedback rounded-lg border border-border px-2.5 py-1.5 transition-colors hover:bg-muted/50">
                Previous
              </button>
              <button className="press-feedback rounded-lg bg-primary px-3 py-1.5 font-bold text-primary-foreground">
                1
              </button>
              <button className="press-feedback rounded-lg border border-border px-2.5 py-1.5 transition-colors hover:bg-muted/50">
                Next
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-elev-3)] animate-panel z-10">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Network className="size-5 text-accent" />
                <h3 className="font-heading text-lg font-bold text-foreground">
                  Register Apex Organization
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
                  Apex Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Manzini Agricultural Apex"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Region
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

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Parent Federation
                  </label>
                  <select
                    value={federationName}
                    onChange={(e) => setFederationName(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring transition-all"
                  >
                    <option>Manzini Regional Federation</option>
                    <option>Hhohho Regional Federation</option>
                    <option>Shiselweni Regional Federation</option>
                    <option>Lubombo Regional Federation</option>
                  </select>
                </div>
              </div>

              <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
                <ShieldAlert className="size-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  By registering, you certify this apex organization operates under the designated
                  federation and has cleared the federation's validation process.
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
                  Register Apex
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingApex && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setEditingApex(null)}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-elev-3)] animate-panel z-10">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Pencil className="size-5 text-accent" />
                <h3 className="font-heading text-lg font-bold text-foreground">
                  Edit Apex Organization
                </h3>
              </div>
              <button
                onClick={() => setEditingApex(null)}
                className="press-feedback rounded-lg p-1 hover:bg-muted text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Apex Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Region
                  </label>
                  <select
                    value={editRegion}
                    onChange={(e) => setEditRegion(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring transition-all"
                  >
                    <option>Manzini</option>
                    <option>Hhohho</option>
                    <option>Shiselweni</option>
                    <option>Lubombo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Parent Federation
                  </label>
                  <select
                    value={editFederation}
                    onChange={(e) => setEditFederation(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring transition-all"
                  >
                    <option>Manzini Regional Federation</option>
                    <option>Hhohho Regional Federation</option>
                    <option>Shiselweni Regional Federation</option>
                    <option>Lubombo Regional Federation</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setEditingApex(null)}
                  className="press-feedback px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="press-feedback px-4 py-2 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-colors shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
};

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
