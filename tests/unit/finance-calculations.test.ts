import { describe, expect, it } from "vitest";
import {
  aggregateCategorySpending,
  aggregateMonthlyFinance,
  calculateFinanceMetadata,
  calculateFinanceTotals,
  calculateSavingsRate,
  getMonthRange,
  monthSequence,
} from "../../shared/finance/calculations.js";
import type { TransactionRecord } from "../../shared/types/index.js";

function transaction(
  id: string,
  type: TransactionRecord["type"],
  amountMinor: number,
  occurredAt: string,
  category?: string,
): TransactionRecord {
  return {
    id,
    amountMinor,
    currency: "INR",
    type,
    merchant: id,
    ...(category ? { category } : {}),
    occurredAt: `${occurredAt}T00:00:00.000Z`,
    source: "manual",
    createdAt: `${occurredAt}T00:00:00.000Z`,
    updatedAt: `${occurredAt}T00:00:00.000Z`,
  };
}

describe("finance calculations", () => {
  it("calculates income, expenses, balance, savings, and savings rate in minor units", () => {
    const result = calculateFinanceTotals([
      transaction("salary", "income", 100_000, "2026-09-01"),
      transaction("food", "expense", 12_500, "2026-09-02", "Food"),
      transaction("travel", "expense", 7_500, "2026-09-03", "Travel"),
    ]);
    expect(result).toEqual({
      incomeMinor: 100_000,
      expenseMinor: 20_000,
      balanceMinor: 80_000,
      savingsMinor: 80_000,
      savingsRate: 80,
    });
  });

  it("returns an unavailable savings rate when income is zero", () => {
    expect(calculateSavingsRate(0, -5_000)).toBeNull();
    expect(calculateFinanceTotals([]).savingsRate).toBeNull();
    expect(calculateFinanceTotals([transaction("expense", "expense", 5_000, "2026-09-01")]).savingsRate).toBeNull();
  });

  it("returns a 100 percent savings rate for income-only activity", () => {
    expect(calculateFinanceTotals([transaction("income", "income", 123_45, "2026-09-01")]).savingsRate).toBe(100);
  });

  it("aggregates expense categories unchanged and excludes income", () => {
    expect(aggregateCategorySpending([
      transaction("salary", "income", 100_000, "2026-09-01", "Salary"),
      transaction("food-one", "expense", 2_500, "2026-09-01", "Food"),
      transaction("food-two", "expense", 7_500, "2026-09-02", "Food"),
      transaction("travel", "expense", 5_000, "2026-09-03", "Travel"),
    ])).toEqual([
      { category: "Food", amountMinor: 10_000, percentage: 66.67 },
      { category: "Travel", amountMinor: 5_000, percentage: 33.33 },
    ]);
  });

  it("includes uncategorized income in totals, monthly totals, and counts", () => {
    const uncategorizedIncome = transaction("salary", "income", 100_000, "2026-09-01");
    expect(calculateFinanceTotals([uncategorizedIncome])).toEqual({
      incomeMinor: 100_000,
      expenseMinor: 0,
      balanceMinor: 100_000,
      savingsMinor: 100_000,
      savingsRate: 100,
    });
    expect(aggregateMonthlyFinance([uncategorizedIncome], "2026-09", "2026-09")).toEqual([
      { month: "2026-09", incomeMinor: 100_000, expenseMinor: 0, netFlowMinor: 100_000, transactionCount: 1 },
    ]);
    expect(calculateFinanceMetadata([uncategorizedIncome])).toEqual({
      transactionCount: 1,
      incomeTransactionCount: 1,
      expenseTransactionCount: 0,
    });
    expect(aggregateCategorySpending([uncategorizedIncome])).toEqual([]);
  });

  it("fills empty months and groups by the intended date representation", () => {
    expect(getMonthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthSequence("2025-12", "2026-02")).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(aggregateMonthlyFinance([
      transaction("dec", "expense", 1_000, "2025-12-31"),
      transaction("jan-income", "income", 20_000, "2026-01-01"),
      transaction("jan-expense", "expense", 3_000, "2026-01-31"),
    ], "2025-12", "2026-02")).toEqual([
      { month: "2025-12", incomeMinor: 0, expenseMinor: 1_000, netFlowMinor: -1_000, transactionCount: 1 },
      { month: "2026-01", incomeMinor: 20_000, expenseMinor: 3_000, netFlowMinor: 17_000, transactionCount: 2 },
      { month: "2026-02", incomeMinor: 0, expenseMinor: 0, netFlowMinor: 0, transactionCount: 0 },
    ]);
  });

  it("counts income and expense records separately", () => {
    expect(calculateFinanceMetadata([
      transaction("income", "income", 1_000, "2026-09-01"),
      transaction("expense-one", "expense", 100, "2026-09-01"),
      transaction("expense-two", "expense", 200, "2026-09-01"),
    ])).toEqual({ transactionCount: 3, incomeTransactionCount: 1, expenseTransactionCount: 2 });
  });
});