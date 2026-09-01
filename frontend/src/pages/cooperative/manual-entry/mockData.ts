import type {
  WizardFarmCoop,
  WizardMember,
  WizardSavings,
  WizardLoan,
  WizardFixedDeposit,
} from "./types";

export function generateMockFinancialGrid(): Record<number, Record<number, number>> {
  const data: Record<number, Record<number, number>> = {};
  const activeCodes = [
    1101, 1102, 1103, 1104, 1201, 1202, 1203, 1204, 1205, 1251, 1252, 1301, 1302, 1303, 1304, 1305,
    2101, 2102, 2103, 2201, 2202, 2301, 2302, 2303, 3101, 3102, 3201, 3202, 3203, 3301, 3302, 4101,
    4102, 4201, 5101, 5102, 5201, 5202, 5203, 5204, 5301,
  ];

  for (const code of activeCodes) {
    data[code] = {};
  }

  for (let m = 1; m <= 12; m++) {
    // Assets
    data[1101][m] = 10000 + m * 500;
    data[1102][m] = 20000 + m * 1000;
    data[1103][m] = 30000 + m * 1500;
    data[1104][m] = 5000;
    data[1201][m] = 50000 + m * 2000;
    data[1202][m] = 2000;
    data[1203][m] = 1000;
    data[1204][m] = 500;
    data[1205][m] = 1000;
    data[1251][m] = -1000;
    data[1252][m] = -500;
    data[1301][m] = 3000;
    data[1302][m] = 1000;
    data[1303][m] = 15000;
    data[1304][m] = -(m * 200);
    data[1305][m] = 2000;

    // Liabilities
    data[2101][m] = 40000 + m * 1500;
    data[2102][m] = 20000 + m * 1000;
    data[2103][m] = 15000 + m * 500;
    data[2201][m] = 10000;
    data[2202][m] = 15000;
    data[2301][m] = 2000;
    data[2302][m] = 1000;
    data[2303][m] = 1000;

    // Equity
    data[3101][m] = 15000 + m * 500;
    data[3102][m] = 5000 + m * 300;
    data[3201][m] = 5000;
    data[3202][m] = 3000;
    data[3203][m] = 2000;
    data[3301][m] = 3000;
    data[3302][m] = 2000 + m * 1000;

    // Income
    data[4101][m] = 5000 + m * 200;
    data[4102][m] = 1000;
    data[4201][m] = 500;

    // Expenses
    data[5101][m] = 1000 + m * 50;
    data[5102][m] = 500;
    data[5201][m] = 2000;
    data[5202][m] = 1000;
    data[5203][m] = 500;
    data[5204][m] = 200;
    data[5301][m] = 300;
  }

  return data;
}

export interface MockNonFinancialPayload {
  members: WizardMember[];
  savings: WizardSavings[];
  loans: WizardLoan[];
  fixedDeposits: WizardFixedDeposit[];
  farmCoop: WizardFarmCoop;
}

export function generateMockNonFinancialData(): MockNonFinancialPayload {
  const members: WizardMember[] = [
    {
      _rowKey: Math.random().toString(36).slice(2),
      memberId: "MEM-001",
      joinDate: "2020-01-15",
      status: "Active",
      gender: "Female",
      ageGroup: "18-35",
      region: "Manzini",
      urbanRural: "Rural",
      agmAttendance: true,
      votingExercised: true,
      shareBalance: 5000,
    },
    {
      _rowKey: Math.random().toString(36).slice(2),
      memberId: "MEM-002",
      joinDate: "2021-03-22",
      status: "Active",
      gender: "Male",
      ageGroup: "36-50",
      region: "Hhohho",
      urbanRural: "Urban",
      agmAttendance: true,
      votingExercised: true,
      shareBalance: 12000,
    },
    {
      _rowKey: Math.random().toString(36).slice(2),
      memberId: "MEM-003",
      joinDate: "2022-05-10",
      status: "Active",
      gender: "Female",
      ageGroup: "50+",
      region: "Shiselweni",
      urbanRural: "Rural",
      agmAttendance: false,
      votingExercised: false,
      shareBalance: 3500,
    },
    {
      _rowKey: Math.random().toString(36).slice(2),
      memberId: "MEM-004",
      joinDate: "2023-08-30",
      status: "Active",
      gender: "Female",
      ageGroup: "<18",
      region: "Lubombo",
      urbanRural: "Rural",
      agmAttendance: true,
      votingExercised: false,
      shareBalance: 1500,
    },
    {
      _rowKey: Math.random().toString(36).slice(2),
      memberId: "MEM-005",
      joinDate: "2024-02-14",
      status: "Active",
      gender: "Male",
      ageGroup: "18-35",
      region: "Manzini",
      urbanRural: "Rural",
      agmAttendance: false,
      votingExercised: true,
      shareBalance: 8000,
    },
  ];

  const savings: WizardSavings[] = [
    {
      _rowKey: Math.random().toString(36).slice(2),
      memberBusinessId: "MEM-001",
      savingsAccountId: "SAV-001",
      accountType: "Voluntary",
      accountOpeningDate: "2020-01-20",
      accountStatus: "Active",
      contributionFrequency: "Monthly",
      lastContributionDate: "2026-07-01",
      numberOfContributions: 78,
      balanceTrend: "Increasing",
      zeroBalanceFlag: false,
      withdrawalFrequencyCategory: "Low",
      emergencyWithdrawalsFlag: false,
      interestRate: 0.04,
      balance: 12500,
    },
    {
      _rowKey: Math.random().toString(36).slice(2),
      memberBusinessId: "MEM-002",
      savingsAccountId: "SAV-002",
      accountType: "Mandatory",
      accountOpeningDate: "2021-04-01",
      accountStatus: "Active",
      contributionFrequency: "Monthly",
      lastContributionDate: "2026-07-05",
      numberOfContributions: 63,
      balanceTrend: "Stable",
      zeroBalanceFlag: false,
      withdrawalFrequencyCategory: "Low",
      emergencyWithdrawalsFlag: false,
      interestRate: 0.03,
      balance: 8500,
    },
    {
      _rowKey: Math.random().toString(36).slice(2),
      memberBusinessId: "MEM-003",
      savingsAccountId: "SAV-003",
      accountType: "Fixed",
      accountOpeningDate: "2022-06-15",
      accountStatus: "Active",
      contributionFrequency: "Annually",
      lastContributionDate: "2026-06-15",
      numberOfContributions: 4,
      balanceTrend: "Stable",
      zeroBalanceFlag: false,
      withdrawalFrequencyCategory: "Low",
      emergencyWithdrawalsFlag: false,
      interestRate: 0.065,
      balance: 25000,
    },
  ];

  const loans: WizardLoan[] = [
    {
      _rowKey: Math.random().toString(36).slice(2),
      memberBusinessId: "MEM-001",
      loanId: "LN-001",
      loanProductType: "Agricultural",
      loanStartDate: "2025-10-01",
      loanMaturityDate: "2026-10-01",
      loanStatus: "Performing",
      borrowerType: "Individual",
      youthBorrowerFlag: true,
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
      interestRate: 0.12,
      balance: 5000,
      loanAmount: 15000,
    },
    {
      _rowKey: Math.random().toString(36).slice(2),
      memberBusinessId: "MEM-002",
      loanId: "LN-002",
      loanProductType: "Commercial",
      loanStartDate: "2025-05-15",
      loanMaturityDate: "2027-05-15",
      loanStatus: "Arrears",
      borrowerType: "Individual",
      youthBorrowerFlag: false,
      womenBorrowerFlag: false,
      ruralBorrowerFlag: false,
      repaymentRegularity: "Irregular",
      daysPastDueCategory: "31-60",
      missedInstallmentsCount: 2,
      restructuredLoanFlag: true,
      numberOfRestructurings: 1,
      earlySettlementFlag: false,
      multipleLoansFlag: true,
      largeBorrowerFlag: false,
      interestRate: 0.15,
      balance: 18500,
      loanAmount: 25000,
    },
  ];

  const fixedDeposits: WizardFixedDeposit[] = [
    {
      _rowKey: Math.random().toString(36).slice(2),
      memberBusinessId: "MEM-004",
      fixedDepositId: "FD-001",
      depositType: "Standard",
      startDate: "2025-01-10",
      maturityDate: "2026-01-10",
      status: "Matured",
      tenureCategory: "MediumTerm",
      originalTenureSelected: "12 Months",
      earlyWithdrawalFlag: false,
      rolloverAtMaturityFlag: true,
      numberOfRenewals: 1,
      changeInTenureAtRenewal: false,
      singleDepositorDependencyFlag: false,
      interestRate: 0.05,
      balance: 10000,
    },
    {
      _rowKey: Math.random().toString(36).slice(2),
      memberBusinessId: "MEM-005",
      fixedDepositId: "FD-002",
      depositType: "Standard",
      startDate: "2026-03-01",
      maturityDate: "2027-03-01",
      status: "Active",
      tenureCategory: "MediumTerm",
      originalTenureSelected: "12 Months",
      earlyWithdrawalFlag: false,
      rolloverAtMaturityFlag: false,
      numberOfRenewals: 0,
      changeInTenureAtRenewal: false,
      singleDepositorDependencyFlag: false,
      interestRate: 0.055,
      balance: 15000,
    },
  ];

  const farmCoop: WizardFarmCoop = {
    cooperativeType: "Multipurpose",
    primaryActivities: "Agricultural Production and Processing",
    yearOfEstablishment: 2018,
    operationalStatus: "Active",
    activeProducerFlag: true,
    productionType: "Crop and Livestock",
    participationFrequency: "Weekly",
    deliveryCompliance: "Highly Compliant",
    productionCycleType: "Seasonal",
    useOfProductionPlanning: true,
    useOfSharedInputs: true,
    qualityComplianceFlag: true,
    marketChannelType: "Contract Buyer & Local Market",
    formalOfftakeAgreement: true,
    buyerConcentrationFlag: false,
    pricePredictabilityCategory: "Medium",
    accessToStorage: true,
    accessToProcessingFacilities: true,
    transportCoordination: "Cooperative Provided",
    climateExposureType: "Drought and Heavy Rains",
    irrigationAccess: true,
    climateMitigationPractices: "Conservation farming and rainwater harvesting",
  };

  return {
    members,
    savings,
    loans,
    fixedDeposits,
    farmCoop,
  };
}
