import { describe, expect, it } from "vitest";
import {
  baselineMetrics,
  buildForecastHistory,
  forecastStatus,
  projectMonths,
  scenarioMetrics,
} from "../../shared/forecast/calculations.js";
import type { MonthlyFinancePoint } from "../../shared/types/index.js";

const monthly: MonthlyFinancePoint[] = [
  { month: "2026-03", incomeMinor: 100_000, expenseMinor: 70_000, netFlowMinor: 30_000, transactionCount: 2 },
  { month: "2026-04", incomeMinor: 100_000, expenseMinor: 70_000, netFlowMinor: 30_000, transactionCount: 2 },
  { month: "2026-05", incomeMinor: 100_000, expenseMinor: 70_000, netFlowMinor: 30_000, transactionCount: 2 },
  { month: "2026-06", incomeMinor: 100_000, expenseMinor: 70_000, netFlowMinor: 30_000, transactionCount: 2 },
  { month: "2026-07", incomeMinor: 0, expenseMinor: 0, netFlowMinor: 0, transactionCount: 0 },
  { month: "2026-08", incomeMinor: 100_001, expenseMinor: 70_001, netFlowMinor: 30_000, transactionCount: 2 },
];

describe("forecast calculations", () => {
  it("keeps empty months explicit and averages only months with recorded activity", () => {
    const history = buildForecastHistory(monthly);
    expect(history[4]).toMatchObject({ month: "2026-07", hasRecordedActivity: false });
    expect(baselineMetrics(history.filter((point) => point.hasRecordedActivity), 180_000)).toEqual({
      monthlyIncomeMinor: 100_000,
      monthlyExpenseMinor: 70_000,
      monthlySavingsMinor: 30_000,
      savingsRate: 30,
      endingBalanceMinor: 180_000,
    });
  });

  it("projects balances deterministically and applies a one-time expense once", () => {
    const metrics = baselineMetrics(buildForecastHistory(monthly).filter((point) => point.hasRecordedActivity), 180_000);
    expect(projectMonths(metrics, 180_000, "2026-10", 3, 50_000)).toEqual([
      { month: "2026-10", incomeMinor: 100_000, expenseMinor: 120_000, netSavingsMinor: -20_000, savingsRate: -20, balanceMinor: 160_000 },
      { month: "2026-11", incomeMinor: 100_000, expenseMinor: 70_000, netSavingsMinor: 30_000, savingsRate: 30, balanceMinor: 190_000 },
      { month: "2026-12", incomeMinor: 100_000, expenseMinor: 70_000, netSavingsMinor: 30_000, savingsRate: 30, balanceMinor: 220_000 },
    ]);
  });

  it("applies a ten percent expense reduction without floating-point money storage", () => {
    const metrics = baselineMetrics(buildForecastHistory(monthly).filter((point) => point.hasRecordedActivity), 180_000);
    const scenario = scenarioMetrics(metrics, 180_000, 0, -10);
    expect(scenario).toMatchObject({ monthlyIncomeMinor: 100_000, monthlyExpenseMinor: 63_000, monthlySavingsMinor: 37_000, savingsRate: 37 });
  });

  it("returns explicit data sufficiency states and handles zero income", () => {
    expect(forecastStatus(0).status).toBe("insufficient_data");
    expect(forecastStatus(3).status).toBe("limited_data");
    expect(forecastStatus(6).status).toBe("ready");
    expect(baselineMetrics([
      { month: "2026-01", incomeMinor: 0, expenseMinor: 100, netSavingsMinor: -100, transactionCount: 1, hasRecordedActivity: true },
      { month: "2026-02", incomeMinor: 0, expenseMinor: 200, netSavingsMinor: -200, transactionCount: 1, hasRecordedActivity: true },
    ], 0)?.savingsRate).toBeNull();
  });
});