// Centralized mock data for CoopData. Replace with API calls once Cloud is enabled.

export const KPI = {
  totalCoops: 12842,
  activeCoops: 11420,
  inactiveCoops: 1422,
  totalMembers: 2_412_300,
  womenShare: 0.541,
  youthShare: 0.378,
  loanPortfolio: 842_100_000, // USD
  savingsPortfolio: 1_204_000_000,
  growthYoY: 0.072,
  complianceScore: 92.4,
  complianceTrend: -0.4,
};

export const GROWTH_TREND = [
  { month: "Jan", members: 1820000, savings: 980, loans: 612 },
  { month: "Feb", members: 2150000, savings: 1120, loans: 490 },
  { month: "Mar", members: 1910000, savings: 940, loans: 780 },
  { month: "Apr", members: 2320000, savings: 1250, loans: 520 },
  { month: "May", members: 1740000, savings: 890, loans: 890 },
  { month: "Jun", members: 2280000, savings: 1190, loans: 440 },
  { month: "Jul", members: 2090000, savings: 1080, loans: 758 },
  { month: "Aug", members: 2450000, savings: 1310, loans: 590 },
  { month: "Sep", members: 1850000, savings: 950, loans: 820 },
  { month: "Oct", members: 2280000, savings: 1210, loans: 480 },
  { month: "Nov", members: 1990000, savings: 1040, loans: 810 },
  { month: "Dec", members: 2412300, savings: 1280, loans: 842 },
];

export const SECTOR_BREAKDOWN = [
  { name: "Agricultural Unions", value: 42, count: 5394 },
  { name: "Financial SACCOs", value: 31, count: 3981 },
  { name: "Housing Groups", value: 11, count: 1413 },
  { name: "Transport Unions", value: 9, count: 1156 },
  { name: "Artisans & Manufacturing", value: 7, count: 898 },
];

export const REGIONS = [
  { code: "HH", name: "Hhohho", coops: 3120, members: 612_400, compliance: 94.1, growth: 5.2 },
  { code: "MN", name: "Manzini", coops: 4480, members: 891_200, compliance: 91.3, growth: 6.8 },
  { code: "SH", name: "Shiselweni", coops: 2104, members: 411_500, compliance: 88.7, growth: 3.4 },
  { code: "LB", name: "Lubombo", coops: 3138, members: 497_200, compliance: 93.2, growth: 4.9 },
];

export type Cooperative = {
  id: string;
  regNo: string;
  name: string;
  sector: string;
  region: string;
  members: number;
  portfolio: number; // USD
  compliance: "Verified" | "Pending" | "Non-Compliant" | "Under Review";
  status: "Active" | "Inactive" | "Suspended";
  registeredOn: string;
};

export const COOPERATIVES: Cooperative[] = [
  {
    id: "1",
    regNo: "COP-2018-04921",
    name: "Lakeside Agricultural Union",
    sector: "Agriculture",
    region: "Manzini",
    members: 12_402,
    portfolio: 14_200_000,
    compliance: "Verified",
    status: "Active",
    registeredOn: "2018-03-12",
  },
  {
    id: "2",
    regNo: "COP-2019-03182",
    name: "Central Transport SACCO",
    sector: "Transport",
    region: "Hhohho",
    members: 4_820,
    portfolio: 3_100_000,
    compliance: "Pending",
    status: "Active",
    registeredOn: "2019-08-04",
  },
  {
    id: "3",
    regNo: "COP-2016-01094",
    name: "Sunrise Savings & Credit",
    sector: "Finance",
    region: "Manzini",
    members: 18_240,
    portfolio: 42_800_000,
    compliance: "Verified",
    status: "Active",
    registeredOn: "2016-01-22",
  },
  {
    id: "4",
    regNo: "COP-2020-08812",
    name: "Northern Artisans Guild",
    sector: "Manufacturing",
    region: "Hhohho",
    members: 1_204,
    portfolio: 412_000,
    compliance: "Non-Compliant",
    status: "Suspended",
    registeredOn: "2020-11-30",
  },
  {
    id: "5",
    regNo: "COP-2015-00214",
    name: "Lubombo Dairy Federation",
    sector: "Agriculture",
    region: "Lubombo",
    members: 8_910,
    portfolio: 6_400_000,
    compliance: "Verified",
    status: "Active",
    registeredOn: "2015-06-18",
  },
  {
    id: "6",
    regNo: "COP-2021-09011",
    name: "Shiselweni Coffee Coop",
    sector: "Agriculture",
    region: "Shiselweni",
    members: 2_412,
    portfolio: 980_000,
    compliance: "Under Review",
    status: "Active",
    registeredOn: "2021-02-09",
  },
  {
    id: "7",
    regNo: "COP-2017-02488",
    name: "Unity Housing Federation",
    sector: "Housing",
    region: "Manzini",
    members: 6_120,
    portfolio: 9_800_000,
    compliance: "Verified",
    status: "Active",
    registeredOn: "2017-09-14",
  },
  {
    id: "8",
    regNo: "COP-2022-10433",
    name: "Highveld Womens Trust",
    sector: "Finance",
    region: "Hhohho",
    members: 3_840,
    portfolio: 1_240_000,
    compliance: "Verified",
    status: "Active",
    registeredOn: "2022-05-21",
  },
  {
    id: "9",
    regNo: "COP-2019-04772",
    name: "Eastern Grain Collective",
    sector: "Agriculture",
    region: "Lubombo",
    members: 14_021,
    portfolio: 11_900_000,
    compliance: "Pending",
    status: "Active",
    registeredOn: "2019-04-02",
  },
  {
    id: "10",
    regNo: "COP-2014-00088",
    name: "National Teachers SACCO",
    sector: "Finance",
    region: "Manzini",
    members: 24_910,
    portfolio: 88_400_000,
    compliance: "Verified",
    status: "Active",
    registeredOn: "2014-10-01",
  },
];

export type Submission = {
  id: string;
  reference: string;
  coopName: string;
  type: string;
  submittedBy: string;
  submittedOn: string;
  status: "Verified" | "Pending Review" | "Rejected" | "Resubmit";
  priority: "Routine" | "Quarterly" | "Annual" | "Urgent";
};

export const SUBMISSIONS: Submission[] = [
  {
    id: "s1",
    reference: "SUB-2025-09082",
    coopName: "Lakeside Agricultural Union",
    type: "Q3 Financial Audit",
    submittedBy: "M. Dlamini",
    submittedOn: "2025-10-24 14:22",
    status: "Verified",
    priority: "Quarterly",
  },
  {
    id: "s2",
    reference: "SUB-2025-09083",
    coopName: "Central Transport SACCO",
    type: "Membership Roster Update",
    submittedBy: "T. Nkosi",
    submittedOn: "2025-10-24 11:05",
    status: "Pending Review",
    priority: "Routine",
  },
  {
    id: "s3",
    reference: "SUB-2025-09084",
    coopName: "Sunrise Savings & Credit",
    type: "Annual Compliance Filing",
    submittedBy: "P. Khumalo",
    submittedOn: "2025-10-23 16:45",
    status: "Verified",
    priority: "Annual",
  },
  {
    id: "s4",
    reference: "SUB-2025-09085",
    coopName: "Northern Artisans Guild",
    type: "Reserves Disclosure",
    submittedBy: "S. Maseko",
    submittedOn: "2025-10-23 09:12",
    status: "Rejected",
    priority: "Urgent",
  },
  {
    id: "s5",
    reference: "SUB-2025-09086",
    coopName: "Lubombo Dairy Federation",
    type: "Loan Portfolio Report",
    submittedBy: "B. Hlatshwayo",
    submittedOn: "2025-10-22 17:34",
    status: "Verified",
    priority: "Quarterly",
  },
  {
    id: "s6",
    reference: "SUB-2025-09087",
    coopName: "Shiselweni Coffee Coop",
    type: "New Branch Registration",
    submittedBy: "N. Simelane",
    submittedOn: "2025-10-22 10:01",
    status: "Resubmit",
    priority: "Routine",
  },
];

export const ALERTS = [
  {
    id: "a1",
    severity: "high" as const,
    title: "Missing Q3 submission",
    coop: "Northern Artisans Guild",
    deadline: "Oct 14, 2025",
  },
  {
    id: "a2",
    severity: "medium" as const,
    title: "Audit discrepancy detected",
    coop: "Central Transport SACCO",
    deadline: "Review required",
  },
  {
    id: "a3",
    severity: "low" as const,
    title: "Renewal due in 30 days",
    coop: "Highveld Womens Trust",
    deadline: "Nov 21, 2025",
  },
];

export const ACTIVITY_FEED = [
  {
    id: "f1",
    initials: "AGR",
    type: "submission",
    title: "Green Valley Farmers Coop",
    detail: "Q3 Financial Audit submitted",
    time: "2m ago",
    tone: "success" as const,
  },
  {
    id: "f2",
    initials: "SAV",
    type: "update",
    title: "Apex Savings & Credit",
    detail: "Member registration updated (+412)",
    time: "14m ago",
    tone: "info" as const,
  },
  {
    id: "f3",
    initials: "FED",
    type: "alert",
    title: "National Transport Union",
    detail: "Compliance flag triggered — reserves below threshold",
    time: "1h ago",
    tone: "warning" as const,
  },
  {
    id: "f4",
    initials: "LOG",
    type: "registration",
    title: "Regional Logistics Hub",
    detail: "New cooperative registration approved",
    time: "3h ago",
    tone: "neutral" as const,
  },
  {
    id: "f5",
    initials: "USR",
    type: "auth",
    title: "Federation Officer access granted",
    detail: "T. Mahlangu — Manzini Federation",
    time: "5h ago",
    tone: "neutral" as const,
  },
];

export const INTEGRATIONS = [
  {
    id: "i1",
    name: "Mambu Core Banking",
    category: "Financial systems",
    status: "Connected" as const,
    lastSync: "2 min ago",
    records: "1.2M",
  },
  {
    id: "i2",
    name: "Ministry Identity Bridge",
    category: "Government identity",
    status: "Connected" as const,
    lastSync: "12 min ago",
    records: "412K",
  },
  {
    id: "i3",
    name: "National Statistics API",
    category: "Public data",
    status: "Connected" as const,
    lastSync: "1 h ago",
    records: "—",
  },
  {
    id: "i4",
    name: "Bulk CSV Import Pipeline",
    category: "Data ingestion",
    status: "Idle" as const,
    lastSync: "Yesterday",
    records: "84K queued",
  },
  {
    id: "i5",
    name: "Federation SMS Gateway",
    category: "Notifications",
    status: "Degraded" as const,
    lastSync: "4 h ago",
    records: "—",
  },
];

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  region: string;
  lastActive: string;
  status: "Active" | "Suspended";
};

export const USERS: User[] = [
  {
    id: "u1",
    name: "Thabo Nkosi",
    email: "t.nkosi@gov.sz",
    role: "Ministry Official",
    region: "National",
    lastActive: "Just now",
    status: "Active" as const,
  },
  {
    id: "u2",
    name: "Phindile Khumalo",
    email: "p.khumalo@manzini-fed.org",
    role: "Federation Officer",
    region: "Manzini",
    lastActive: "2 h ago",
    status: "Active" as const,
  },
  {
    id: "u3",
    name: "Bongani Hlatshwayo",
    email: "b.hlat@lubombo-dairy.coop",
    role: "Cooperative Manager",
    region: "Lubombo",
    lastActive: "Yesterday",
    status: "Active" as const,
  },
  {
    id: "u4",
    name: "Moses Dlamini",
    email: "m.dlamini@gov.sz",
    role: "Apex Officer",
    region: "Hhohho",
    lastActive: "3 h ago",
    status: "Active" as const,
  },
  {
    id: "u5",
    name: "Nomcebo Dlamini",
    email: "n.dlamini@gov.sz",
    role: "Apex Officer",
    region: "Shiselweni",
    lastActive: "1 d ago",
    status: "Active" as const,
  },
  {
    id: "u6",
    name: "Sipho Maseko",
    email: "s.maseko@manzini-fed.org",
    role: "Federation Officer",
    region: "Manzini",
    lastActive: "5 h ago",
    status: "Active" as const,
  },
];

export const REPORTS = [
  {
    id: "r1",
    title: "National Cooperative Snapshot — Q3 2025",
    category: "National",
    format: "PDF",
    size: "4.2 MB",
    updated: "Oct 24, 2025",
  },
  {
    id: "r2",
    title: "Women & Youth Participation Index",
    category: "Gender",
    format: "PDF",
    size: "2.1 MB",
    updated: "Oct 18, 2025",
  },
  {
    id: "r3",
    title: "Loan Portfolio Stress Test",
    category: "Financial",
    format: "XLSX",
    size: "8.4 MB",
    updated: "Oct 15, 2025",
  },
  {
    id: "r4",
    title: "Regional Performance — Manzini",
    category: "Regional",
    format: "PDF",
    size: "3.7 MB",
    updated: "Oct 12, 2025",
  },
  {
    id: "r5",
    title: "Sector Compliance Dashboard Export",
    category: "Compliance",
    format: "CSV",
    size: "1.1 MB",
    updated: "Oct 10, 2025",
  },
  {
    id: "r6",
    title: "Agricultural Sector Annual Review",
    category: "Sector",
    format: "DOCX",
    size: "5.9 MB",
    updated: "Sep 30, 2025",
  },
];

// ============================================================================
// FEDERATION DATA
// ============================================================================

export type Federation = {
  id: string;
  regNo: string;
  name: string;
  region: string;
  apexCount: number;
  coopCount: number;
  totalMembers: number;
  totalPortfolio: number;
  compliance: "Verified" | "Pending" | "Non-Compliant" | "Under Review";
  status: "Active" | "Inactive" | "Suspended";
  registeredOn: string;
};

export const FEDERATIONS: Federation[] = [
  {
    id: "f1",
    regNo: "FED-2012-001",
    name: "Manzini Regional Federation",
    region: "Manzini",
    apexCount: 4,
    coopCount: 4480,
    totalMembers: 891_200,
    totalPortfolio: 342_000_000,
    compliance: "Verified",
    status: "Active",
    registeredOn: "2012-03-15",
  },
  {
    id: "f2",
    regNo: "FED-2013-002",
    name: "Hhohho Regional Federation",
    region: "Hhohho",
    apexCount: 3,
    coopCount: 3120,
    totalMembers: 612_400,
    totalPortfolio: 218_000_000,
    compliance: "Verified",
    status: "Active",
    registeredOn: "2013-06-22",
  },
  {
    id: "f3",
    regNo: "FED-2014-003",
    name: "Shiselweni Regional Federation",
    region: "Shiselweni",
    apexCount: 2,
    coopCount: 2104,
    totalMembers: 411_500,
    totalPortfolio: 98_000_000,
    compliance: "Pending",
    status: "Active",
    registeredOn: "2014-01-10",
  },
  {
    id: "f4",
    regNo: "FED-2011-004",
    name: "Lubombo Regional Federation",
    region: "Lubombo",
    apexCount: 3,
    coopCount: 3138,
    totalMembers: 497_200,
    totalPortfolio: 184_000_000,
    compliance: "Verified",
    status: "Active",
    registeredOn: "2011-09-01",
  },
];

// ============================================================================
// APEX DATA
// ============================================================================

export type Apex = {
  id: string;
  regNo: string;
  name: string;
  region: string;
  federationName: string;
  coopCount: number;
  totalMembers: number;
  totalPortfolio: number;
  compliance: "Verified" | "Pending" | "Non-Compliant" | "Under Review";
  status: "Active" | "Inactive" | "Suspended";
  registeredOn: string;
};

export const APEXES: Apex[] = [
  {
    id: "a1",
    regNo: "APX-2015-001",
    name: "Manzini Agricultural Apex",
    region: "Manzini",
    federationName: "Manzini Regional Federation",
    coopCount: 1240,
    totalMembers: 245_000,
    totalPortfolio: 98_000_000,
    compliance: "Verified",
    status: "Active",
    registeredOn: "2015-04-12",
  },
  {
    id: "a2",
    regNo: "APX-2016-002",
    name: "Manzini Financial Apex",
    region: "Manzini",
    federationName: "Manzini Regional Federation",
    coopCount: 890,
    totalMembers: 198_000,
    totalPortfolio: 142_000_000,
    compliance: "Verified",
    status: "Active",
    registeredOn: "2016-08-20",
  },
  {
    id: "a3",
    regNo: "APX-2014-003",
    name: "Hhohho Multi-Purpose Apex",
    region: "Hhohho",
    federationName: "Hhohho Regional Federation",
    coopCount: 1560,
    totalMembers: 312_000,
    totalPortfolio: 118_000_000,
    compliance: "Verified",
    status: "Active",
    registeredOn: "2014-11-05",
  },
  {
    id: "a4",
    regNo: "APX-2017-004",
    name: "Hhohho Savings & Credit Apex",
    region: "Hhohho",
    federationName: "Hhohho Regional Federation",
    coopCount: 1560,
    totalMembers: 300_400,
    totalPortfolio: 100_000_000,
    compliance: "Under Review",
    status: "Active",
    registeredOn: "2017-02-18",
  },
  {
    id: "a5",
    regNo: "APX-2016-005",
    name: "Shiselweni Farmers Apex",
    region: "Shiselweni",
    federationName: "Shiselweni Regional Federation",
    coopCount: 1204,
    totalMembers: 231_500,
    totalPortfolio: 52_000_000,
    compliance: "Pending",
    status: "Active",
    registeredOn: "2016-05-30",
  },
  {
    id: "a6",
    regNo: "APX-2013-006",
    name: "Lubombo Dairy & Agriculture Apex",
    region: "Lubombo",
    federationName: "Lubombo Regional Federation",
    coopCount: 1680,
    totalMembers: 298_000,
    totalPortfolio: 104_000_000,
    compliance: "Verified",
    status: "Active",
    registeredOn: "2013-07-14",
  },
  {
    id: "a7",
    regNo: "APX-2018-007",
    name: "Lubombo Transport & Trade Apex",
    region: "Lubombo",
    federationName: "Lubombo Regional Federation",
    coopCount: 1458,
    totalMembers: 199_200,
    totalPortfolio: 80_000_000,
    compliance: "Verified",
    status: "Active",
    registeredOn: "2018-09-22",
  },
];

export function formatCurrency(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

export function formatNumber(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

// ============================================================================
// FINANCIAL STATEMENT SAMPLE DATA
// ============================================================================

import type {
  BalanceSheet,
  MemberRecord,
  SavingsAccount,
  LoanRecord,
  FixedDepositRecord,
} from "./financial-data";

export const SAMPLE_BALANCE_SHEETS: Record<string, BalanceSheet> = {
  "lubombo-dairy": {
    reportingPeriod: "2024-12",
    cooperativeId: "5",
    cooperativeName: "Lubombo Dairy Federation",
    submissionDate: "2024-12-31",
    currency: "SZL",
    accountingYear: "calendar",
    liquidAssets: {
      cashOnHand: 50000,
      cashAtBankCurrent: 320000,
      cashAtBankSavings: 180000,
      shortTermInvestments: 150000,
    },
    loanPortfolio: {
      performingLoanPortfolio: 4200000,
      loansInArrears_1_30: 280000,
      loansInArrears_31_60: 120000,
      loansInArrears_61_90: 60000,
      nonPerformingLoans: 40000,
    },
    loanLossProvisions: {
      generalLoanLossProvision: 85000,
      specificLoanLossProvision: 45000,
    },
    otherAssets: {
      accountsReceivable: 85000,
      prepaidExpenses: 25000,
      fixedAssetsCost: 1200000,
      accumulatedDepreciation: -420000,
      intangibleAssets: 35000,
    },
    memberDeposits: {
      voluntarySavings: 2100000,
      mandatorySavings: 1400000,
      fixedTermDeposits: 800000,
    },
    borrowings: {
      shortTermBorrowings: 200000,
      longTermBorrowings: 350000,
    },
    otherLiabilities: {
      accountsPayable: 75000,
      accruedExpenses: 45000,
      deferredIncome: 25000,
    },
    memberShares: {
      permanentShareCapital: 1500000,
      withdrawableShares: 600000,
    },
    reserves: {
      statutoryReserve: 450000,
      generalReserve: 320000,
      riskCapitalAdequacyReserve: 180000,
    },
    retainedEarnings: {
      accumulatedSurplus: 280000,
      currentYearSurplus: 95000,
    },
    financialIncome: {
      interestIncomeLoans: 620000,
      feesCommissionsIncome: 85000,
    },
    otherIncome: {
      otherOperatingIncome: 45000,
    },
    financialExpenses: {
      interestExpenseDeposits: 180000,
      interestExpenseBorrowings: 42000,
    },
    operatingExpenses: {
      personnelCosts: 185000,
      administrativeExpenses: 95000,
      governanceExpenses: 28000,
      depreciationAmortization: 65000,
    },
    creditLossExpense: 55000,
  },
  "sunrise-savings": {
    reportingPeriod: "2024-12",
    cooperativeId: "3",
    cooperativeName: "Sunrise Savings & Credit",
    submissionDate: "2024-12-31",
    currency: "SZL",
    accountingYear: "calendar",
    liquidAssets: {
      cashOnHand: 85000,
      cashAtBankCurrent: 680000,
      cashAtBankSavings: 420000,
      shortTermInvestments: 250000,
    },
    loanPortfolio: {
      performingLoanPortfolio: 28500000,
      loansInArrears_1_30: 1200000,
      loansInArrears_31_60: 650000,
      loansInArrears_61_90: 350000,
      nonPerformingLoans: 200000,
    },
    loanLossProvisions: {
      generalLoanLossProvision: 420000,
      specificLoanLossProvision: 180000,
    },
    otherAssets: {
      accountsReceivable: 180000,
      prepaidExpenses: 45000,
      fixedAssetsCost: 2800000,
      accumulatedDepreciation: -980000,
      intangibleAssets: 120000,
    },
    memberDeposits: {
      voluntarySavings: 14200000,
      mandatorySavings: 8600000,
      fixedTermDeposits: 3200000,
    },
    borrowings: {
      shortTermBorrowings: 450000,
      longTermBorrowings: 0,
    },
    otherLiabilities: {
      accountsPayable: 125000,
      accruedExpenses: 85000,
      deferredIncome: 45000,
    },
    memberShares: {
      permanentShareCapital: 4500000,
      withdrawableShares: 1800000,
    },
    reserves: {
      statutoryReserve: 1200000,
      generalReserve: 850000,
      riskCapitalAdequacyReserve: 450000,
    },
    retainedEarnings: {
      accumulatedSurplus: 650000,
      currentYearSurplus: 280000,
    },
    financialIncome: {
      interestIncomeLoans: 3800000,
      feesCommissionsIncome: 280000,
    },
    otherIncome: {
      otherOperatingIncome: 120000,
    },
    financialExpenses: {
      interestExpenseDeposits: 980000,
      interestExpenseBorrowings: 28000,
    },
    operatingExpenses: {
      personnelCosts: 480000,
      administrativeExpenses: 220000,
      governanceExpenses: 65000,
      depreciationAmortization: 145000,
    },
    creditLossExpense: 180000,
  },
};

// ============================================================================
// NON-FINANCIAL DATA SAMPLES
// ============================================================================

export const SAMPLE_MEMBERS: MemberRecord[] = [
  {
    memberId: "M001",
    joinDate: "2018-03-15",
    status: "Active",
    gender: "Female",
    ageGroup: "36-50",
    region: "Lubombo",
    urbanRural: "Rural",
    agmAttendance: true,
    leadershipRole: "Board Secretary",
    votingExercised: true,
  },
  {
    memberId: "M002",
    joinDate: "2019-06-22",
    status: "Active",
    gender: "Male",
    ageGroup: "18-35",
    region: "Lubombo",
    urbanRural: "Rural",
    agmAttendance: true,
    votingExercised: true,
  },
  {
    memberId: "M003",
    joinDate: "2020-01-10",
    status: "Active",
    gender: "Female",
    ageGroup: "18-35",
    region: "Lubombo",
    urbanRural: "Urban",
    agmAttendance: false,
    votingExercised: true,
  },
  {
    memberId: "M004",
    joinDate: "2015-08-05",
    status: "Dormant",
    gender: "Male",
    ageGroup: "50+",
    region: "Lubombo",
    urbanRural: "Rural",
    agmAttendance: false,
    votingExercised: false,
  },
  {
    memberId: "M005",
    joinDate: "2021-09-18",
    status: "Active",
    gender: "Female",
    ageGroup: "36-50",
    region: "Lubombo",
    urbanRural: "Rural",
    agmAttendance: true,
    leadershipRole: "Board Member",
    votingExercised: true,
  },
];

export const SAMPLE_SAVINGS_ACCOUNTS: SavingsAccount[] = [
  {
    savingsAccountId: "S001",
    memberId: "M001",
    accountType: "Mandatory",
    accountOpeningDate: "2018-03-15",
    accountStatus: "Active",
    contributionFrequency: "Monthly",
    lastContributionDate: "2024-12-01",
    numberOfContributions: 82,
    balanceTrend: "Increasing",
    zeroBalanceFlag: false,
    withdrawalFrequencyCategory: "Low",
    emergencyWithdrawalsFlag: false,
    interestRate: 4.5,
    balance: 15200,
  },
  {
    savingsAccountId: "S002",
    memberId: "M001",
    accountType: "Voluntary",
    accountOpeningDate: "2019-01-20",
    accountStatus: "Active",
    contributionFrequency: "Monthly",
    lastContributionDate: "2024-12-05",
    numberOfContributions: 72,
    balanceTrend: "Stable",
    zeroBalanceFlag: false,
    withdrawalFrequencyCategory: "Medium",
    emergencyWithdrawalsFlag: false,
    interestRate: 5.0,
    balance: 28500,
  },
  {
    savingsAccountId: "S003",
    memberId: "M002",
    accountType: "Mandatory",
    accountOpeningDate: "2019-06-22",
    accountStatus: "Active",
    contributionFrequency: "Monthly",
    lastContributionDate: "2024-12-01",
    numberOfContributions: 67,
    balanceTrend: "Increasing",
    zeroBalanceFlag: false,
    withdrawalFrequencyCategory: "Low",
    emergencyWithdrawalsFlag: false,
    interestRate: 4.5,
    balance: 12800,
  },
  {
    savingsAccountId: "S004",
    memberId: "M003",
    accountType: "Fixed",
    accountOpeningDate: "2023-01-10",
    accountStatus: "Active",
    contributionFrequency: "Quarterly",
    lastContributionDate: "2024-10-01",
    numberOfContributions: 8,
    balanceTrend: "Stable",
    zeroBalanceFlag: false,
    withdrawalFrequencyCategory: "Low",
    emergencyWithdrawalsFlag: false,
    interestRate: 6.5,
    balance: 25000,
  },
  {
    savingsAccountId: "S005",
    memberId: "M005",
    accountType: "Mandatory",
    accountOpeningDate: "2021-09-18",
    accountStatus: "Active",
    contributionFrequency: "Monthly",
    lastContributionDate: "2024-12-01",
    numberOfContributions: 40,
    balanceTrend: "Increasing",
    zeroBalanceFlag: false,
    withdrawalFrequencyCategory: "Low",
    emergencyWithdrawalsFlag: false,
    interestRate: 4.5,
    balance: 8500,
  },
];

export const SAMPLE_LOANS: LoanRecord[] = [
  {
    loanId: "L001",
    memberId: "M001",
    loanProductType: "Agricultural Input",
    loanStartDate: "2024-01-15",
    loanMaturityDate: "2024-12-15",
    loanStatus: "Performing",
    borrowerType: "Farmer",
    youthBorrowerFlag: false,
    womenBorrowerFlag: true,
    ruralBorrowerFlag: true,
    repaymentRegularity: "Regular",
    daysPastDueCategory: "0",
    missedInstallmentsCount: 0,
    restructuredLoanFlag: false,
    numberOfRestructurings: 0,
    earlySettlementFlag: false,
    multipleLoansFlag: false,
    largeBorrowerFlag: false,
    interestRate: 12.5,
    balance: 8500,
    loanAmount: 15000,
  },
  {
    loanId: "L002",
    memberId: "M002",
    loanProductType: "Enterprise Development",
    loanStartDate: "2024-03-01",
    loanMaturityDate: "2025-02-28",
    loanStatus: "Performing",
    borrowerType: "Entrepreneur",
    youthBorrowerFlag: true,
    womenBorrowerFlag: false,
    ruralBorrowerFlag: true,
    repaymentRegularity: "Regular",
    daysPastDueCategory: "0",
    missedInstallmentsCount: 0,
    restructuredLoanFlag: false,
    numberOfRestructurings: 0,
    earlySettlementFlag: false,
    multipleLoansFlag: false,
    largeBorrowerFlag: false,
    interestRate: 14.0,
    balance: 12000,
    loanAmount: 20000,
  },
  {
    loanId: "L003",
    memberId: "M003",
    loanProductType: "Emergency",
    loanStartDate: "2024-06-10",
    loanMaturityDate: "2024-12-10",
    loanStatus: "Arrears",
    borrowerType: "Individual",
    youthBorrowerFlag: true,
    womenBorrowerFlag: true,
    ruralBorrowerFlag: false,
    repaymentRegularity: "Irregular",
    daysPastDueCategory: "31-60",
    missedInstallmentsCount: 2,
    restructuredLoanFlag: false,
    numberOfRestructurings: 0,
    earlySettlementFlag: false,
    multipleLoansFlag: false,
    largeBorrowerFlag: false,
    interestRate: 18.0,
    balance: 4500,
    loanAmount: 5000,
  },
  {
    loanId: "L004",
    memberId: "M005",
    loanProductType: "Housing Improvement",
    loanStartDate: "2024-02-20",
    loanMaturityDate: "2026-02-20",
    loanStatus: "Performing",
    borrowerType: "Homeowner",
    youthBorrowerFlag: false,
    womenBorrowerFlag: true,
    ruralBorrowerFlag: true,
    repaymentRegularity: "Regular",
    daysPastDueCategory: "0",
    missedInstallmentsCount: 0,
    restructuredLoanFlag: false,
    numberOfRestructurings: 0,
    earlySettlementFlag: false,
    multipleLoansFlag: true,
    largeBorrowerFlag: false,
    interestRate: 11.5,
    balance: 28000,
    loanAmount: 35000,
  },
];

export const SAMPLE_FIXED_DEPOSITS: FixedDepositRecord[] = [
  {
    fixedDepositId: "FD001",
    memberId: "M001",
    depositType: "Medium-term",
    startDate: "2024-01-15",
    maturityDate: "2025-01-15",
    status: "Active",
    tenureCategory: "6-12m",
    originalTenureSelected: "12 months",
    earlyWithdrawalFlag: false,
    rolloverAtMaturityFlag: true,
    numberOfRenewals: 2,
    changeInTenureAtRenewal: false,
    singleDepositorDependencyFlag: false,
    interestRate: 6.5,
    balance: 25000,
  },
  {
    fixedDepositId: "FD002",
    memberId: "M002",
    depositType: "Short-term",
    startDate: "2024-09-01",
    maturityDate: "2025-03-01",
    status: "Active",
    tenureCategory: "3-6m",
    originalTenureSelected: "6 months",
    earlyWithdrawalFlag: false,
    rolloverAtMaturityFlag: false,
    numberOfRenewals: 0,
    changeInTenureAtRenewal: false,
    singleDepositorDependencyFlag: false,
    interestRate: 5.5,
    balance: 10000,
  },
];
