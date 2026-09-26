import { calculateBudgetSummary, getBudgetEndDate } from "../../../shared/budgets/calculations.js";
import {
  aggregateCategorySpending,
  aggregateMonthlyFinance,
  calculateFinanceMetadata,
  calculateFinanceTotals,
  getMonthRange,
  type DateRange,
} from "../../../shared/finance/calculations.js";
import type { AnalyticsData, BudgetRecord, BudgetView, DashboardData, TransactionRecord } from "../../../shared/types/index.js";
import { ApiError } from "../errors.js";
import type { BudgetRepository } from "../budgets/budget-repository.js";
import type { TransactionRepository } from "../transactions/transaction-repository.js";

const ANALYTICS_PAGE_SIZE = 250;
const MAX_ANALYTICS_TRANSACTIONS = 10_000;

export class AnalyticsDataTooLargeError extends Error {
  constructor() {
    super("This date range contains too many transactions. Choose a shorter range.");
    this.name = "AnalyticsDataTooLargeError";
  }
}

function budgetOverlapsRange(budget: BudgetRecord, range: DateRange): boolean {
  const budgetStart = budget.startDate.slice(0, 10);
  const budgetEnd = getBudgetEndDate(budget);
  return budgetStart <= range.to && budgetEnd >= range.from;
}

function budgetView(budget: BudgetRecord, transactions: readonly TransactionRecord[]): BudgetView {
  return { ...budget, ...calculateBudgetSummary(budget, transactions) };
}

function newestFirst(left: TransactionRecord, right: TransactionRecord): number {
  return right.occurredAt.localeCompare(left.occurredAt) || right.id.localeCompare(left.id);
}

export class AnalyticsService {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly budgetRepository: BudgetRepository,
  ) {}

  private async transactionsInRange(uid: string, range: DateRange): Promise<TransactionRecord[]> {
    const transactions: TransactionRecord[] = [];
    let pageToken: string | undefined;

    do {
      const page = this.transactionRepository.listForAnalytics
        ? await this.transactionRepository.listForAnalytics(uid, {
          ...range,
          pageSize: ANALYTICS_PAGE_SIZE,
          ...(pageToken ? { pageToken } : {}),
        })
        : await this.transactionRepository.list(uid, {
          from: range.from,
          to: range.to,
          pageSize: ANALYTICS_PAGE_SIZE,
          sort: "oldest",
          ...(pageToken ? { pageToken } : {}),
        });

      transactions.push(...page.items);
      if (transactions.length > MAX_ANALYTICS_TRANSACTIONS) throw new AnalyticsDataTooLargeError();
      pageToken = page.hasNextPage ? page.nextCursor ?? undefined : undefined;
      if (page.hasNextPage && !pageToken) throw new AnalyticsDataTooLargeError();
    } while (pageToken);

    return transactions;
  }

  private async budgetsInRange(uid: string, range: DateRange, transactions: readonly TransactionRecord[]): Promise<BudgetView[]> {
    const budgets = await this.budgetRepository.list(uid, {});
    return budgets
      .filter((budget) => budgetOverlapsRange(budget, range))
      .map((budget) => budgetView(budget, transactions));
  }

  async dashboard(uid: string, month: string): Promise<DashboardData> {
    const range = getMonthRange(month);
    const transactions = await this.transactionsInRange(uid, range);
    const budgets = await this.budgetsInRange(uid, range, transactions);
    return {
      month,
      ...range,
      totals: calculateFinanceTotals(transactions),
      spendingByCategory: aggregateCategorySpending(transactions),
      budgets,
      recentTransactions: [...transactions].sort(newestFirst).slice(0, 5),
      metadata: calculateFinanceMetadata(transactions),
    };
  }

  async analytics(uid: string, from: string, to: string): Promise<AnalyticsData> {
    const range = { from: getMonthRange(from).from, to: getMonthRange(to).to };
    const transactions = await this.transactionsInRange(uid, range);
    return {
      ...range,
      totals: calculateFinanceTotals(transactions),
      monthly: aggregateMonthlyFinance(transactions, from, to),
      spendingByCategory: aggregateCategorySpending(transactions),
      budgets: await this.budgetsInRange(uid, range, transactions),
      metadata: calculateFinanceMetadata(transactions),
    };
  }

  static rangeError(message: string): ApiError {
    return new ApiError(400, "VALIDATION_ERROR", message);
  }
}