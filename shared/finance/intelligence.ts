import type {
  RecurringFrequency,
  RecurringPayment,
  SpendingAnomaly,
  SpendingInsight,
  TransactionRecord,
} from "../types/index.js";

const MINOR_CATEGORY_CHANGE = 50_000;
const MIN_CATEGORY_CHANGE_PERCENT = 20;
const MIN_ANOMALY_BASELINE = 5;
const MIN_CATEGORY_ANOMALY_BASELINE = 3;
const MIN_RECURRING_OCCURRENCES = 3;

type CategorySummary = {
  amountMinor: number;
  transactionCount: number;
};

function expenseTransactions(transactions: readonly TransactionRecord[]): TransactionRecord[] {
  return transactions.filter((transaction) => transaction.type === "expense");
}

function expenseCategory(transaction: TransactionRecord): string {
  return transaction.category?.trim() || "Uncategorized";
}

function categorySummaries(transactions: readonly TransactionRecord[]): Map<string, CategorySummary> {
  const summaries = new Map<string, CategorySummary>();
  for (const transaction of expenseTransactions(transactions)) {
    const category = expenseCategory(transaction);
    const current = summaries.get(category) ?? { amountMinor: 0, transactionCount: 0 };
    current.amountMinor += transaction.amountMinor;
    current.transactionCount += 1;
    summaries.set(category, current);
  }
  return summaries;
}

function roundedPercentage(numerator: number, denominator: number): number {
  return Math.round((numerator * 10000) / denominator) / 100;
}

function roundedAverage(values: readonly number[]): number {
  return Math.floor(values.reduce((total, value) => total + value, 0) / values.length);
}

function comparableChangePercent(current: number, previous: number): number {
  return Math.round(((current - previous) * 10000) / previous) / 100;
}

function sortByAmount(left: TransactionRecord, right: TransactionRecord): number {
  return right.amountMinor - left.amountMinor
    || right.occurredAt.localeCompare(left.occurredAt)
    || right.id.localeCompare(left.id);
}

export function buildSpendingInsights(
  currentTransactions: readonly TransactionRecord[],
  previousTransactions: readonly TransactionRecord[],
): SpendingInsight[] {
  const currentExpenses = expenseTransactions(currentTransactions);
  if (currentExpenses.length === 0) return [];

  const currentCategories = categorySummaries(currentTransactions);
  const previousCategories = categorySummaries(previousTransactions);
  const totalExpenses = currentExpenses.reduce((total, transaction) => total + transaction.amountMinor, 0);
  const rankedCategories = [...currentCategories.entries()]
    .sort(([leftCategory, left], [rightCategory, right]) =>
      right.amountMinor - left.amountMinor || leftCategory.localeCompare(rightCategory));
  const insights: SpendingInsight[] = [];

  const [largestCategory, largestCategorySummary] = rankedCategories[0];
  insights.push({
    id: "largest-category",
    kind: "largest_category",
    title: "Highest-spending category",
    category: largestCategory,
    amountMinor: largestCategorySummary.amountMinor,
    percentage: roundedPercentage(largestCategorySummary.amountMinor, totalExpenses),
    transactionCount: largestCategorySummary.transactionCount,
  });

  const largestExpense = [...currentExpenses].sort(sortByAmount)[0];
  insights.push({
    id: "largest-expense",
    kind: "largest_expense",
    title: "Largest expense",
    merchant: largestExpense.merchant,
    category: expenseCategory(largestExpense),
    amountMinor: largestExpense.amountMinor,
    transactionCount: 1,
  });

  if (currentExpenses.length >= 2 && expenseTransactions(previousTransactions).length >= 2) {
    const categoryNames = new Set([...currentCategories.keys(), ...previousCategories.keys()]);
    for (const category of [...categoryNames].sort()) {
      const current = currentCategories.get(category);
      const previous = previousCategories.get(category);
      if (!current || !previous || previous.amountMinor === 0) continue;
      const changePercent = comparableChangePercent(current.amountMinor, previous.amountMinor);
      if (
        Math.abs(changePercent) < MIN_CATEGORY_CHANGE_PERCENT
        || Math.abs(current.amountMinor - previous.amountMinor) < MINOR_CATEGORY_CHANGE
      ) continue;
      insights.push({
        id: `category-change-${category.toLocaleLowerCase("en-IN").replace(/[^a-z0-9]+/g, "-")}`,
        kind: "category_change",
        title: changePercent > 0 ? "Category spending increased" : "Category spending decreased",
        category,
        amountMinor: current.amountMinor,
        previousAmountMinor: previous.amountMinor,
        changePercent,
        transactionCount: current.transactionCount,
      });
    }
  }

  const topTwoAmount = rankedCategories.slice(0, 2).reduce((total, [, summary]) => total + summary.amountMinor, 0);
  if (rankedCategories.length >= 3 && roundedPercentage(topTwoAmount, totalExpenses) >= 70) {
    insights.push({
      id: "spending-concentration",
      kind: "spending_concentration",
      title: "Spending concentration",
      categories: rankedCategories.slice(0, 2).map(([category]) => category),
      percentage: roundedPercentage(topTwoAmount, totalExpenses),
      transactionCount: currentExpenses.length,
    });
  }

  const [mostFrequentCategory, mostFrequentSummary] = [...currentCategories.entries()]
    .sort(([leftCategory, left], [rightCategory, right]) =>
      right.transactionCount - left.transactionCount || right.amountMinor - left.amountMinor || leftCategory.localeCompare(rightCategory))[0];
  if (currentExpenses.length >= 5 && mostFrequentSummary.transactionCount >= 4) {
    insights.push({
      id: "high-frequency-category",
      kind: "high_frequency",
      title: "Frequent spending category",
      category: mostFrequentCategory,
      transactionCount: mostFrequentSummary.transactionCount,
      amountMinor: mostFrequentSummary.amountMinor,
    });
  }

  return insights;
}

function dateOnly(transaction: TransactionRecord): string {
  return transaction.occurredAt.slice(0, 10);
}

function utcDay(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function addDays(date: string, days: number): string {
  const next = new Date(utcDay(date) * 86_400_000);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function normalizeMerchant(merchant: string): string {
  return merchant.trim().toLocaleLowerCase("en-IN").replace(/\s+/g, " ");
}

export function detectSpendingAnomalies(
  focusTransactions: readonly TransactionRecord[],
  baselineTransactions: readonly TransactionRecord[],
): SpendingAnomaly[] {
  const baselineExpenses = expenseTransactions(baselineTransactions);
  if (baselineExpenses.length < MIN_ANOMALY_BASELINE) return [];

  const baselineAmounts = baselineExpenses.map((transaction) => transaction.amountMinor);
  const overallAverageMinor = roundedAverage(baselineAmounts);
  const byCategory = new Map<string, number[]>();
  for (const transaction of baselineExpenses) {
    const category = expenseCategory(transaction);
    const amounts = byCategory.get(category) ?? [];
    amounts.push(transaction.amountMinor);
    byCategory.set(category, amounts);
  }

  const anomalies: SpendingAnomaly[] = [];
  for (const transaction of [...expenseTransactions(focusTransactions)].sort(sortByAmount)) {
    const category = expenseCategory(transaction);
    const categoryBaseline = byCategory.get(category) ?? [];
    if (categoryBaseline.length >= MIN_CATEGORY_ANOMALY_BASELINE) {
      const baselineAverageMinor = roundedAverage(categoryBaseline);
      const threshold = Math.max(baselineAverageMinor * 2, baselineAverageMinor + MINOR_CATEGORY_CHANGE);
      if (transaction.amountMinor >= threshold) {
        anomalies.push({
          id: `anomaly-${transaction.id}`,
          transactionId: transaction.id,
          amountMinor: transaction.amountMinor,
          merchant: transaction.merchant,
          category,
          occurredAt: dateOnly(transaction),
          signal: "category_amount",
          baselineAverageMinor,
          baselineTransactionCount: categoryBaseline.length,
        });
        continue;
      }
    }

    const overallThreshold = Math.max(overallAverageMinor * 3, overallAverageMinor + 100_000);
    if (transaction.amountMinor >= overallThreshold) {
      anomalies.push({
        id: `anomaly-${transaction.id}`,
        transactionId: transaction.id,
        amountMinor: transaction.amountMinor,
        merchant: transaction.merchant,
        category,
        occurredAt: dateOnly(transaction),
        signal: "overall_amount",
        baselineAverageMinor: overallAverageMinor,
        baselineTransactionCount: baselineExpenses.length,
      });
    }
  }
  return anomalies;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.floor((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

function intervalFor(intervals: readonly number[]): { frequency: RecurringFrequency; tolerance: number } | null {
  const average = intervals.reduce((total, value) => total + value, 0) / intervals.length;
  const spread = Math.max(...intervals) - Math.min(...intervals);
  if (average >= 6 && average <= 8 && spread <= 2 && intervals.every((interval) => interval >= 6 && interval <= 8)) {
    return { frequency: "weekly", tolerance: 2 };
  }
  if (average >= 27 && average <= 33 && spread <= 4 && intervals.every((interval) => interval >= 27 && interval <= 33)) {
    return { frequency: "monthly", tolerance: 4 };
  }
  if (average >= 80 && average <= 100 && spread <= 10 && intervals.every((interval) => interval >= 80 && interval <= 100)) {
    return { frequency: "quarterly", tolerance: 10 };
  }
  return null;
}

function mostCommonValue(values: readonly string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([left], [right]) => (counts.get(right) ?? 0) - (counts.get(left) ?? 0) || left.localeCompare(right))[0]?.[0];
}

function representativeMerchant(transactions: readonly TransactionRecord[]): string {
  const counts = new Map<string, { label: string; count: number }>();
  for (const transaction of transactions) {
    const key = transaction.merchant.trim();
    const current = counts.get(key.toLocaleLowerCase("en-IN")) ?? { label: key, count: 0 };
    current.count += 1;
    if (key.localeCompare(current.label) < 0) current.label = key;
    counts.set(key.toLocaleLowerCase("en-IN"), current);
  }
  return [...counts.values()].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))[0].label;
}

export function detectRecurringPayments(transactions: readonly TransactionRecord[]): RecurringPayment[] {
  const groups = new Map<string, TransactionRecord[]>();
  for (const transaction of expenseTransactions(transactions)) {
    const key = normalizeMerchant(transaction.merchant);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(transaction);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .flatMap(([normalizedMerchant, group]) => {
      const sorted = [...group].sort((left, right) => dateOnly(left).localeCompare(dateOnly(right)) || left.id.localeCompare(right.id));
      if (sorted.length < MIN_RECURRING_OCCURRENCES) return [];
      const dates = sorted.map(dateOnly);
      const intervals = dates.slice(1).map((date, index) => utcDay(date) - utcDay(dates[index]));
      if (intervals.some((interval) => interval <= 0)) return [];
      const pattern = intervalFor(intervals);
      if (!pattern) return [];

      const typicalAmountMinor = median(sorted.map((transaction) => transaction.amountMinor));
      const amountTolerance = Math.max(100, Math.floor(typicalAmountMinor * 0.15));
      if (sorted.some((transaction) => Math.abs(transaction.amountMinor - typicalAmountMinor) > amountTolerance)) return [];

      const intervalDays = Math.round(intervals.reduce((total, value) => total + value, 0) / intervals.length);
      const categoryValues = sorted.map(expenseCategory);
      const commonCategory = mostCommonValue(categoryValues);
      const category = categoryValues.every((value) => value === commonCategory) ? commonCategory : undefined;
      const confidence = Math.min(
        98,
        65
          + Math.min(15, (sorted.length - MIN_RECURRING_OCCURRENCES) * 4)
          + (Math.max(...intervals) - Math.min(...intervals) <= 1 ? 10 : 5)
          + (Math.max(...sorted.map((transaction) => Math.abs(transaction.amountMinor - typicalAmountMinor))) <= Math.floor(amountTolerance / 2) ? 10 : 5),
      );

      return [{
        id: `recurring-${normalizedMerchant}`,
        merchant: representativeMerchant(sorted),
        ...(category ? { category } : {}),
        typicalAmountMinor,
        frequency: pattern.frequency,
        lastOccurrence: dates[dates.length - 1],
        nextExpectedOccurrence: addDays(dates[dates.length - 1], intervalDays),
        confidence,
        occurrenceCount: sorted.length,
        intervalDays,
      }];
    })
    .sort((left, right) => right.confidence - left.confidence || left.merchant.localeCompare(right.merchant));
}