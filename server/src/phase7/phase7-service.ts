import { calculateBudgetSummary, getBudgetEndDate } from "../../../shared/budgets/calculations.js";
import { calculateFinanceMetadata, calculateFinanceTotals, aggregateMonthlyFinance, getMonthRange, monthSequence, shiftMonth, type DateRange } from "../../../shared/finance/calculations.js";
import { detectRecurringPayments } from "../../../shared/finance/intelligence.js";
import { calculateFinancialHealth } from "../../../shared/finance/health.js";
import { goalView } from "../../../shared/goals/calculations.js";
import type { BudgetRecord, BudgetView, FinancialHealthData, GoalRecord, GoalView, UpcomingCashFlowData, UpcomingCashFlowItem, TransactionRecord } from "../../../shared/types/index.js";
import type { BudgetRepository } from "../budgets/budget-repository.js";
import { IntelligenceService } from "../intelligence/intelligence-service.js";
import type { GoalRepository } from "../goals/goal-repository.js";
import type { TransactionRepository } from "../transactions/transaction-repository.js";

const HISTORY_MONTHS = 6;
const RECURRING_LOOKBACK_MONTHS = 12;
const UPCOMING_DAYS = 30;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function budgetOverlapsMonth(budget: BudgetRecord, month: string): boolean {
  const range = getMonthRange(month);
  return budget.startDate.slice(0, 10) <= range.to && getBudgetEndDate(budget) >= range.from;
}

function budgetView(budget: BudgetRecord, transactions: readonly TransactionRecord[]): BudgetView {
  return { ...budget, ...calculateBudgetSummary(budget, transactions) };
}

function datedRange(from: string, to: string): DateRange {
  return { from, to };
}

export class Phase7Service {
  private readonly intelligence: IntelligenceService;

  constructor(
    transactionRepository: TransactionRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly goalRepository: GoalRepository,
  ) {
    this.intelligence = new IntelligenceService(transactionRepository);
  }

  async goals(uid: string): Promise<GoalView[]> {
    const records = await this.goalRepository.list(uid, {});
    return records.map((goal) => goalView(goal, todayUtc()));
  }

  async financialHealth(uid: string, month: string): Promise<FinancialHealthData> {
    const historyFrom = `${shiftMonth(month, -(HISTORY_MONTHS - 1))}-01`;
    const historyTo = getMonthRange(month).to;
    const transactions = await this.intelligence.transactionsInRange(uid, datedRange(historyFrom, historyTo));
    const currentRange = getMonthRange(month);
    const currentTransactions = transactions.filter((transaction) => transaction.occurredAt.slice(0, 10) >= currentRange.from && transaction.occurredAt.slice(0, 10) <= currentRange.to);
    const monthly = aggregateMonthlyFinance(transactions, shiftMonth(month, -(HISTORY_MONTHS - 1)), month);
    const budgets = (await this.budgetRepository.list(uid, { month }))
      .filter((budget) => budgetOverlapsMonth(budget, month))
      .map((budget) => budgetView(budget, currentTransactions));
    const goals = await this.goals(uid);
    const recurringFrom = `${shiftMonth(month, -RECURRING_LOOKBACK_MONTHS)}-01`;
    const recurringTransactions = await this.intelligence.transactionsInRange(uid, datedRange(recurringFrom, currentRange.to));
    const recurringPayments = detectRecurringPayments(recurringTransactions);
    const metadata = calculateFinanceMetadata(transactions);
    return calculateFinancialHealth({
      month,
      totals: calculateFinanceTotals(currentTransactions),
      expenseByMonth: monthly.map((point) => point.expenseMinor),
      historyMonths: monthly.filter((point) => point.transactionCount > 0).length,
      budgets,
      recurringPayments,
      goals,
      transactionCount: metadata.transactionCount,
      incomeTransactionCount: metadata.incomeTransactionCount,
      expenseTransactionCount: metadata.expenseTransactionCount,
    });
  }

  async upcomingCashFlow(uid: string, from: string, to: string): Promise<UpcomingCashFlowData> {
    const lookbackFrom = `${shiftMonth(from.slice(0, 7), -RECURRING_LOOKBACK_MONTHS)}-01`;
    const sourceTransactions = await this.intelligence.transactionsInRange(uid, datedRange(lookbackFrom, to));
    const patterns = detectRecurringPayments(sourceTransactions);
    const items: UpcomingCashFlowItem[] = patterns
      .filter((pattern) => pattern.nextExpectedOccurrence && pattern.nextExpectedOccurrence >= from && pattern.nextExpectedOccurrence <= to)
      .map((pattern) => ({
        id: `upcoming-${pattern.id}-${pattern.nextExpectedOccurrence}`,
        merchant: pattern.merchant,
        ...(pattern.category ? { category: pattern.category } : {}),
        amountMinor: pattern.typicalAmountMinor,
        type: "expense" as const,
        expectedAt: pattern.nextExpectedOccurrence!,
        frequency: pattern.frequency,
        confidence: pattern.confidence,
        occurrenceCount: pattern.occurrenceCount,
      }))
      .sort((left, right) => left.expectedAt.localeCompare(right.expectedAt) || left.merchant.localeCompare(right.merchant));
    const expectedExpenseMinor = items.reduce((sum, item) => sum + item.amountMinor, 0);
    return {
      from,
      to,
      items,
      summary: {
        expectedIncomeMinor: 0,
        expectedExpenseMinor,
        expectedNetFlowMinor: -expectedExpenseMinor,
        itemCount: items.length,
      },
      metadata: {
        sourceTransactionCount: sourceTransactions.length,
        recurringPatternCount: patterns.length,
      },
    };
  }

  static defaultUpcomingRange(): DateRange {
    const from = todayUtc();
    return { from, to: addDays(from, UPCOMING_DAYS) };
  }

  static monthSequence(from: string, to: string): string[] {
    return monthSequence(from, to);
  }
}