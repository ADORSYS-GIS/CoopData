import { useState } from "react";
import { useFederations, useFederationMembers } from "@/hooks/federations/useFederations";
import { AppShell, Card, StatCard } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, UserX, Search } from "lucide-react";
import type { components } from "@/openapi-client/api";

type Member = components["schemas"]["MemberResponse"];

export const MemberList: React.FC = () => {
  const { data: federations = [], isLoading: federationsLoading } = useFederations();
  const [selectedFederationId, setSelectedFederationId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: members = [],
    isLoading: membersLoading,
    error: membersError,
  } = useFederationMembers(selectedFederationId);

  const filteredMembers = (members as Member[]).filter((m) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (m.username ?? "").toLowerCase().includes(query) ||
      (m.email ?? "").toLowerCase().includes(query) ||
      (m.first_name ?? "").toLowerCase().includes(query) ||
      (m.last_name ?? "").toLowerCase().includes(query)
    );
  });

  const activeMembers = (members as Member[]).filter((m) => m.username).length;
  const pendingMembers = (members as Member[]).length - activeMembers;

  return (
    <AppShell title="Member Management" subtitle="View and manage federation members">
      <div className="space-y-6">
        {/* Federation Selector */}
        <Card title="Select Federation" subtitle="Choose a federation to view its members">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              {federationsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedFederationId} onValueChange={setSelectedFederationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a federation..." />
                  </SelectTrigger>
                  <SelectContent>
                    {federations.map((f: components["schemas"]["FederationResponse"]) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </Card>

        {/* Stats Cards */}
        {selectedFederationId && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={Users}
              label="Total Members"
              value={String((members as Member[]).length)}
              subtitle="All registered members"
              tone="primary"
            />
            <StatCard
              icon={UserCheck}
              label="Active Members"
              value={String(activeMembers)}
              subtitle="With usernames assigned"
              tone="success"
            />
            <StatCard
              icon={UserX}
              label="Pending Members"
              value={String(pendingMembers)}
              subtitle="Awaiting activation"
              tone="warning"
            />
            <StatCard
              icon={Users}
              label="Federations"
              value={String(federations.length)}
              subtitle="Total federations"
              tone="info"
            />
          </div>
        )}

        {/* Members Table */}
        {selectedFederationId && (
          <Card
            title="Federation Members"
            subtitle={`${filteredMembers.length} members found`}
            action={
              <div className="relative w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            }
          >
            {membersLoading ? (
              <div className="space-y-3 py-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : membersError ? (
              <div className="py-8 text-center text-destructive">
                <p>Failed to load members: {String(membersError)}</p>
                <Button variant="outline" className="mt-3" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Users className="mx-auto mb-3 size-12 opacity-30" />
                <p className="text-lg font-medium">No members found</p>
                <p className="text-sm">
                  {searchQuery
                    ? "Try adjusting your search query"
                    : "This federation has no members yet"}
                </p>
              </div>
            ) : (
              <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      <th className="px-5 py-3.5">Name</th>
                      <th className="px-5 py-3.5">Email</th>
                      <th className="px-5 py-3.5">Username</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredMembers.map((member: Member) => (
                      <tr
                        key={member.id}
                        className="hover:bg-muted/30 transition-colors duration-150"
                      >
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-foreground">
                            {member.first_name} {member.last_name}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">{member.email ?? "—"}</td>
                        <td className="px-5 py-3.5 text-foreground">{member.username ?? "—"}</td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                              member.username
                                ? "bg-success/10 text-success ring-success/20"
                                : "bg-warning/15 text-warning-foreground ring-warning/30"
                            }`}
                          >
                            <span className="size-1.5 rounded-full bg-current opacity-70" />
                            {member.username ? "Active" : "Pending"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* Empty state when no federation selected */}
        {!selectedFederationId && !federationsLoading && (
          <Card title="No Federation Selected">
            <div className="py-12 text-center text-muted-foreground">
              <Users className="mx-auto mb-3 size-12 opacity-30" />
              <p className="text-lg font-medium">Select a federation</p>
              <p className="text-sm">
                Choose a federation from the dropdown above to view its members
              </p>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
};
