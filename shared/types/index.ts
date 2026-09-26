export type PlannedRoute =
  | "/dashboard"
  | "/transactions"
  | "/budgets"
  | "/analytics"
  | "/forecast"
  | "/goals"
  | "/cash-flow"
  | "/recurring-payments"
  | "/receipts"
  | "/insights"
  | "/ai-finance"
  | "/settings";

export type ApiResponse<T> = {
  data: T;
  meta?: {
    requestId?: string;
  };
};

export type HealthPayload = {
  status: "ok";
  service: "sejora-api";
  phase: "foundation";
};

export type TransactionType = "income" | "expense";
export type TransactionSource = "manual" | "receipt";

export type TransactionRecord = {
  id: string;
  amountMinor: number;
  currency: "INR";
  type: TransactionType;
  merchant: string;
  category?: string;
  occurredAt: string;
  paymentMethod?: string;
  notes?: string;
  source: TransactionSource;
  receiptId?: string;
  createdAt: string;
  updatedAt: string;
};

export type TransactionListData = {
  items: TransactionRecord[];
  nextCursor: string | null;
  hasNextPage: boolean;
};

export type ReceiptLineItem = {
  description: string;
  quantity: number | null;
  unitPriceMinor: number | null;
  totalMinor: number | null;
};

export type ReceiptReviewField = "merchant" | "occurredAt" | "amountMinor" | "type" | "category" | "currency";

export type ReceiptExtraction = {
  merchant: string | null;
  occurredAt: string | null;
  amountMinor: number | null;
  currency: "INR" | null;
  type: TransactionType | null;
  category: string | null;
  paymentMethod: string | null;
  lineItems: ReceiptLineItem[];
  needsReview: ReceiptReviewField[];
};

export type ReceiptScanData = {
  extraction: ReceiptExtraction;
  reviewMessage: string;
};

export type BudgetPeriod = "monthly";

export type BudgetRecord = {
  id: string;
  name: string;
  category?: string;
  amountMinor: number;
  currency: "INR";
  period: BudgetPeriod;
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
};

export type BudgetStatus = "healthy" | "approaching" | "at_limit" | "overspent";

export type BudgetSummary = {
  spentMinor: number;
  remainingMinor: number;
  usagePercent: number;
  status: BudgetStatus;
};

export type BudgetView = BudgetRecord & BudgetSummary;

export type BudgetListData = {
  items: BudgetView[];
};

export type GoalRecord = {
  id: string;
  name: string;
  targetAmountMinor: number;
  currentAmountMinor: number;
  currency: "INR";
  targetDate: string;
  category?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type GoalStatus = "not_started" | "in_progress" | "nearly_there" | "completed" | "overdue";

export type GoalView = GoalRecord & {
  remainingAmountMinor: number;
  percentageComplete: number;
  status: GoalStatus;
};

export type GoalListData = {
  items: GoalView[];
};

export type FinanceTotals = {
  incomeMinor: number;
  expenseMinor: number;
  balanceMinor: number;
  savingsMinor: number;
  savingsRate: number | null;
};

export type CategorySpending = {
  category: string;
  amountMinor: number;
  percentage: number;
};

export type MonthlyFinancePoint = {
  month: string;
  incomeMinor: number;
  expenseMinor: number;
  netFlowMinor: number;
  transactionCount: number;
};

export type FinanceDataMetadata = {
  transactionCount: number;
  incomeTransactionCount: number;
  expenseTransactionCount: number;
};

export type DashboardData = {
  month: string;
  from: string;
  to: string;
  totals: FinanceTotals;
  spendingByCategory: CategorySpending[];
  budgets: BudgetView[];
  recentTransactions: TransactionRecord[];
  metadata: FinanceDataMetadata;
};

export type AnalyticsData = {
  from: string;
  to: string;
  totals: FinanceTotals;
  monthly: MonthlyFinancePoint[];
  spendingByCategory: CategorySpending[];
  budgets: BudgetView[];
  metadata: FinanceDataMetadata;
};

export type SpendingInsightKind =
  | "largest_category"
  | "largest_expense"
  | "category_change"
  | "spending_concentration"
  | "high_frequency";

export type SpendingInsight = {
  id: string;
  kind: SpendingInsightKind;
  title: string;
  category?: string;
  categories?: string[];
  merchant?: string;
  amountMinor?: number;
  previousAmountMinor?: number;
  changePercent?: number;
  percentage?: number;
  transactionCount: number;
};

export type SpendingAnomalySignal = "category_amount" | "overall_amount";

export type SpendingAnomaly = {
  id: string;
  transactionId: string;
  amountMinor: number;
  merchant: string;
  category?: string;
  occurredAt: string;
  signal: SpendingAnomalySignal;
  baselineAverageMinor: number;
  baselineTransactionCount: number;
};

export type InsightsData = {
  month: string;
  from: string;
  to: string;
  comparisonFrom: string;
  comparisonTo: string;
  baselineFrom: string;
  baselineTo: string;
  insights: SpendingInsight[];
  anomalies: SpendingAnomaly[];
  metadata: {
    focusTransactionCount: number;
    focusExpenseTransactionCount: number;
    baselineTransactionCount: number;
    baselineExpenseTransactionCount: number;
    hasComparisonHistory: boolean;
    hasAnomalyHistory: boolean;
  };
};

export type AiInsightType = "spending" | "savings" | "budget" | "recurring" | "goals" | "forecast" | "trend" | "attention";
export type AiInsightSeverity = "low" | "medium" | "high";

export type AiInsightFact = {
  id: string;
  label: string;
  valueMinor?: number;
  previousValueMinor?: number;
  percentage?: number;
  count?: number;
  textValue?: string;
};

export type AiGeneratedInsight = {
  id: string;
  title: string;
  summary: string;
  type: AiInsightType;
  severity: AiInsightSeverity;
  supportingFacts: AiInsightFact[];
};

export type AiInsightsStatus = "ready" | "insufficient_data";

export type AiInsightsData = {
  month: string;
  from: string;
  to: string;
  status: AiInsightsStatus;
  statusMessage: string;
  disclosure: string;
  insights: AiGeneratedInsight[];
  facts: AiInsightFact[];
  metadata: {
    activeMonths: number;
    factCount: number;
  };
};

export type FinanceQuestionIntentType =
  | "unsupported"
  | "ambiguous"
  | "expense_total"
  | "category_spending"
  | "category_percentage"
  | "top_category"
  | "largest_expense"
  | "income_total"
  | "savings"
  | "savings_rate"
  | "comparison"
  | "merchant_spending"
  | "budget_usage"
  | "closest_budget"
  | "goal_progress"
  | "goal_remaining"
  | "recurring_summary"
  | "recurring_total"
  | "forecast_balance"
  | "forecast_expenses";

export type FinanceQuestionPeriodType =
  | "current_month"
  | "previous_month"
  | "calendar_month"
  | "calendar_year"
  | "month_window";

export type FinanceQuestionPeriod = {
  type: FinanceQuestionPeriodType;
  value?: string;
  months?: number;
};

export type FinanceQuestionIntent = {
  intent: FinanceQuestionIntentType;
  period?: FinanceQuestionPeriod;
  category?: string;
  merchant?: string;
  goalName?: string;
  horizon?: 1 | 3 | 6;
};

export type FinanceQuestionItem = {
  label: string;
  amountMinor?: number;
  percentage?: number | null;
  text?: string;
  date?: string;
};

export type FinanceQuestionResult = {
  kind: "amount" | "percentage" | "comparison" | "list" | "budget" | "goal" | "forecast";
  currency: "INR";
  amountMinor?: number;
  previousAmountMinor?: number;
  differenceMinor?: number;
  percentage?: number | null;
  text?: string;
  period?: {
    from: string;
    to: string;
    label: string;
  };
  items?: FinanceQuestionItem[];
};

export type FinanceQuestionFact = {
  label: string;
  value?: string;
  amountMinor?: number;
  percentage?: number | null;
  text?: string;
};

export type FinanceQuestionStatus = "answered" | "unsupported" | "ambiguous" | "insufficient_data";

export type FinanceQuestionData = {
  question: string;
  status: FinanceQuestionStatus;
  answer: string;
  intent?: FinanceQuestionIntent;
  result?: FinanceQuestionResult;
  supportingFacts: FinanceQuestionFact[];
  disclosure: string;
  usedAi: boolean;
};

export type RecurringFrequency = "weekly" | "monthly" | "quarterly";

export type RecurringPayment = {
  id: string;
  merchant: string;
  category?: string;
  typicalAmountMinor: number;
  frequency: RecurringFrequency;
  lastOccurrence: string;
  nextExpectedOccurrence?: string;
  confidence: number;
  occurrenceCount: number;
  intervalDays: number;
};

export type RecurringPaymentsData = {
  from: string;
  to: string;
  items: RecurringPayment[];
  metadata: {
    transactionCount: number;
    expenseTransactionCount: number;
  };
};

export type FinancialHealthComponent = {
  key: "savings" | "budget_discipline" | "spending_stability" | "recurring_cost_pressure" | "goal_progress";
  label: string;
  score: number;
  maxScore: number;
  available: boolean;
  explanation: string;
};

export type FinancialHealthData = {
  month: string;
  score: number | null;
  status: "insufficient_data" | "developing" | "established";
  coveragePercent: number;
  components: FinancialHealthComponent[];
  metadata: {
    transactionCount: number;
    incomeTransactionCount: number;
    expenseTransactionCount: number;
    historyMonths: number;
    budgetCount: number;
    goalCount: number;
    recurringCount: number;
  };
  disclaimer: string;
};

export type UpcomingCashFlowItem = {
  id: string;
  merchant: string;
  category?: string;
  amountMinor: number;
  type: "expense";
  expectedAt: string;
  frequency: RecurringFrequency;
  confidence: number;
  occurrenceCount: number;
};

export type UpcomingCashFlowData = {
  from: string;
  to: string;
  items: UpcomingCashFlowItem[];
  summary: {
    expectedIncomeMinor: number;
    expectedExpenseMinor: number;
    expectedNetFlowMinor: number;
    itemCount: number;
  };
  metadata: {
    sourceTransactionCount: number;
    recurringPatternCount: number;
  };
};

export type ForecastStatus = "ready" | "limited_data" | "insufficient_data";

export type ForecastHistoricalPoint = {
  month: string;
  incomeMinor: number;
  expenseMinor: number;
  netSavingsMinor: number;
  transactionCount: number;
  hasRecordedActivity: boolean;
};

export type ForecastProjectedPoint = {
  month: string;
  incomeMinor: number;
  expenseMinor: number;
  netSavingsMinor: number;
  savingsRate: number | null;
  balanceMinor: number;
};

export type ForecastMetrics = {
  monthlyIncomeMinor: number;
  monthlyExpenseMinor: number;
  monthlySavingsMinor: number;
  savingsRate: number | null;
  endingBalanceMinor: number;
};

export type ForecastData = {
  asOfDate: string;
  historicalWindow: {
    from: string;
    to: string;
    monthCount: number;
    activeMonthCount: number;
  };
  horizon: 1 | 3 | 6;
  status: ForecastStatus;
  statusMessage: string;
  actualBalanceMinor: number;
  historical: ForecastHistoricalPoint[];
  baseline: {
    metrics: ForecastMetrics | null;
    projected: ForecastProjectedPoint[];
  };
  assumptions: string[];
};

export type ForecastSimulationInput = {
  horizon: 1 | 3 | 6;
  incomeAdjustmentPercent: number;
  expenseAdjustmentPercent: number;
  oneTimeExpenseMinor: number;
  savingsTargetMinor?: number;
};

export type ForecastSimulationData = {
  status: ForecastStatus;
  statusMessage: string;
  horizon: 1 | 3 | 6;
  actualBalanceMinor: number;
  baseline: {
    metrics: ForecastMetrics | null;
    projected: ForecastProjectedPoint[];
  };
  scenario: {
    metrics: ForecastMetrics | null;
    projected: ForecastProjectedPoint[];
  };
  difference: {
    monthlySavingsMinor: number | null;
    endingBalanceMinor: number | null;
  };
  savingsTargetMinor: number | null;
  savingsTargetMet: boolean | null;
  assumptions: string[];
};