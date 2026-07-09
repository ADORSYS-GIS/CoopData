import { useState } from "react";
import { toast } from "sonner";
import { Users, PiggyBank, HandCoins, Landmark } from "lucide-react";
import { AppShell, Card } from "@/components/app-shell";
import { useUserRole } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NfUploadZone } from "@/components/non-financial/NfUploadZone";
import { NfParseResults } from "@/components/non-financial/NfParseResults";
import { MemberGrid } from "@/components/non-financial/MemberGrid";
import { SavingsGrid } from "@/components/non-financial/SavingsGrid";
import { LoanGrid } from "@/components/non-financial/LoanGrid";
import { FixedDepositGrid } from "@/components/non-financial/FixedDepositGrid";
import { useMembers, useDeleteMember } from "@/hooks/non-financial/useMembers";
import { useSavings, useDeleteSavings } from "@/hooks/non-financial/useSavings";
import { useLoans, useDeleteLoan } from "@/hooks/non-financial/useLoans";
import { useFixedDeposits, useDeleteFixedDeposit } from "@/hooks/non-financial/useFixedDeposits";
import type { NfUploadResponse } from "@/types/non-financial";

function formatCurrency(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export const NonFinancialDataPage: React.FC = () => {
  const role = useUserRole();
  const isReadOnly = role === "apex";
  const [uploadResult, setUploadResult] = useState<NfUploadResponse | null>(null);

  const membersQuery = useMembers({ page: 1, page_size: 100 });
  const savingsQuery = useSavings({ page: 1, page_size: 100 });
  const loansQuery = useLoans({ page: 1, page_size: 100 });
  const fdQuery = useFixedDeposits({ page: 1, page_size: 100 });

  const deleteMember = useDeleteMember();
  const deleteSavings = useDeleteSavings();
  const deleteLoan = useDeleteLoan();
  const deleteFd = useDeleteFixedDeposit();

  if (!role) return null;

  const members = membersQuery.data?.data ?? [];
  const savings = savingsQuery.data?.data ?? [];
  const loans = loansQuery.data?.data ?? [];
  const fds = fdQuery.data?.data ?? [];

  const handleDeleteMember = async (id: string) => {
    try {
      await deleteMember.mutateAsync(id);
      toast.success("Member deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete member");
    }
  };

  const handleDeleteSavings = async (id: string) => {
    try {
      await deleteSavings.mutateAsync(id);
      toast.success("Savings account deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete savings account");
    }
  };

  const handleDeleteLoan = async (id: string) => {
    try {
      await deleteLoan.mutateAsync(id);
      toast.success("Loan deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete loan");
    }
  };

  const handleDeleteFd = async (id: string) => {
    try {
      await deleteFd.mutateAsync(id);
      toast.success("Fixed deposit deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete fixed deposit");
    }
  };

  const notifyAddEdit = () => toast.info("Use the Excel upload to add or update records in bulk.");

  return (
    <AppShell
      title="Non-Financial Data Collection"
      subtitle="Membership database, savings accounts, loans registry, and fixed deposits"
    >
      <div className="space-y-6">
        {!isReadOnly && (
          <div className="grid lg:grid-cols-2 gap-6">
            <NfUploadZone onUploadComplete={(result) => setUploadResult(result)} />
            {uploadResult && <NfParseResults result={uploadResult} />}
          </div>
        )}

        <Tabs defaultValue="membership">
          <TabsList>
            <TabsTrigger value="membership" className="flex items-center gap-2">
              <Users className="size-4" />
              Membership
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{members.length}</span>
            </TabsTrigger>
            <TabsTrigger value="savings" className="flex items-center gap-2">
              <PiggyBank className="size-4" />
              Savings
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{savings.length}</span>
            </TabsTrigger>
            <TabsTrigger value="loans" className="flex items-center gap-2">
              <HandCoins className="size-4" />
              Loans
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{loans.length}</span>
            </TabsTrigger>
            <TabsTrigger value="fixed-deposits" className="flex items-center gap-2">
              <Landmark className="size-4" />
              Fixed Deposits
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{fds.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="membership" className="space-y-4">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <MemberGrid
                  members={members}
                  isLoading={membersQuery.isLoading}
                  isReadOnly={isReadOnly}
                  onDelete={handleDeleteMember}
                  onAdd={notifyAddEdit}
                  onEdit={notifyAddEdit}
                />
              </div>
              <Card title="Membership Statistics" subtitle="Current roster summary">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Total Members</span>
                    <span className="font-bold text-foreground">{members.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Active</span>
                    <span className="font-bold text-success">
                      {members.filter((m) => m.status === "Active").length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Women</span>
                    <span className="font-bold text-foreground">
                      {members.filter((m) => m.gender === "Female").length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Youth (&lt;35)</span>
                    <span className="font-bold text-foreground">
                      {members.filter((m) => m.age_group === "18-35").length}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="savings" className="space-y-4">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <SavingsGrid
                  savings={savings}
                  isLoading={savingsQuery.isLoading}
                  isReadOnly={isReadOnly}
                  onDelete={handleDeleteSavings}
                  onAdd={notifyAddEdit}
                  onEdit={notifyAddEdit}
                />
              </div>
              <Card title="Savings Statistics" subtitle="Account registry summary">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Total Accounts</span>
                    <span className="font-bold text-foreground">{savings.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Active</span>
                    <span className="font-bold text-success">
                      {savings.filter((s) => s.account_status === "Active").length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Total Balance</span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(savings.reduce((sum, s) => sum + s.balance, 0))}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="loans" className="space-y-4">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <LoanGrid
                  loans={loans}
                  isLoading={loansQuery.isLoading}
                  isReadOnly={isReadOnly}
                  onDelete={handleDeleteLoan}
                  onAdd={notifyAddEdit}
                  onEdit={notifyAddEdit}
                />
              </div>
              <Card title="Loan Statistics" subtitle="Portfolio summary">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Total Loans</span>
                    <span className="font-bold text-foreground">{loans.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Performing</span>
                    <span className="font-bold text-success">
                      {loans.filter((l) => l.loan_status === "Performing").length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Total Balance</span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(loans.reduce((sum, l) => sum + l.balance, 0))}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="fixed-deposits" className="space-y-4">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <FixedDepositGrid
                  fixedDeposits={fds}
                  isLoading={fdQuery.isLoading}
                  isReadOnly={isReadOnly}
                  onDelete={handleDeleteFd}
                  onAdd={notifyAddEdit}
                  onEdit={notifyAddEdit}
                />
              </div>
              <Card title="FD Statistics" subtitle="Fixed deposit summary">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Total FDs</span>
                    <span className="font-bold text-foreground">{fds.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Active</span>
                    <span className="font-bold text-success">
                      {fds.filter((f) => f.status === "Active").length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Total Balance</span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(fds.reduce((sum, f) => sum + f.balance, 0))}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};
