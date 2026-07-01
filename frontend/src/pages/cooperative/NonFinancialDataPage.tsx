import { useState } from "react";
import { toast } from "sonner";
import {
  Users,
  PiggyBank,
  HandCoins,
  Landmark,
  Plus,
  Search,
  Download,
  Save,
  Send,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { AppShell, Card, StatusPill } from "@/components/app-shell";
import { useUserRole } from "@/lib/auth";

type Tab = "membership" | "savings" | "loans" | "fixed-deposits";

interface MembershipRecord {
  memberId: string;
  joinDate: string;
  status: "Active" | "Dormant" | "Exited";
  exitDate: string;
  gender: "Male" | "Female" | "Other";
  ageGroup: "<18" | "18-35" | "36-50" | "50+";
  region: string;
  urbanRural: "Urban" | "Rural";
  agmAttendance: boolean;
  leadershipRole: string;
  votingExercised: boolean;
}

interface SavingsRecord {
  savingsAccountId: string;
  memberId: string;
  accountType: "Voluntary" | "Mandatory" | "Fixed";
  accountOpeningDate: string;
  accountStatus: "Active" | "Dormant" | "Closed";
  contributionFrequency: "Weekly" | "Monthly" | "Quarterly" | "Irregular";
  lastContributionDate: string;
  numberOfContributions: number;
  balanceTrend: "Increasing" | "Stable" | "Decreasing";
  zeroBalanceFlag: boolean;
  withdrawalFrequencyCategory: "Low" | "Medium" | "High";
  emergencyWithdrawalsFlag: boolean;
  interestRate: number;
  balance: number;
}

interface LoanRecord {
  loanId: string;
  memberId: string;
  loanProductType: string;
  loanStartDate: string;
  loanMaturityDate: string;
  loanStatus: "Performing" | "Arrears" | "Restructured" | "Written Off";
  borrowerType: string;
  youthBorrowerFlag: boolean;
  womenBorrowerFlag: boolean;
  ruralBorrowerFlag: boolean;
  repaymentRegularity: "Regular" | "Irregular" | "Default";
  daysPastDueCategory: "0" | "1-30" | "31-60" | "61-90" | "91+";
  missedInstallmentsCount: number;
  restructuredLoanFlag: boolean;
  numberOfRestructurings: number;
  earlySettlementFlag: boolean;
  multipleLoansFlag: boolean;
  largeBorrowerFlag: boolean;
  interestRate: number;
  balance: number;
  loanAmount: number;
}

interface FixedDepositRecord {
  fixedDepositId: string;
  memberId: string;
  depositType: "Short-term" | "Medium-term" | "Long-term";
  startDate: string;
  maturityDate: string;
  status: "Active" | "Matured" | "Withdrawn" | "Rolled Over";
  tenureCategory: "<3m" | "3-6m" | "6-12m" | "1-3y" | ">3y";
  originalTenureSelected: string;
  earlyWithdrawalFlag: boolean;
  rolloverAtMaturityFlag: boolean;
  numberOfRenewals: number;
  changeInTenureAtRenewal: boolean;
  singleDepositorDependencyFlag: boolean;
  interestRate: number;
  balance: number;
}

const REGIONS = ["Manzini", "Hhohho", "Shiselweni", "Lubombo"];

export const NonFinancialDataPage: React.FC = () => {
  const role = useUserRole();
  if (!role) return null;
  const [activeTab, setActiveTab] = useState<Tab>("membership");

  const isReadOnly = role === "apex";
  const isCooperative = role === "cooperative";

  // Membership State
  const [membershipRecords, setMembershipRecords] = useState<MembershipRecord[]>([]);
  const [membershipForm, setMembershipForm] = useState<Partial<MembershipRecord>>({
    status: "Active",
    gender: "Female",
    ageGroup: "18-35",
    region: "Manzini",
    urbanRural: "Rural",
    agmAttendance: true,
    votingExercised: true,
    leadershipRole: "",
  });

  // Savings State
  const [savingsRecords, setSavingsRecords] = useState<SavingsRecord[]>([]);
  const [savingsForm, setSavingsForm] = useState<Partial<SavingsRecord>>({
    accountType: "Mandatory",
    accountStatus: "Active",
    contributionFrequency: "Monthly",
    balanceTrend: "Stable",
    withdrawalFrequencyCategory: "Low",
    zeroBalanceFlag: false,
    emergencyWithdrawalsFlag: false,
    interestRate: 4.5,
    numberOfContributions: 0,
    balance: 0,
  });

  // Loans State
  const [loanRecords, setLoanRecords] = useState<LoanRecord[]>([]);
  const [loanForm, setLoanForm] = useState<Partial<LoanRecord>>({
    loanStatus: "Performing",
    repaymentRegularity: "Regular",
    daysPastDueCategory: "0",
    youthBorrowerFlag: false,
    womenBorrowerFlag: false,
    ruralBorrowerFlag: false,
    restructuredLoanFlag: false,
    earlySettlementFlag: false,
    multipleLoansFlag: false,
    largeBorrowerFlag: false,
    numberOfRestructurings: 0,
    missedInstallmentsCount: 0,
    interestRate: 12,
    balance: 0,
    loanAmount: 0,
  });

  // Fixed Deposits State
  const [fdRecords, setFdRecords] = useState<FixedDepositRecord[]>([]);
  const [fdForm, setFdForm] = useState<Partial<FixedDepositRecord>>({
    depositType: "Medium-term",
    status: "Active",
    tenureCategory: "6-12m",
    earlyWithdrawalFlag: false,
    rolloverAtMaturityFlag: false,
    changeInTenureAtRenewal: false,
    singleDepositorDependencyFlag: false,
    numberOfRenewals: 0,
    interestRate: 6,
    balance: 0,
  });

  const handleAddMembership = () => {
    if (!membershipForm.memberId || !membershipForm.joinDate) {
      toast.error("Please fill in Member ID and Join Date");
      return;
    }
    const newRecord: MembershipRecord = {
      memberId: membershipForm.memberId!,
      joinDate: membershipForm.joinDate!,
      status: membershipForm.status || "Active",
      exitDate: membershipForm.exitDate || "",
      gender: membershipForm.gender || "Female",
      ageGroup: membershipForm.ageGroup || "18-35",
      region: membershipForm.region || "Manzini",
      urbanRural: membershipForm.urbanRural || "Rural",
      agmAttendance: membershipForm.agmAttendance ?? true,
      leadershipRole: membershipForm.leadershipRole || "",
      votingExercised: membershipForm.votingExercised ?? true,
    };
    setMembershipRecords([...membershipRecords, newRecord]);
    toast.success(`Member ${newRecord.memberId} added successfully`);
    setMembershipForm({
      status: "Active",
      gender: "Female",
      ageGroup: "18-35",
      region: "Manzini",
      urbanRural: "Rural",
      agmAttendance: true,
      votingExercised: true,
      leadershipRole: "",
    });
  };

  const handleAddSavings = () => {
    if (!savingsForm.savingsAccountId || !savingsForm.memberId) {
      toast.error("Please fill in Savings Account ID and Member ID");
      return;
    }
    const newRecord: SavingsRecord = {
      savingsAccountId: savingsForm.savingsAccountId!,
      memberId: savingsForm.memberId!,
      accountType: savingsForm.accountType || "Mandatory",
      accountOpeningDate: savingsForm.accountOpeningDate || new Date().toISOString().split("T")[0],
      accountStatus: savingsForm.accountStatus || "Active",
      contributionFrequency: savingsForm.contributionFrequency || "Monthly",
      lastContributionDate:
        savingsForm.lastContributionDate || new Date().toISOString().split("T")[0],
      numberOfContributions: savingsForm.numberOfContributions || 0,
      balanceTrend: savingsForm.balanceTrend || "Stable",
      zeroBalanceFlag: savingsForm.zeroBalanceFlag ?? false,
      withdrawalFrequencyCategory: savingsForm.withdrawalFrequencyCategory || "Low",
      emergencyWithdrawalsFlag: savingsForm.emergencyWithdrawalsFlag ?? false,
      interestRate: savingsForm.interestRate || 4.5,
      balance: savingsForm.balance || 0,
    };
    setSavingsRecords([...savingsRecords, newRecord]);
    toast.success(`Savings account ${newRecord.savingsAccountId} added`);
    setSavingsForm({
      accountType: "Mandatory",
      accountStatus: "Active",
      contributionFrequency: "Monthly",
      balanceTrend: "Stable",
      withdrawalFrequencyCategory: "Low",
      zeroBalanceFlag: false,
      emergencyWithdrawalsFlag: false,
      interestRate: 4.5,
      numberOfContributions: 0,
      balance: 0,
    });
  };

  const handleAddLoan = () => {
    if (!loanForm.loanId || !loanForm.memberId || !loanForm.loanAmount) {
      toast.error("Please fill in Loan ID, Member ID, and Loan Amount");
      return;
    }
    const newRecord: LoanRecord = {
      loanId: loanForm.loanId!,
      memberId: loanForm.memberId!,
      loanProductType: loanForm.loanProductType || "Agricultural Input",
      loanStartDate: loanForm.loanStartDate || new Date().toISOString().split("T")[0],
      loanMaturityDate: loanForm.loanMaturityDate || "",
      loanStatus: loanForm.loanStatus || "Performing",
      borrowerType: loanForm.borrowerType || "Farmer",
      youthBorrowerFlag: loanForm.youthBorrowerFlag ?? false,
      womenBorrowerFlag: loanForm.womenBorrowerFlag ?? false,
      ruralBorrowerFlag: loanForm.ruralBorrowerFlag ?? false,
      repaymentRegularity: loanForm.repaymentRegularity || "Regular",
      daysPastDueCategory: loanForm.daysPastDueCategory || "0",
      missedInstallmentsCount: loanForm.missedInstallmentsCount || 0,
      restructuredLoanFlag: loanForm.restructuredLoanFlag ?? false,
      numberOfRestructurings: loanForm.numberOfRestructurings || 0,
      earlySettlementFlag: loanForm.earlySettlementFlag ?? false,
      multipleLoansFlag: loanForm.multipleLoansFlag ?? false,
      largeBorrowerFlag: loanForm.largeBorrowerFlag ?? false,
      interestRate: loanForm.interestRate || 12,
      balance: loanForm.balance || 0,
      loanAmount: loanForm.loanAmount || 0,
    };
    setLoanRecords([...loanRecords, newRecord]);
    toast.success(`Loan ${newRecord.loanId} added successfully`);
    setLoanForm({
      loanStatus: "Performing",
      repaymentRegularity: "Regular",
      daysPastDueCategory: "0",
      youthBorrowerFlag: false,
      womenBorrowerFlag: false,
      ruralBorrowerFlag: false,
      restructuredLoanFlag: false,
      earlySettlementFlag: false,
      multipleLoansFlag: false,
      largeBorrowerFlag: false,
      numberOfRestructurings: 0,
      missedInstallmentsCount: 0,
      interestRate: 12,
      balance: 0,
      loanAmount: 0,
    });
  };

  const handleAddFD = () => {
    if (!fdForm.fixedDepositId || !fdForm.memberId || !fdForm.balance) {
      toast.error("Please fill in FD ID, Member ID, and Balance");
      return;
    }
    const newRecord: FixedDepositRecord = {
      fixedDepositId: fdForm.fixedDepositId!,
      memberId: fdForm.memberId!,
      depositType: fdForm.depositType || "Medium-term",
      startDate: fdForm.startDate || new Date().toISOString().split("T")[0],
      maturityDate: fdForm.maturityDate || "",
      status: fdForm.status || "Active",
      tenureCategory: fdForm.tenureCategory || "6-12m",
      originalTenureSelected: fdForm.originalTenureSelected || "12 months",
      earlyWithdrawalFlag: fdForm.earlyWithdrawalFlag ?? false,
      rolloverAtMaturityFlag: fdForm.rolloverAtMaturityFlag ?? false,
      numberOfRenewals: fdForm.numberOfRenewals || 0,
      changeInTenureAtRenewal: fdForm.changeInTenureAtRenewal ?? false,
      singleDepositorDependencyFlag: fdForm.singleDepositorDependencyFlag ?? false,
      interestRate: fdForm.interestRate || 6,
      balance: fdForm.balance || 0,
    };
    setFdRecords([...fdRecords, newRecord]);
    toast.success(`Fixed Deposit ${newRecord.fixedDepositId} added`);
    setFdForm({
      depositType: "Medium-term",
      status: "Active",
      tenureCategory: "6-12m",
      earlyWithdrawalFlag: false,
      rolloverAtMaturityFlag: false,
      changeInTenureAtRenewal: false,
      singleDepositorDependencyFlag: false,
      numberOfRenewals: 0,
      interestRate: 6,
      balance: 0,
    });
  };

  const formatCurrency = (n: number) => {
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    {
      id: "membership",
      label: "Membership",
      icon: <Users className="size-4" />,
      count: membershipRecords.length,
    },
    {
      id: "savings",
      label: "Savings",
      icon: <PiggyBank className="size-4" />,
      count: savingsRecords.length,
    },
    {
      id: "loans",
      label: "Loans",
      icon: <HandCoins className="size-4" />,
      count: loanRecords.length,
    },
    {
      id: "fixed-deposits",
      label: "Fixed Deposits",
      icon: <Landmark className="size-4" />,
      count: fdRecords.length,
    },
  ];

  return (
    <AppShell
      title="Non-Financial Data Collection"
      subtitle="Membership database, savings accounts, loans registry, and fixed deposits"
    >
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex overflow-x-auto gap-1 pb-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {tab.icon}
                {tab.label}
                <span className="rounded-full bg-background/20 px-2 py-0.5 text-xs">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Membership Tab */}
        {activeTab === "membership" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <Card
              className="lg:col-span-2"
              title="Member Registration"
              subtitle="Add new member to cooperative roster"
              edge="accent"
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddMembership();
                }}
                className="space-y-4"
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Member ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={membershipForm.memberId || ""}
                      onChange={(e) =>
                        setMembershipForm({ ...membershipForm, memberId: e.target.value })
                      }
                      placeholder="M-2024-001"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Join Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={membershipForm.joinDate || ""}
                      onChange={(e) =>
                        setMembershipForm({ ...membershipForm, joinDate: e.target.value })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Status
                    </label>
                    <select
                      value={membershipForm.status || "Active"}
                      onChange={(e) =>
                        setMembershipForm({
                          ...membershipForm,
                          status: e.target.value as MembershipRecord["status"],
                        })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    >
                      <option value="Active">Active</option>
                      <option value="Dormant">Dormant</option>
                      <option value="Exited">Exited</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Gender
                    </label>
                    <select
                      value={membershipForm.gender || "Female"}
                      onChange={(e) =>
                        setMembershipForm({
                          ...membershipForm,
                          gender: e.target.value as MembershipRecord["gender"],
                        })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Age Group
                    </label>
                    <select
                      value={membershipForm.ageGroup || "18-35"}
                      onChange={(e) =>
                        setMembershipForm({
                          ...membershipForm,
                          ageGroup: e.target.value as MembershipRecord["ageGroup"],
                        })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    >
                      <option value="<18">Under 18</option>
                      <option value="18-35">18-35 (Youth)</option>
                      <option value="36-50">36-50</option>
                      <option value="50+">50+</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Region
                    </label>
                    <select
                      value={membershipForm.region || "Manzini"}
                      onChange={(e) =>
                        setMembershipForm({ ...membershipForm, region: e.target.value })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    >
                      {REGIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Urban/Rural
                    </label>
                    <select
                      value={membershipForm.urbanRural || "Rural"}
                      onChange={(e) =>
                        setMembershipForm({
                          ...membershipForm,
                          urbanRural: e.target.value as MembershipRecord["urbanRural"],
                        })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    >
                      <option value="Rural">Rural</option>
                      <option value="Urban">Urban</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={membershipForm.agmAttendance ?? true}
                      onChange={(e) =>
                        setMembershipForm({ ...membershipForm, agmAttendance: e.target.checked })
                      }
                      className="rounded border-border"
                    />
                    AGM Attendance
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={membershipForm.votingExercised ?? true}
                      onChange={(e) =>
                        setMembershipForm({ ...membershipForm, votingExercised: e.target.checked })
                      }
                      className="rounded border-border"
                    />
                    Voting Exercised
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-foreground">
                    Leadership Role (Optional)
                  </label>
                  <input
                    type="text"
                    value={membershipForm.leadershipRole || ""}
                    onChange={(e) =>
                      setMembershipForm({ ...membershipForm, leadershipRole: e.target.value })
                    }
                    placeholder="e.g., Board Member, Secretary"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isReadOnly}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="size-4" />
                    Add Member
                  </button>
                </div>
              </form>
            </Card>

            <Card title="Membership Statistics" subtitle="Current roster summary">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Total Members</span>
                  <span className="font-bold text-foreground">{membershipRecords.length}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Active</span>
                  <span className="font-bold text-success">
                    {membershipRecords.filter((m) => m.status === "Active").length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Women</span>
                  <span className="font-bold text-foreground">
                    {membershipRecords.filter((m) => m.gender === "Female").length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Youth (&lt;35)</span>
                  <span className="font-bold text-foreground">
                    {membershipRecords.filter((m) => m.ageGroup === "18-35").length}
                  </span>
                </div>
              </div>
            </Card>

            {membershipRecords.length > 0 && (
              <Card
                className="lg:col-span-3"
                title="Recent Members"
                subtitle="Recently added members to roster"
              >
                <div className="-mx-5 -mb-5 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        <th className="px-5 py-3">Member ID</th>
                        <th className="px-5 py-3">Join Date</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Gender</th>
                        <th className="px-5 py-3">Age Group</th>
                        <th className="px-5 py-3">Region</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {membershipRecords
                        .slice(-10)
                        .reverse()
                        .map((m) => (
                          <tr key={m.memberId} className="hover:bg-muted/20">
                            <td className="px-5 py-3 font-mono text-xs">{m.memberId}</td>
                            <td className="px-5 py-3">{m.joinDate}</td>
                            <td className="px-5 py-3">
                              <StatusPill
                                tone={
                                  m.status === "Active"
                                    ? "success"
                                    : m.status === "Dormant"
                                      ? "warning"
                                      : "neutral"
                                }
                              >
                                {m.status}
                              </StatusPill>
                            </td>
                            <td className="px-5 py-3">{m.gender}</td>
                            <td className="px-5 py-3">{m.ageGroup}</td>
                            <td className="px-5 py-3">{m.region}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Savings Tab */}
        {activeTab === "savings" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <Card
              className="lg:col-span-2"
              title="Savings Account Registration"
              subtitle="Add new savings account to registry"
              edge="success"
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddSavings();
                }}
                className="space-y-4"
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Account ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={savingsForm.savingsAccountId || ""}
                      onChange={(e) =>
                        setSavingsForm({ ...savingsForm, savingsAccountId: e.target.value })
                      }
                      placeholder="SAV-2024-001"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Member ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={savingsForm.memberId || ""}
                      onChange={(e) => setSavingsForm({ ...savingsForm, memberId: e.target.value })}
                      placeholder="M-2024-001"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Account Type
                    </label>
                    <select
                      value={savingsForm.accountType || "Mandatory"}
                      onChange={(e) =>
                        setSavingsForm({
                          ...savingsForm,
                          accountType: e.target.value as SavingsRecord["accountType"],
                        })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    >
                      <option value="Voluntary">Voluntary</option>
                      <option value="Mandatory">Mandatory</option>
                      <option value="Fixed">Fixed/Term</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Account Status
                    </label>
                    <select
                      value={savingsForm.accountStatus || "Active"}
                      onChange={(e) =>
                        setSavingsForm({
                          ...savingsForm,
                          accountStatus: e.target.value as SavingsRecord["accountStatus"],
                        })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    >
                      <option value="Active">Active</option>
                      <option value="Dormant">Dormant</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Balance ($)
                    </label>
                    <input
                      type="number"
                      value={savingsForm.balance || ""}
                      onChange={(e) =>
                        setSavingsForm({ ...savingsForm, balance: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="10000"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Interest Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={savingsForm.interestRate || ""}
                      onChange={(e) =>
                        setSavingsForm({
                          ...savingsForm,
                          interestRate: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="4.5"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isReadOnly}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="size-4" />
                    Add Account
                  </button>
                </div>
              </form>
            </Card>

            <Card title="Savings Statistics" subtitle="Account registry summary">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Total Accounts</span>
                  <span className="font-bold text-foreground">{savingsRecords.length}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Active</span>
                  <span className="font-bold text-success">
                    {savingsRecords.filter((s) => s.accountStatus === "Active").length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Total Balance</span>
                  <span className="font-bold text-foreground">
                    {formatCurrency(savingsRecords.reduce((sum, s) => sum + s.balance, 0))}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Loans Tab */}
        {activeTab === "loans" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <Card
              className="lg:col-span-2"
              title="Loan Registration"
              subtitle="Add new loan to registry"
              edge="warning"
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddLoan();
                }}
                className="space-y-4"
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Loan ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={loanForm.loanId || ""}
                      onChange={(e) => setLoanForm({ ...loanForm, loanId: e.target.value })}
                      placeholder="LOAN-2024-001"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Member ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={loanForm.memberId || ""}
                      onChange={(e) => setLoanForm({ ...loanForm, memberId: e.target.value })}
                      placeholder="M-2024-001"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Loan Amount ($) *
                    </label>
                    <input
                      type="number"
                      required
                      value={loanForm.loanAmount || ""}
                      onChange={(e) =>
                        setLoanForm({ ...loanForm, loanAmount: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="15000"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Current Balance ($)
                    </label>
                    <input
                      type="number"
                      value={loanForm.balance || ""}
                      onChange={(e) =>
                        setLoanForm({ ...loanForm, balance: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="12000"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Loan Status
                    </label>
                    <select
                      value={loanForm.loanStatus || "Performing"}
                      onChange={(e) =>
                        setLoanForm({
                          ...loanForm,
                          loanStatus: e.target.value as LoanRecord["loanStatus"],
                        })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    >
                      <option value="Performing">Performing</option>
                      <option value="Arrears">Arrears</option>
                      <option value="Restructured">Restructured</option>
                      <option value="Written Off">Written Off</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Days Past Due
                    </label>
                    <select
                      value={loanForm.daysPastDueCategory || "0"}
                      onChange={(e) =>
                        setLoanForm({
                          ...loanForm,
                          daysPastDueCategory: e.target.value as LoanRecord["daysPastDueCategory"],
                        })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    >
                      <option value="0">0 (Current)</option>
                      <option value="1-30">1-30 days</option>
                      <option value="31-60">31-60 days</option>
                      <option value="61-90">61-90 days</option>
                      <option value="91+">91+ days</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={loanForm.womenBorrowerFlag ?? false}
                      onChange={(e) =>
                        setLoanForm({ ...loanForm, womenBorrowerFlag: e.target.checked })
                      }
                      className="rounded border-border"
                    />
                    Women Borrower
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={loanForm.youthBorrowerFlag ?? false}
                      onChange={(e) =>
                        setLoanForm({ ...loanForm, youthBorrowerFlag: e.target.checked })
                      }
                      className="rounded border-border"
                    />
                    Youth Borrower
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={loanForm.ruralBorrowerFlag ?? false}
                      onChange={(e) =>
                        setLoanForm({ ...loanForm, ruralBorrowerFlag: e.target.checked })
                      }
                      className="rounded border-border"
                    />
                    Rural Borrower
                  </label>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isReadOnly}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="size-4" />
                    Add Loan
                  </button>
                </div>
              </form>
            </Card>

            <Card title="Loan Statistics" subtitle="Portfolio summary">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Total Loans</span>
                  <span className="font-bold text-foreground">{loanRecords.length}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Performing</span>
                  <span className="font-bold text-success">
                    {loanRecords.filter((l) => l.loanStatus === "Performing").length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Total Balance</span>
                  <span className="font-bold text-foreground">
                    {formatCurrency(loanRecords.reduce((sum, l) => sum + l.balance, 0))}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Fixed Deposits Tab */}
        {activeTab === "fixed-deposits" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <Card
              className="lg:col-span-2"
              title="Fixed Deposit Registration"
              subtitle="Add new fixed deposit account"
              edge="info"
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddFD();
                }}
                className="space-y-4"
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      FD ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={fdForm.fixedDepositId || ""}
                      onChange={(e) => setFdForm({ ...fdForm, fixedDepositId: e.target.value })}
                      placeholder="FD-2024-001"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Member ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={fdForm.memberId || ""}
                      onChange={(e) => setFdForm({ ...fdForm, memberId: e.target.value })}
                      placeholder="M-2024-001"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Deposit Type
                    </label>
                    <select
                      value={fdForm.depositType || "Medium-term"}
                      onChange={(e) =>
                        setFdForm({
                          ...fdForm,
                          depositType: e.target.value as FixedDepositRecord["depositType"],
                        })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    >
                      <option value="Short-term">Short-term</option>
                      <option value="Medium-term">Medium-term</option>
                      <option value="Long-term">Long-term</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Tenure
                    </label>
                    <select
                      value={fdForm.tenureCategory || "6-12m"}
                      onChange={(e) =>
                        setFdForm({
                          ...fdForm,
                          tenureCategory: e.target.value as FixedDepositRecord["tenureCategory"],
                        })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    >
                      <option value="<3m">Less than 3 months</option>
                      <option value="3-6m">3-6 months</option>
                      <option value="6-12m">6-12 months</option>
                      <option value="1-3y">1-3 years</option>
                      <option value=">3y">More than 3 years</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Balance ($) *
                    </label>
                    <input
                      type="number"
                      required
                      value={fdForm.balance || ""}
                      onChange={(e) =>
                        setFdForm({ ...fdForm, balance: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="25000"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Interest Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={fdForm.interestRate || ""}
                      onChange={(e) =>
                        setFdForm({ ...fdForm, interestRate: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="6.5"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={fdForm.rolloverAtMaturityFlag ?? false}
                      onChange={(e) =>
                        setFdForm({ ...fdForm, rolloverAtMaturityFlag: e.target.checked })
                      }
                      className="rounded border-border"
                    />
                    Rollover at Maturity
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={fdForm.earlyWithdrawalFlag ?? false}
                      onChange={(e) =>
                        setFdForm({ ...fdForm, earlyWithdrawalFlag: e.target.checked })
                      }
                      className="rounded border-border"
                    />
                    Early Withdrawal
                  </label>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isReadOnly}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="size-4" />
                    Add FD
                  </button>
                </div>
              </form>
            </Card>

            <Card title="FD Statistics" subtitle="Fixed deposit summary">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Total FDs</span>
                  <span className="font-bold text-foreground">{fdRecords.length}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Active</span>
                  <span className="font-bold text-success">
                    {fdRecords.filter((f) => f.status === "Active").length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Total Balance</span>
                  <span className="font-bold text-foreground">
                    {formatCurrency(fdRecords.reduce((sum, f) => sum + f.balance, 0))}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
};
