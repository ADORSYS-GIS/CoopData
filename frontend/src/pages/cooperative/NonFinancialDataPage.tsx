import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
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
import { FarmCoopGrid } from "@/components/non-financial/FarmCoopGrid";
import { useMembers, useDeleteMember } from "@/hooks/non-financial/useMembers";
import { useSavings, useDeleteSavings } from "@/hooks/non-financial/useSavings";
import { useLoans, useDeleteLoan } from "@/hooks/non-financial/useLoans";
import { useFixedDeposits, useDeleteFixedDeposit } from "@/hooks/non-financial/useFixedDeposits";
import { useFarmCoops, useDeleteFarmCoop } from "@/hooks/non-financial/useFarmCoop";
import type { NfUploadResponse } from "@/types/non-financial";

function formatCurrency(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export const NonFinancialDataPage: React.FC = () => {
  const { t } = useTranslation();
  const role = useUserRole();
  const isReadOnly = role === "apex";
  const [uploadResult, setUploadResult] = useState<NfUploadResponse | null>(null);

  const membersQuery = useMembers({ page: 1, page_size: 100 });
  const savingsQuery = useSavings({ page: 1, page_size: 100 });
  const loansQuery = useLoans({ page: 1, page_size: 100 });
  const fdQuery = useFixedDeposits({ page: 1, page_size: 100 });
  const farmCoopQuery = useFarmCoops({ page: 1, page_size: 100 });

  const deleteMember = useDeleteMember();
  const deleteSavings = useDeleteSavings();
  const deleteLoan = useDeleteLoan();
  const deleteFd = useDeleteFixedDeposit();
  const deleteFarmCoop = useDeleteFarmCoop();

  if (!role) return null;

  const members = membersQuery.data?.data ?? [];
  const savings = savingsQuery.data?.data ?? [];
  const loans = loansQuery.data?.data ?? [];
  const fds = fdQuery.data?.data ?? [];
  const farmCoops = farmCoopQuery.data?.data ?? [];

  const handleDeleteMember = async (id: string) => {
    try {
      await deleteMember.mutateAsync(id);
      toast.success(t("nonFinancialData.toastMemberDeleted"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("nonFinancialData.toastMemberDeleteFailed"),
      );
    }
  };

  const handleDeleteSavings = async (id: string) => {
    try {
      await deleteSavings.mutateAsync(id);
      toast.success(t("nonFinancialData.toastSavingsDeleted"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("nonFinancialData.toastSavingsDeleteFailed"),
      );
    }
  };

  const handleDeleteLoan = async (id: string) => {
    try {
      await deleteLoan.mutateAsync(id);
      toast.success(t("nonFinancialData.toastLoanDeleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("nonFinancialData.toastLoanDeleteFailed"));
    }
  };

  const handleDeleteFd = async (id: string) => {
    try {
      await deleteFd.mutateAsync(id);
      toast.success(t("nonFinancialData.toastFdDeleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("nonFinancialData.toastFdDeleteFailed"));
    }
  };

  const handleDeleteFarmCoop = async (id: string) => {
    try {
      await deleteFarmCoop.mutateAsync(id);
      toast.success(t("nonFinancialData.toastFarmDeleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("nonFinancialData.toastFarmDeleteFailed"));
    }
  };

  const notifyAddEdit = () => toast.info(t("nonFinancialData.toastBulkHint"));

  return (
    <AppShell title={t("nonFinancialData.title")} subtitle={t("nonFinancialData.subtitle")}>
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
              {t("nonFinancialData.tabMembership")}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{members.length}</span>
            </TabsTrigger>
            <TabsTrigger value="savings" className="flex items-center gap-2">
              <PiggyBank className="size-4" />
              {t("nonFinancialData.tabSavings")}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{savings.length}</span>
            </TabsTrigger>
            <TabsTrigger value="loans" className="flex items-center gap-2">
              <HandCoins className="size-4" />
              {t("nonFinancialData.tabLoans")}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{loans.length}</span>
            </TabsTrigger>
            <TabsTrigger value="fixed-deposits" className="flex items-center gap-2">
              <Landmark className="size-4" />
              {t("nonFinancialData.tabFixedDeposits")}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{fds.length}</span>
            </TabsTrigger>
            <TabsTrigger value="farm-coop" className="flex items-center gap-2">
              <HandCoins className="size-4" />
              {t("nonFinancialData.tabFarmCoop")}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{farmCoops.length}</span>
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
                  onEdit={notifyAddEdit}
                />
              </div>
              <Card
                title={t("nonFinancialData.membershipStats")}
                subtitle={t("nonFinancialData.membershipRoster")}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      {t("nonFinancialData.totalMembers")}
                    </span>
                    <span className="font-bold text-foreground">{members.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      {t("nonFinancialData.active")}
                    </span>
                    <span className="font-bold text-success">
                      {members.filter((m) => m.status === "Active").length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      {t("nonFinancialData.women")}
                    </span>
                    <span className="font-bold text-foreground">
                      {members.filter((m) => m.gender === "Female").length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      {t("nonFinancialData.youth")}
                    </span>
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
                  onEdit={notifyAddEdit}
                />
              </div>
              <Card
                title={t("nonFinancialData.savingsStats")}
                subtitle={t("nonFinancialData.savingsRegistry")}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      {t("nonFinancialData.totalAccounts")}
                    </span>
                    <span className="font-bold text-foreground">{savings.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      {t("nonFinancialData.active")}
                    </span>
                    <span className="font-bold text-success">
                      {savings.filter((s) => s.account_status === "Active").length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      {t("nonFinancialData.totalBalance")}
                    </span>
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
                  onEdit={notifyAddEdit}
                />
              </div>
              <Card
                title={t("nonFinancialData.loanStats")}
                subtitle={t("nonFinancialData.portfolioSummary")}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      {t("nonFinancialData.totalLoans")}
                    </span>
                    <span className="font-bold text-foreground">{loans.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      {t("nonFinancialData.performing")}
                    </span>
                    <span className="font-bold text-success">
                      {loans.filter((l) => l.loan_status === "Performing").length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      {t("nonFinancialData.totalBalance")}
                    </span>
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
                  onEdit={notifyAddEdit}
                />
              </div>
              <Card
                title={t("nonFinancialData.fdStats")}
                subtitle={t("nonFinancialData.fdSummary")}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      {t("nonFinancialData.totalFds")}
                    </span>
                    <span className="font-bold text-foreground">{fds.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      {t("nonFinancialData.active")}
                    </span>
                    <span className="font-bold text-success">
                      {fds.filter((f) => f.status === "Active").length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      {t("nonFinancialData.totalBalance")}
                    </span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(fds.reduce((sum, f) => sum + f.balance, 0))}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="farm-coop" className="space-y-4">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <FarmCoopGrid
                  farmCoops={farmCoops}
                  isLoading={farmCoopQuery.isLoading}
                  isReadOnly={isReadOnly}
                  onDelete={handleDeleteFarmCoop}
                  onEdit={notifyAddEdit}
                />
              </div>
              <Card
                title={t("nonFinancialData.farmStats")}
                subtitle={t("nonFinancialData.farmSummary")}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      {t("nonFinancialData.totalCoops")}
                    </span>
                    <span className="font-bold text-foreground">{farmCoops.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      {t("nonFinancialData.active")}
                    </span>
                    <span className="font-bold text-success">
                      {farmCoops.filter((f) => f.operational_status === "Active").length}
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
