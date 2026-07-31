import type { MemberRecord } from "@/lib/financial-data";

export type WizardStep =
  "financial" | "members" | "savings" | "loans" | "deposits" | "farm" | "review";

export interface WizardMember extends MemberRecord {
  _rowKey: string;
}

export interface WizardSavings {
  _rowKey: string;
  memberBusinessId: string;
  savingsAccountId: string;
  accountType: "Voluntary" | "Mandatory" | "Fixed";
  accountOpeningDate: string;
  accountStatus: string;
  contributionFrequency: string;
  lastContributionDate: string;
  numberOfContributions: number;
  balanceTrend: string;
  zeroBalanceFlag: boolean;
  withdrawalFrequencyCategory: string;
  emergencyWithdrawalsFlag: boolean;
  interestRate: number;
  balance: number;
}

export interface WizardLoan {
  _rowKey: string;
  memberBusinessId: string;
  loanId: string;
  loanProductType: string;
  loanStartDate: string;
  loanMaturityDate: string;
  loanStatus: "Performing" | "Arrears" | "Restructured" | "WrittenOff";
  borrowerType: string;
  youthBorrowerFlag: boolean;
  womenBorrowerFlag: boolean;
  ruralBorrowerFlag: boolean;
  repaymentRegularity: string;
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

export interface WizardFixedDeposit {
  _rowKey: string;
  memberBusinessId: string;
  fixedDepositId: string;
  depositType: string;
  startDate: string;
  maturityDate: string;
  status: "Active" | "Matured" | "Withdrawn" | "RolledOver";
  tenureCategory: string;
  originalTenureSelected: string;
  earlyWithdrawalFlag: boolean;
  rolloverAtMaturityFlag: boolean;
  numberOfRenewals: number;
  changeInTenureAtRenewal: boolean;
  singleDepositorDependencyFlag: boolean;
  interestRate: number;
  balance: number;
}

export interface WizardFarmCoop {
  cooperativeType: string;
  primaryActivities: string;
  yearOfEstablishment: number;
  operationalStatus: string;
  activeProducerFlag: boolean;
  productionType: string;
  participationFrequency: string;
  deliveryCompliance: string;
  productionCycleType: string;
  useOfProductionPlanning: boolean;
  useOfSharedInputs: boolean;
  qualityComplianceFlag: boolean;
  marketChannelType: string;
  formalOfftakeAgreement: boolean;
  buyerConcentrationFlag: boolean;
  pricePredictabilityCategory: string;
  accessToStorage: boolean;
  accessToProcessingFacilities: boolean;
  transportCoordination: string;
  climateExposureType: string;
  irrigationAccess: boolean;
  climateMitigationPractices: string;
}
