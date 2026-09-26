import { describe, expect, it } from "vitest";
import {
  buildSpendingInsights,
  detectRecurringPayments,
  detectSpendingAnomalies,
} from "../../shared/finance/intelligence.js";
import type { TransactionRecord } from "../../shared/types/index.js";

function transaction(
  id: string,
  type: TransactionRecord["type"],
  amountMinor: number,
  date: string,
  merchant = id,
  category?: string,
): TransactionRecord {
  return {
    id,
    amountMinor,
    currency: "INR",
    type,
    merchant,
    ...(category ? { category } : {}),
    occurredAt: `${date}T00:00:00.000Z`,
    source: "manual",
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
  };
}

describe("spending intelligence", () => {
  it("returns no insights for empty history", () => {
    expect(buildSpendingInsights([], [])).toEqual([]);
  });

  it("handles one expense with largest-category and largest-expense observations", () => {
    const result = buildSpendingInsights([
      transaction("market", "expense", 4_500, "2026-09-01", "Market", "Food"),
    ], []);
    expect(result.map((item) => item.kind)).toEqual(["largest_category", "largest_expense"]);
  });

  it("identifies category totals and the largest category", () => {
    const result = buildSpendingInsights([
      transaction("food-one", "expense", 3_000, "2026-09-01", "Market", "Food"),
      transaction("food-two", "expense", 2_000, "2026-09-02", "Cafe", "Food"),
      transaction("travel", "expense", 1_000, "2026-09-03", "Metro", "Travel"),
    ], []);
    expect(result[0]).toMatchObject({ kind: "largest_category", category: "Food", amountMinor: 5_000, percentage: 83.33 });
  });

  it("reports a meaningful month-over-month category change", () => {
    const result = buildSpendingInsights([
      transaction("food-now-one", "expense", 100_000, "2026-09-01", "Market", "Food"),
      transaction("food-now-two", "expense", 100_000, "2026-09-02", "Cafe", "Food"),
    ], [
      transaction("food-before-one", "expense", 50_000, "2026-08-01", "Market", "Food"),
      transaction("food-before-two", "expense", 50_000, "2026-08-02", "Cafe", "Food"),
    ]);
    expect(result.find((item) => item.kind === "category_change")).toMatchObject({
      category: "Food",
      changePercent: 100,
      previousAmountMinor: 100_000,
    });
  });

  it("excludes income from expense intelligence", () => {
    const result = buildSpendingInsights([
      transaction("salary", "income", 100_000, "2026-09-01", "Employer"),
    ], []);
    expect(result).toEqual([]);
  });

  it("does not report a category change without enough history", () => {
    const result = buildSpendingInsights([
      transaction("food-now", "expense", 100_000, "2026-09-01", "Market", "Food"),
    ], [
      transaction("food-before", "expense", 10_000, "2026-08-01", "Market", "Food"),
    ]);
    expect(result.some((item) => item.kind === "category_change")).toBe(false);
  });
});

describe("spending anomalies", () => {
  const baseline = [
    transaction("food-1", "expense", 100_000, "2026-01-01", "Market", "Food"),
    transaction("food-2", "expense", 100_000, "2026-02-01", "Market", "Food"),
    transaction("food-3", "expense", 100_000, "2026-03-01", "Market", "Food"),
    transaction("travel-1", "expense", 200_000, "2026-04-01", "Metro", "Travel"),
    transaction("travel-2", "expense", 200_000, "2026-05-01", "Metro", "Travel"),
  ];

  it("does not flag a normal transaction", () => {
    expect(detectSpendingAnomalies([
      transaction("normal", "expense", 120_000, "2026-09-01", "Market", "Food"),
    ], baseline)).toEqual([]);
  });

  it("flags an unusually large transaction relative to its category", () => {
    expect(detectSpendingAnomalies([
      transaction("large-food", "expense", 300_000, "2026-09-01", "Market", "Food"),
    ], baseline)[0]).toMatchObject({
      transactionId: "large-food",
      signal: "category_amount",
      baselineAverageMinor: 100_000,
      baselineTransactionCount: 3,
    });
  });

  it("does not flag category-relative anomalies without enough category history", () => {
    expect(detectSpendingAnomalies([
      transaction("large-new-category", "expense", 300_000, "2026-09-01", "Gym", "Health"),
    ], baseline)).toEqual([]);
  });

  it("does not turn income into an expense anomaly", () => {
    expect(detectSpendingAnomalies([
      transaction("salary", "income", 1_000_000, "2026-09-01", "Employer"),
    ], baseline)).toEqual([]);
  });

  it("returns no false anomaly with insufficient history", () => {
    expect(detectSpendingAnomalies([
      transaction("large", "expense", 1_000_000, "2026-09-01", "Market", "Food"),
    ], baseline.slice(0, 4))).toEqual([]);
  });
});

describe("recurring payments", () => {
  it("detects a repeated monthly pattern", () => {
    const result = detectRecurringPayments([
      transaction("netflix-1", "expense", 1_499, "2026-06-01", "Netflix", "Entertainment"),
      transaction("netflix-2", "expense", 1_499, "2026-07-01", "Netflix", "Entertainment"),
      transaction("netflix-3", "expense", 1_599, "2026-08-01", "Netflix", "Entertainment"),
    ]);
    expect(result[0]).toMatchObject({
      merchant: "Netflix",
      category: "Entertainment",
      frequency: "monthly",
      occurrenceCount: 3,
      nextExpectedOccurrence: "2026-09-01",
    });
  });

  it("detects a repeated weekly pattern", () => {
    const result = detectRecurringPayments([
      transaction("gym-1", "expense", 2_000, "2026-09-01", "Gym", "Health"),
      transaction("gym-2", "expense", 2_000, "2026-09-08", "gym", "Health"),
      transaction("gym-3", "expense", 2_000, "2026-09-15", " GYM ", "Health"),
    ]);
    expect(result[0]).toMatchObject({ frequency: "weekly", occurrenceCount: 3 });
    expect(result[0].merchant.toLocaleLowerCase("en-IN")).toBe("gym");
  });

  it("handles merchant capitalization while rejecting inconsistent intervals", () => {
    expect(detectRecurringPayments([
      transaction("one", "expense", 1_000, "2026-01-01", "Spotify", "Entertainment"),
      transaction("two", "expense", 1_000, "2026-02-15", "spotify", "Entertainment"),
      transaction("three", "expense", 1_000, "2026-04-20", "SPOTIFY", "Entertainment"),
    ])).toEqual([]);
  });

  it("does not mark a single transaction or an irregular pattern recurring", () => {
    expect(detectRecurringPayments([
      transaction("single", "expense", 1_000, "2026-09-01", "Rent", "Housing"),
    ])).toEqual([]);
  });

  it("drops a recurring pattern when a deleted occurrence leaves insufficient observations", () => {
    expect(detectRecurringPayments([
      transaction("rent-1", "expense", 10_000, "2026-06-01", "Rent", "Housing"),
      transaction("rent-2", "expense", 10_000, "2026-07-01", "Rent", "Housing"),
    ])).toEqual([]);
  });
});