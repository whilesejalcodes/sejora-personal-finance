import { getMonthRange, shiftMonth, type DateRange } from "../../../shared/finance/calculations.js";
import { buildSpendingInsights, detectRecurringPayments, detectSpendingAnomalies } from "../../../shared/finance/intelligence.js";
import type { InsightsData, RecurringPaymentsData, TransactionRecord } from "../../../shared/types/index.js";
import type { TransactionRepository } from "../transactions/transaction-repository.js";

const INTELLIGENCE_PAGE_SIZE = 250;
const MAX_INTELLIGENCE_TRANSACTIONS = 10_000;

export class IntelligenceDataTooLargeError extends Error {
  constructor() {
    super("This date range contains too many transactions. Choose a shorter range.");
    this.name = "IntelligenceDataTooLargeError";
  }
}

function inRange(transaction: TransactionRecord, range: DateRange): boolean {
  const date = transaction.occurredAt.slice(0, 10);
  return date >= range.from && date <= range.to;
}

export class IntelligenceService {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async transactionsInRange(uid: string, range: DateRange): Promise<TransactionRecord[]> {
    const transactions: TransactionRecord[] = [];
    let pageToken: string | undefined;

    do {
      const page = this.transactionRepository.listForAnalytics
        ? await this.transactionRepository.listForAnalytics(uid, {
          ...range,
          pageSize: INTELLIGENCE_PAGE_SIZE,
          ...(pageToken ? { pageToken } : {}),
        })
        : await this.transactionRepository.list(uid, {
          from: range.from,
          to: range.to,
          pageSize: INTELLIGENCE_PAGE_SIZE,
          sort: "oldest",
          ...(pageToken ? { pageToken } : {}),
        });

      transactions.push(...page.items);
      if (transactions.length > MAX_INTELLIGENCE_TRANSACTIONS) throw new IntelligenceDataTooLargeError();
      pageToken = page.hasNextPage ? page.nextCursor ?? undefined : undefined;
      if (page.hasNextPage && !pageToken) throw new IntelligenceDataTooLargeError();
    } while (pageToken);

    return transactions;
  }

  async insights(uid: string, month: string): Promise<InsightsData> {
    const focusRange = getMonthRange(month);
    const comparisonRange = getMonthRange(shiftMonth(month, -1));
    const baselineMonth = shiftMonth(month, -12);
    const baselineEndMonth = shiftMonth(month, -1);
    const baselineRange = {
      from: getMonthRange(baselineMonth).from,
      to: getMonthRange(baselineEndMonth).to,
    };
    const transactions = await this.transactionsInRange(uid, { from: baselineRange.from, to: focusRange.to });
    const focusTransactions = transactions.filter((transaction) => inRange(transaction, focusRange));
    const comparisonTransactions = transactions.filter((transaction) => inRange(transaction, comparisonRange));
    const baselineTransactions = transactions.filter((transaction) => inRange(transaction, baselineRange));
    const focusExpenses = focusTransactions.filter((transaction) => transaction.type === "expense");
    const comparisonExpenses = comparisonTransactions.filter((transaction) => transaction.type === "expense");
    const baselineExpenses = baselineTransactions.filter((transaction) => transaction.type === "expense");

    return {
      month,
      ...focusRange,
      comparisonFrom: comparisonRange.from,
      comparisonTo: comparisonRange.to,
      baselineFrom: baselineRange.from,
      baselineTo: baselineRange.to,
      insights: buildSpendingInsights(focusTransactions, comparisonTransactions),
      anomalies: detectSpendingAnomalies(focusTransactions, baselineTransactions),
      metadata: {
        focusTransactionCount: focusTransactions.length,
        focusExpenseTransactionCount: focusExpenses.length,
        baselineTransactionCount: baselineTransactions.length,
        baselineExpenseTransactionCount: baselineExpenses.length,
        hasComparisonHistory: comparisonExpenses.length >= 2 && focusExpenses.length >= 2,
        hasAnomalyHistory: baselineExpenses.length >= 5,
      },
    };
  }

  async recurringPayments(uid: string, from: string, to: string): Promise<RecurringPaymentsData> {
    const range = { from: getMonthRange(from).from, to: getMonthRange(to).to };
    const transactions = await this.transactionsInRange(uid, range);
    return {
      ...range,
      items: detectRecurringPayments(transactions),
      metadata: {
        transactionCount: transactions.length,
        expenseTransactionCount: transactions.filter((transaction) => transaction.type === "expense").length,
      },
    };
  }
}