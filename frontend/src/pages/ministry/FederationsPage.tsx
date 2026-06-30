import {
  Plus,
  Search,
  Download,
  MapPin,
  X,
  Landmark,
  ShieldAlert,
  Network,
  Users,
  Wallet,
  Activity,
  Pencil,
  Trash2,
} from "lucide-react";
import { AppShell, Card, StatusPill, StatCard } from "@/components/app-shell";
import { formatCurrency, formatNumber } from "@/lib/mock-data";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  useFederations,
  useCreateFederation,
  useUpdateFederation,
  useDeleteFederation,
} from "@/hooks/federations/useFederations";
import type { components } from "@/openapi-client/api";

type Federation = components["schemas"]["FederationResponse"];

export const FederationsPage: React.FC = () => {
  const { data: federations = [], isLoading, error, refetch } = useFederations();
  const createMutation = useCreateFederation();
  const updateMutation = useUpdateFederation();
  const deleteMutation = useDeleteFederation();

  const [search, setSearch] = useState("");
  const [activeDomain, setActiveDomain] = useState("All domains");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // Edit modal state
  const [editingFed, setEditingFed] = useState<Federation | null>(null);
  const [editName, setEditName] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      toast.error("Please fill in all required fields.");
      return;
    }

    createMutation.mutate(
      { name, contact_email: contactEmail || undefined },
      {
        onSuccess: () => {
          toast.success(`Successfully registered "${name}"!`);
          setIsModalOpen(false);
          setName("");
          setContactEmail("");
          refetch();
        },
        onError: (err) => {
          toast.error("Failed to register federation", {
            description: String(err),
          });
        },
      },
    );
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    startTransition(() => {
      setSearch(val);
    });
  };

  const handleEdit = (fed: Federation) => {
    setEditingFed(fed);
    setEditName(fed.name);
    setEditContactEmail(fed.description || "");
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFed || !editName) {
      toast.error("Please fill in all required fields.");
      return;
    }
    updateMutation.mutate(
      {
        id: editingFed.id,
        name: editName,
        contact_email: editContactEmail || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Updated "${editName}"`);
          setEditingFed(null);
          refetch();
        },
        onError: (err) => {
          toast.error("Failed to update federation", {
            description: String(err),
          });
        },
      },
    );
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success(`Deleted "${name}"`, {
          description: "Federation removed from registry.",
        });
        refetch();
      },
      onError: (err) => {
        toast.error("Failed to delete federation", {
          description: String(err),
        });
      },
    });
  };

  const federationsList = (federations as Federation[]) || [];

  const filteredFeds = federationsList.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      (f.description || "").toLowerCase().includes(search.toLowerCase());

    const matchesDomain =
      activeDomain === "All domains" ||
      f.domains?.some((d) => d.name.toLowerCase() === activeDomain.toLowerCase());

    return matchesSearch && matchesDomain;
  });

  const activeCount = federationsList.filter((f) => f.enabled).length;
  const totalDomains = federationsList.reduce((sum, f) => sum + (f.domains?.length || 0), 0);

  const allDomains = Array.from(
    new Set(federationsList.flatMap((f) => f.domains?.map((d) => d.name) || [])),
  );

  return (
    <AppShell
      title="Federation Registry"
      subtitle="Manage regional federations · create and oversee apex organizations under each federation"
      actions={
        <button
          onClick={() => setIsModalOpen(true)}
          className="press-feedback inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-[var(--shadow-elev-2)]"
        >
          <Plus className="size-4" /> Register federation
        </button>
      }
    >
      <div className="space-y-6">
        {/* Statistics Row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={Landmark}
            label="Total Federations"
            value={formatNumber(federationsList.length)}
            subtitle="Regional oversight bodies"
            tone="primary"
          />
          <StatCard
            icon={Activity}
            label="Active"
            value={formatNumber(activeCount)}
            subtitle="Operational federations"
            tone="success"
          />
          <StatCard
            icon={Users}
            label="Total Domains"
            value={formatNumber(totalDomains)}
            subtitle="Across all federations"
            tone="accent"
          />
          <StatCard
            icon={Wallet}
            label="Combined Portfolio"
            value={formatCurrency(0)}
            subtitle="Aggregate capital base"
            tone="info"
          />
        </div>

        {/* Registry Card */}
        <Card
          title="National Federation Directory"
          subtitle="Search, filter, and manage regional federations"
          action={
            <div className="flex gap-2">
              <button
                onClick={() => toast.success("Exporting federation data as CSV...")}
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
                placeholder="Search by name, domain..."
                className="w-full rounded-lg border border-input bg-surface py-2 pl-9 pr-3 text-sm transition-all focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/10"
              />
            </div>
            <Pills
              items={["All domains", ...allDomains]}
              active={activeDomain}
              onChange={setActiveDomain}
            />
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-3 py-8">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-muted/30" />
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">
              <ShieldAlert className="mx-auto mb-2 h-8 w-8" />
              <p>Failed to load federations</p>
              <p className="text-sm text-muted-foreground">{String(error)}</p>
            </div>
          ) : filteredFeds.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <div className="flex flex-col items-center justify-center">
                <Landmark className="size-8 text-muted-foreground/60 mb-2" />
                <p className="font-semibold text-sm">No federations match query</p>
                <p className="text-xs">
                  Try adjusting search parameters or register a new federation.
                </p>
              </div>
            </div>
          ) : (
            <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <th className="px-5 py-3">ID</th>
                    <th className="px-5 py-3">Federation</th>
                    <th className="px-5 py-3">Domains</th>
                    <th className="px-5 py-3 text-right">Enabled</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredFeds.map((f) => (
                    <tr key={f.id} className="hover:bg-muted/30 transition-colors duration-150">
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                        {f.id.slice(0, 8)}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-foreground leading-tight">{f.name}</p>
                        {f.description && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {f.description}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {f.domains?.map((d) => (
                            <span key={d.name} className="inline-flex items-center gap-1 text-xs">
                              <MapPin className="size-3 text-muted-foreground/75" /> {d.name}
                            </span>
                          )) || <span className="text-xs text-muted-foreground">No domains</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <StatusPill tone={f.enabled ? "success" : "danger"}>
                          {f.enabled ? "Enabled" : "Disabled"}
                        </StatusPill>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(f)}
                            className="press-feedback inline-flex items-center justify-center size-7 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(f.id, f.name)}
                            className="press-feedback inline-flex items-center justify-center size-7 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>
              Showing {filteredFeds.length} of {federationsList.length} federations
            </p>
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
                <Landmark className="size-5 text-accent" />
                <h3 className="font-heading text-lg font-bold text-foreground">
                  Register Federation
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
                  Federation Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Manzini Regional Federation"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contact@federation.org"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all"
                />
              </div>

              <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
                <ShieldAlert className="size-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  By registering, you certify this federation operates in accordance with national
                  cooperative guidelines and has cleared the Ministry's registration process.
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
                  disabled={createMutation.isPending}
                  className="press-feedback px-4 py-2 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-colors shadow-sm disabled:opacity-50"
                >
                  {createMutation.isPending ? "Registering..." : "Register Federation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingFed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setEditingFed(null)}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-elev-3)] animate-panel z-10">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Pencil className="size-5 text-accent" />
                <h3 className="font-heading text-lg font-bold text-foreground">Edit Federation</h3>
              </div>
              <button
                onClick={() => setEditingFed(null)}
                className="press-feedback rounded-lg p-1 hover:bg-muted text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Federation Name *
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
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={editContactEmail}
                  onChange={(e) => setEditContactEmail(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setEditingFed(null)}
                  className="press-feedback px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="press-feedback px-4 py-2 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-colors shadow-sm disabled:opacity-50"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
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
