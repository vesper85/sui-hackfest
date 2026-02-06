export interface Pool {
  id: string;
  name: string;
  description: string;
  logo: string;
  headerImage: string;
  poolSize: number;
  tvl: number;
  apy: number;
  tenure: string;
  poolType: "Senior" | "Junior" | "Mezzanine";
  minInvestment: number;
  score: number;
  lockupPeriod: string;
  repaymentFrequency: string;
  redeemRate: number;
  performanceFee: number;
  status: "Active" | "Closed" | "Pending";
  borrower: Borrower;
  highlights: string[];
  structure: PoolStructure;
  underwriters: Underwriter[];
  assets: Asset[];
  repayments: Repayment[];
  activity: PoolActivity[];
}

export interface Borrower {
  id: string;
  name: string;
  logo: string;
  country: string;
  industry: string;
  website: string;
  documents: Document[];
  financialProfile: FinancialAttribute[];
  status: "Pending" | "Approved" | "Rejected";
  requestDate: string;
}

export interface FinancialAttribute {
  attribute: string;
  value: number;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  status: "Pending" | "Reviewed" | "Approved" | "Rejected";
}

export interface PoolStructure {
  seniorTranche: number;
  juniorTranche: number;
  mezzanineTranche: number;
}

export interface Underwriter {
  id: string;
  name: string;
  logo: string;
  rating: string;
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  value: number;
  maturity: string;
}

export interface Repayment {
  id: string;
  date: string;
  principal: number;
  interest: number;
  status: "Scheduled" | "Paid" | "Overdue";
}

export interface PoolActivity {
  id: string;
  type: "Investment" | "Redemption" | "Repayment";
  amount: number;
  investor: string;
  date: string;
  txHash: string;
}

export interface Investment {
  id: string;
  poolId: string;
  poolName: string;
  amount: number;
  expectedReturn: number;
  apy: number;
  investedAt: string;
  maturityDate: string;
  status: "Active" | "Matured" | "Withdrawn";
}

export interface Portfolio {
  totalInvestments: number;
  expectedReturns: number;
  availableForWithdrawal: number;
  averageApy: number;
  investments: Investment[];
  transactions: Transaction[];
}

export interface Transaction {
  id: string;
  type: "Investment" | "Redemption" | "Interest";
  poolName: string;
  amount: number;
  date: string;
  status: "Completed" | "Pending" | "Failed";
  txHash: string;
}

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: number | null;
}

export interface DashboardStats {
  totalLoanVolume: number;
  activeLoans: number;
  totalInterestEarned: number;
}
