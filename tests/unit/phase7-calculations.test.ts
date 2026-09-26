import { describe, expect, it } from "vitest";
import { calculateFinancialHealth } from "../../shared/finance/health.js";
import { calculateGoalProgress } from "../../shared/goals/calculations.js";
import type { BudgetView, GoalView, RecurringPayment } from "../../shared/types/index.js";

function budget(usagePercent: number): BudgetView {
  return {
    id: "budget-1",
    name: "Monthly",
    amountMinor: 100_000,
    currency: "INR",
    period: "monthly",
    startDate: "2026-09-01T00:00:00.000Z",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    spentMinor: Math.round(usagePercent * 1_000),
    remainingMinor: 100_000 - Math.round(usagePercent * 1_000),
    usagePercent,
    status: usagePercent > 100 ? "overspent" : usagePercent === 100 ? "at_limit" : usagePercent >= 80 ? "approaching" : "healthy",
  };
}

const recurring: RecurringPayment = {
  id: "recurring-rent",
  merchant: "Rent",
  category: "Housing",
  typicalAmountMinor: 20_000,
  frequency: "monthly",
  lastOccurrence: "2026-08-01",
  nextExpectedOccurrence: "2026-09-01",
  confidence: 90,
  occurrenceCount: 3,
  intervalDays: 31,
};

const goal: GoalView = {
  id: "goal-1",
  name: "Emergency fund",
  targetAmountMinor: 100_000,
  currentAmountMinor: 50_000,
  currency: "INR",
  targetDate: "2027-01-01",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  remainingAmountMinor: 50_000,
  percentageComplete: 50,
  status: "in_progress",
};

function healthInput(overrides: Partial<Parameters<typeof calculateFinancialHealth>[0]> = {}) {
  return {
    month: "2026-09",
    totals: { incomeMinor: 100_000, expenseMinor: 60_000, balanceMinor: 40_000, savingsMinor: 40_000, savingsRate: 40 },
    expenseByMonth: [50_000, 55_000, 60_000],
    historyMonths: 3,
    budgets: [budget(60)],
    recurringPayments: [recurring],
    goals: [goal],
    transactionCount: 6,
    incomeTransactionCount: 3,
    expenseTransactionCount: 3,
    ...overrides,
  };
}

describe("goal calculations", () => {
  it("calculates no progress and remaining amount", () => {
    expect(calculateGoalProgress({ targetAmountMinor: 100_000, currentAmountMinor: 0, targetDate: "2027-01-01" }, "2026-09-02")).toEqual({
      remainingAmountMinor: 100_000,
      percentageComplete: 0,
      status: "not_started",
    });
  });

  it("calculates partial and nearly-complete progress", () => {
    expect(calculateGoalProgress({ targetAmountMinor: 100_000, currentAmountMinor: 50_000, targetDate: "2027-01-01" }, "2026-09-02").percentageComplete).toBe(50);
    expect(calculateGoalProgress({ targetAmountMinor: 100_000, currentAmountMinor: 80_000, targetDate: "2027-01-01" }, "2026-09-02").status).toBe("nearly_there");
  });

  it("marks completed goals and never returns negative remaining", () => {
    expect(calculateGoalProgress({ targetAmountMinor: 100_000, currentAmountMinor: 100_000, targetDate: "2025-01-01" }, "2026-09-02")).toMatchObject({ percentageComplete: 100, remainingAmountMinor: 0, status: "completed" });
  });

  it("marks incomplete goals overdue after the target date", () => {
    expect(calculateGoalProgress({ targetAmountMinor: 100_000, currentAmountMinor: 25_000, targetDate: "2026-09-01" }, "2026-09-02").status).toBe("overdue");
  });
});

describe("financial health calculations", () => {
  it("returns an explicit insufficient-data state with no transactions", () => {
    const result = calculateFinancialHealth(healthInput({
      totals: { incomeMinor: 0, expenseMinor: 0, balanceMinor: 0, savingsMinor: 0, savingsRate: null },
      expenseByMonth: [],
      historyMonths: 0,
      budgets: [],
      recurringPayments: [],
      goals: [],
      transactionCount: 0,
      incomeTransactionCount: 0,
      expenseTransactionCount: 0,
    }));
    expect(result.score).toBeNull();
    expect(result.status).toBe("insufficient_data");
    expect(result.components.every((item) => item.available === false)).toBe(true);
  });

  it("does not produce a full score for income-only or short history", () => {
    const result = calculateFinancialHealth(healthInput({
      totals: { incomeMinor: 100_000, expenseMinor: 0, balanceMinor: 100_000, savingsMinor: 100_000, savingsRate: 100 },
      expenseByMonth: [],
      historyMonths: 1,
      budgets: [],
      recurringPayments: [],
      goals: [],
      transactionCount: 1,
      incomeTransactionCount: 1,
      expenseTransactionCount: 0,
    }));
    expect(result.score).toBeNull();
    expect(result.components.find((item) => item.key === "savings")).toMatchObject({ available: true, score: 30 });
  });

  it("calculates a deterministic mixed-data score and all supported components", () => {
    const result = calculateFinancialHealth(healthInput());
    expect(result.score).not.toBeNull();
    expect(result.status).toBe("established");
    expect(result.coveragePercent).toBe(100);
    expect(result.components.every((item) => item.available)).toBe(true);
  });

  it("reduces budget and recurring components when pressure increases", () => {
    const baseline = calculateFinancialHealth(healthInput());
    const pressured = calculateFinancialHealth(healthInput({
      budgets: [budget(130)],
      recurringPayments: [{ ...recurring, typicalAmountMinor: 90_000 }],
    }));
    expect(pressured.components.find((item) => item.key === "budget_discipline")!.score).toBeLessThan(baseline.components.find((item) => item.key === "budget_discipline")!.score);
    expect(pressured.components.find((item) => item.key === "recurring_cost_pressure")!.score).toBeLessThan(baseline.components.find((item) => item.key === "recurring_cost_pressure")!.score);
  });
});