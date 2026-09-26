import type {
  ForecastHistoricalPoint,
  ForecastMetrics,
  ForecastProjectedPoint,
  ForecastStatus,
  MonthlyFinancePoint,
} from "../types/index.js";

export const FORECAST_HISTORICAL_MONTHS = 6;

function roundPercentage(numerator: number, denominator: number): number {
  return Math.round((numerator * 10000) / denominator) / 100;
}

function average(values: readonly number[]): number {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function buildForecastHistory(monthly: readonly MonthlyFinancePoint[]): ForecastHistoricalPoint[] {
  return monthly.map((point) => ({
    month: point.month,
    incomeMinor: point.incomeMinor,
    expenseMinor: point.expenseMinor,
    netSavingsMinor: point.netFlowMinor,
    transactionCount: point.transactionCount,
    hasRecordedActivity: point.transactionCount > 0,
  }));
}

export function forecastStatus(activeMonthCount: number): {
  status: ForecastStatus;
  message: string;
} {
  if (activeMonthCount < 2) {
    return {
      status: "insufficient_data",
      message: "At least two completed months with recorded activity are needed for a projection.",
    };
  }
  if (activeMonthCount < 4) {
    return {
      status: "limited_data",
      message: "This projection uses limited recorded history and should be treated as an early estimate.",
    };
  }
  return {
    status: "ready",
    message: "Projection based on recent completed-month history.",
  };
}

export function baselineMetrics(
  activeHistory: readonly ForecastHistoricalPoint[],
  actualBalanceMinor: number,
): ForecastMetrics | null {
  if (activeHistory.length < 2) return null;
  const monthlyIncomeMinor = average(activeHistory.map((point) => point.incomeMinor));
  const monthlyExpenseMinor = average(activeHistory.map((point) => point.expenseMinor));
  const monthlySavingsMinor = monthlyIncomeMinor - monthlyExpenseMinor;
  return {
    monthlyIncomeMinor,
    monthlyExpenseMinor,
    monthlySavingsMinor,
    savingsRate: monthlyIncomeMinor > 0 ? roundPercentage(monthlySavingsMinor, monthlyIncomeMinor) : null,
    endingBalanceMinor: actualBalanceMinor,
  };
}

export function projectMonths(
  metrics: ForecastMetrics | null,
  actualBalanceMinor: number,
  fromMonth: string,
  horizon: 1 | 3 | 6,
  oneTimeExpenseMinor = 0,
): ForecastProjectedPoint[] {
  if (!metrics) return [];
  const points: ForecastProjectedPoint[] = [];
  let balanceMinor = actualBalanceMinor;
  for (let index = 0; index < horizon; index += 1) {
    const expenseMinor = metrics.monthlyExpenseMinor + (index === 0 ? oneTimeExpenseMinor : 0);
    const netSavingsMinor = metrics.monthlyIncomeMinor - expenseMinor;
    balanceMinor += netSavingsMinor;
    points.push({
      month: fromMonth,
      incomeMinor: metrics.monthlyIncomeMinor,
      expenseMinor,
      netSavingsMinor,
      savingsRate: metrics.monthlyIncomeMinor > 0
        ? roundPercentage(netSavingsMinor, metrics.monthlyIncomeMinor)
        : null,
      balanceMinor,
    });
    const [year, month] = fromMonth.split("-").map(Number);
    const next = new Date(Date.UTC(year, month, 1));
    fromMonth = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return points;
}

export function scenarioMetrics(
  baseline: ForecastMetrics | null,
  actualBalanceMinor: number,
  incomeAdjustmentPercent: number,
  expenseAdjustmentPercent: number,
): ForecastMetrics | null {
  if (!baseline) return null;
  const monthlyIncomeMinor = Math.round(baseline.monthlyIncomeMinor * (1 + incomeAdjustmentPercent / 100));
  const monthlyExpenseMinor = Math.round(baseline.monthlyExpenseMinor * (1 + expenseAdjustmentPercent / 100));
  const monthlySavingsMinor = monthlyIncomeMinor - monthlyExpenseMinor;
  return {
    monthlyIncomeMinor,
    monthlyExpenseMinor,
    monthlySavingsMinor,
    savingsRate: monthlyIncomeMinor > 0 ? roundPercentage(monthlySavingsMinor, monthlyIncomeMinor) : null,
    endingBalanceMinor: actualBalanceMinor,
  };
}