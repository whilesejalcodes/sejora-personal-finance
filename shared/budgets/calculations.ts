import type { BudgetRecord, BudgetStatus, BudgetSummary, TransactionRecord } from "../types/index.js";

function endOfMonth(startDate: string): string {
  const [year, month] = startDate.slice(0, 10).split("-").map(Number);
  return `${year}-${String(month).padStart(2, "0")}-${new Date(Date.UTC(year, month, 0)).getUTCDate().toString().padStart(2, "0")}`;
}

export function getBudgetEndDate(budget: Pick<BudgetRecord, "startDate" | "endDate">): string {
  return budget.endDate ? budget.endDate.slice(0, 10) : endOfMonth(budget.startDate);
}

function transactionMatchesBudget(budget: BudgetRecord, transaction: TransactionRecord): boolean {
  if (transaction.type !== "expense") return false;
  if (budget.category && transaction.category !== budget.category) return false;

  const occurredAt = Date.parse(transaction.occurredAt);
  const start = Date.parse(`${budget.startDate.slice(0, 10)}T00:00:00.000Z`);
  const end = Date.parse(`${getBudgetEndDate(budget)}T23:59:59.999Z`);
  return occurredAt >= start && occurredAt <= end;
}

export function calculateBudgetSpent(budget: BudgetRecord, transactions: readonly TransactionRecord[]): number {
  return transactions
    .filter((transaction) => transactionMatchesBudget(budget, transaction))
    .reduce((total, transaction) => total + transaction.amountMinor, 0);
}

export function calculateBudgetRemaining(budget: Pick<BudgetRecord, "amountMinor">, spentMinor: number): number {
  return budget.amountMinor - spentMinor;
}

export function calculateBudgetUsage(budget: Pick<BudgetRecord, "amountMinor">, spentMinor: number): number {
  if (budget.amountMinor <= 0) {
    throw new RangeError("Budget amount must be greater than zero.");
  }
  return Math.round((spentMinor * 10000) / budget.amountMinor) / 100;
}

export function getBudgetStatus(budget: Pick<BudgetRecord, "amountMinor">, spentMinor: number): BudgetStatus {
  if (spentMinor > budget.amountMinor) return "overspent";
  if (spentMinor === budget.amountMinor) return "at_limit";
  if (spentMinor * 100 >= budget.amountMinor * 80) return "approaching";
  return "healthy";
}

export function calculateBudgetSummary(
  budget: BudgetRecord,
  transactions: readonly TransactionRecord[],
): BudgetSummary {
  const spentMinor = calculateBudgetSpent(budget, transactions);
  return {
    spentMinor,
    remainingMinor: calculateBudgetRemaining(budget, spentMinor),
    usagePercent: calculateBudgetUsage(budget, spentMinor),
    status: getBudgetStatus(budget, spentMinor),
  };
}