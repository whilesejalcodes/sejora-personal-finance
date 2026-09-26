import {
  aggregateMonthlyFinance,
  getMonthRange,
  monthSequence,
  shiftMonth,
} from "../../../shared/finance/calculations.js";
import {
  baselineMetrics,
  buildForecastHistory,
  FORECAST_HISTORICAL_MONTHS,
  forecastStatus,
  projectMonths,
  scenarioMetrics,
} from "../../../shared/forecast/calculations.js";
import type {
  ForecastData,
  ForecastMetrics,
  ForecastProjectedPoint,
  ForecastSimulationData,
} from "../../../shared/types/index.js";
import type { ForecastSimulationInput } from "../../../shared/schemas/index.js";
import { IntelligenceService } from "../intelligence/intelligence-service.js";
import type { TransactionRepository } from "../transactions/transaction-repository.js";

type Clock = () => string;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function withEndingBalance(metrics: ForecastMetrics | null, projected: readonly ForecastProjectedPoint[]): ForecastMetrics | null {
  if (!metrics) return null;
  return {
    ...metrics,
    endingBalanceMinor: projected.at(-1)?.balanceMinor ?? metrics.endingBalanceMinor,
  };
}

function projectedBundle(metrics: ForecastMetrics | null, actualBalanceMinor: number, fromMonth: string, horizon: 1 | 3 | 6, oneTimeExpenseMinor = 0) {
  const projected = projectMonths(metrics, actualBalanceMinor, fromMonth, horizon, oneTimeExpenseMinor);
  return {
    metrics: withEndingBalance(metrics, projected),
    projected,
  };
}

export class ForecastService {
  private readonly intelligence: IntelligenceService;

  constructor(
    transactionRepository: TransactionRepository,
    private readonly clock: Clock = todayUtc,
  ) {
    this.intelligence = new IntelligenceService(transactionRepository);
  }

  private async sourceTransactions(uid: string, asOfDate: string) {
    return this.intelligence.transactionsInRange(uid, { from: "1900-01-01", to: asOfDate });
  }

  async forecast(uid: string, horizon: 1 | 3 | 6): Promise<ForecastData> {
    const asOfDate = this.clock();
    const currentMonth = asOfDate.slice(0, 7);
    const historicalFromMonth = shiftMonth(currentMonth, -FORECAST_HISTORICAL_MONTHS);
    const historicalToMonth = shiftMonth(currentMonth, -1);
    const allTransactions = await this.sourceTransactions(uid, asOfDate);
    const historical = buildForecastHistory(aggregateMonthlyFinance(
      allTransactions,
      historicalFromMonth,
      historicalToMonth,
    ));
    const activeHistory = historical.filter((point) => point.hasRecordedActivity);
    const { status, message: statusMessage } = forecastStatus(activeHistory.length);
    const actualBalanceMinor = allTransactions.reduce(
      (total, transaction) => total + (transaction.type === "income" ? transaction.amountMinor : -transaction.amountMinor),
      0,
    );
    const metrics = baselineMetrics(activeHistory, actualBalanceMinor);
    const projected = projectedBundle(metrics, actualBalanceMinor, shiftMonth(currentMonth, 1), horizon);

    return {
      asOfDate,
      historicalWindow: {
        from: getMonthRange(historicalFromMonth).from,
        to: getMonthRange(historicalToMonth).to,
        monthCount: monthSequence(historicalFromMonth, historicalToMonth).length,
        activeMonthCount: activeHistory.length,
      },
      horizon,
      status,
      statusMessage,
      actualBalanceMinor,
      historical,
      baseline: projected,
      assumptions: [
        `Uses the average of months with recorded activity in the last ${FORECAST_HISTORICAL_MONTHS} completed months.`,
        "Empty months remain visible in the history and are not treated as missing data.",
        "Current actual balance is cumulative recorded income minus expenses through the as-of date.",
        "Projected values assume recent recorded patterns continue and are not guaranteed outcomes.",
      ],
    };
  }

  async simulate(uid: string, input: ForecastSimulationInput): Promise<ForecastSimulationData> {
    const baseline = await this.forecast(uid, input.horizon);
    const scenario = scenarioMetrics(
      baseline.baseline.metrics,
      baseline.actualBalanceMinor,
      input.incomeAdjustmentPercent,
      input.expenseAdjustmentPercent,
    );
    const scenarioBundle = projectedBundle(
      scenario,
      baseline.actualBalanceMinor,
      baseline.baseline.projected[0]?.month ?? shiftMonth(baseline.asOfDate.slice(0, 7), 1),
      input.horizon,
      input.oneTimeExpenseMinor,
    );
    const baselineMonthlySavings = baseline.baseline.metrics?.monthlySavingsMinor ?? null;
    const scenarioMonthlySavings = scenarioBundle.metrics?.monthlySavingsMinor ?? null;
    const baselineEndingBalance = baseline.baseline.metrics?.endingBalanceMinor ?? null;
    const scenarioEndingBalance = scenarioBundle.metrics?.endingBalanceMinor ?? null;

    return {
      status: baseline.status,
      statusMessage: baseline.statusMessage,
      horizon: input.horizon,
      actualBalanceMinor: baseline.actualBalanceMinor,
      baseline: baseline.baseline,
      scenario: scenarioBundle,
      difference: {
        monthlySavingsMinor: baselineMonthlySavings !== null && scenarioMonthlySavings !== null
          ? scenarioMonthlySavings - baselineMonthlySavings
          : null,
        endingBalanceMinor: baselineEndingBalance !== null && scenarioEndingBalance !== null
          ? scenarioEndingBalance - baselineEndingBalance
          : null,
      },
      savingsTargetMinor: input.savingsTargetMinor ?? null,
      savingsTargetMet: input.savingsTargetMinor === undefined || scenarioMonthlySavings === null
        ? null
        : scenarioMonthlySavings >= input.savingsTargetMinor,
      assumptions: [
        ...baseline.assumptions,
        "Simulation inputs are hypothetical and are not saved to financial records.",
        `Income changes are applied as a ${input.incomeAdjustmentPercent}% adjustment to projected monthly income.`,
        `Expense changes are applied as a ${input.expenseAdjustmentPercent}% adjustment to projected monthly expenses.`,
        input.oneTimeExpenseMinor > 0
          ? "The one-time expense is applied to the first projected month only."
          : "No one-time expense is applied.",
      ],
    };
  }
}