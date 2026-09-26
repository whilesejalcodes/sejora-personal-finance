import { describe, expect, it } from "vitest";
import { budgetCreateSchema } from "../../shared/schemas/index.js";
import {
  calculateBudgetRemaining,
  calculateBudgetSpent,
  calculateBudgetSummary,
  calculateBudgetUsage,
  getBudgetStatus,
} from "../../shared/budgets/calculations.js";
import type { BudgetRecord, TransactionRecord } from "../../shared/types/index.js";

const budget: BudgetRecord = {
  id: "budget-1",
  name: "Food",
  category: "Food",
  amountMinor: 500000,
  currency: "INR",
  period: "monthly",
  startDate: "2026-09-01T00:00:00.000Z",
  endDate: "2026-09-30T23:59:59.999Z",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

function transaction(overrides: Partial<TransactionRecord>): TransactionRecord {
  return {
    id: "transaction",
    amountMinor: 100000,
    currency: "INR",
    type: "expense",
    merchant: "Market",
    category: "Food",
    occurredAt: "2026-09-15T00:00:00.000Z",
    source: "manual",
    createdAt: "2026-09-15T00:00:00.000Z",
    updatedAt: "2026-09-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("budget calculations", () => {
  it("calculates normal usage, remaining amount, and status deterministically", () => {
    const summary = calculateBudgetSummary(budget, [transaction({ amountMinor: 400000 })]);
    expect(summary).toEqual({
      spentMinor: 400000,
      remainingMinor: 100000,
      usagePercent: 80,
      status: "approaching",
    });
  });

  it("handles zero spending and empty transaction history", () => {
    expect(calculateBudgetSpent(budget, [])).toBe(0);
    expect(calculateBudgetSummary(budget, [])).toMatchObject({
      spentMinor: 0,
      remainingMinor: 500000,
      usagePercent: 0,
      status: "healthy",
    });
  });

  it("uses exact thresholds for healthy, approaching, at-limit, and overspent", () => {
    expect(getBudgetStatus(budget, 399999)).toBe("healthy");
    expect(getBudgetStatus(budget, 400000)).toBe("approaching");
    expect(getBudgetStatus(budget, 500000)).toBe("at_limit");
    expect(getBudgetStatus(budget, 500001)).toBe("overspent");
  });

  it("ignores income, mismatched categories, and transactions outside the period", () => {
    const spent = calculateBudgetSpent(budget, [
      transaction({ amountMinor: 1000, type: "income" }),
      transaction({ amountMinor: 2000, category: "Travel" }),
      transaction({ amountMinor: 3000, occurredAt: "2026-08-31T23:59:59.999Z" }),
      transaction({ amountMinor: 4000, occurredAt: "2026-09-30T23:59:59.999Z" }),
    ]);
    expect(spent).toBe(4000);
  });

  it("supports an implicit monthly end date and large integer amounts", () => {
    const monthlyBudget = { ...budget, endDate: undefined, amountMinor: 9_999_999_999 };
    expect(calculateBudgetSpent(monthlyBudget, [
      transaction({ amountMinor: 9_000_000_000, occurredAt: "2026-09-30T23:59:59.999Z" }),
    ])).toBe(9_000_000_000);
    expect(calculateBudgetUsage(monthlyBudget, 9_000_000_000)).toBe(90);
    expect(calculateBudgetRemaining(monthlyBudget, 9_000_000_000)).toBe(999_999_999);
  });

  it("rejects invalid amounts and date ranges at the schema boundary", () => {
    expect(budgetCreateSchema.safeParse({
      name: "Invalid",
      amountMinor: 0,
      period: "monthly",
      startDate: "2026-09-30",
      endDate: "2026-09-01",
    }).success).toBe(false);
    expect(budgetCreateSchema.safeParse({
      name: "Invalid dates",
      amountMinor: 100,
      period: "monthly",
      startDate: "2026-09-30",
      endDate: "2026-09-01",
    }).success).toBe(false);
  });
});