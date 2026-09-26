import { describe, expect, it, vi } from "vitest";
import type { TransactionCreateInput, TransactionListQuery, TransactionUpdateInput } from "../../shared/schemas/index.js";
import type { AiInsightModelResponse } from "../../shared/schemas/index.js";
import type { TransactionListData, TransactionRecord } from "../../shared/types/index.js";
import {
  AiInsightsExtractionError,
  AiInsightsProviderError,
  AiInsightsService,
  buildAiInsightContext,
  GeminiAiInsightGenerator,
  withTimeout,
  type AiInsightContext,
  type AiInsightGenerator,
} from "../../server/src/ai-insights/ai-insights-service.js";
import type { TransactionRepository } from "../../server/src/transactions/transaction-repository.js";

class MemoryTransactionRepository implements TransactionRepository {
  constructor(private readonly records: TransactionRecord[]) {}

  async create(_uid: string, _input: TransactionCreateInput): Promise<TransactionRecord> { throw new Error("Not used."); }
  async list(_uid: string, _query: TransactionListQuery): Promise<TransactionListData> { return { items: this.records, hasNextPage: false, nextCursor: null }; }
  async listForAnalytics(_uid: string, query: { from: string; to: string; pageSize: number }): Promise<TransactionListData> {
    return {
      items: this.records.filter((record) => record.occurredAt.slice(0, 10) >= query.from && record.occurredAt.slice(0, 10) <= query.to),
      hasNextPage: false,
      nextCursor: null,
    };
  }
  async get(_uid: string, _transactionId: string): Promise<TransactionRecord | null> { return null; }
  async update(_uid: string, _transactionId: string, _input: TransactionUpdateInput): Promise<TransactionRecord | null> { return null; }
  async delete(_uid: string, _transactionId: string): Promise<boolean> { return false; }
}

function transaction(
  id: string,
  date: string,
  type: "income" | "expense",
  amountMinor: number,
  category: string,
  merchant = "Private merchant",
): TransactionRecord {
  return {
    id,
    amountMinor,
    currency: "INR",
    type,
    merchant,
    category,
    occurredAt: `${date}T00:00:00.000Z`,
    source: "manual",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function populatedRecords(): TransactionRecord[] {
  return ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"].flatMap((month, index) => [
    transaction(`income-${index}`, `${month}-01`, "income", 100_000, "Salary"),
    transaction(`expense-${index}`, `${month}-05`, "expense", 70_000, "Food", "Private merchant"),
  ]);
}

const validModelResponse: AiInsightModelResponse = {
  insights: [{
    title: "Food is the clearest spending pattern",
    summary: "Recorded spending is concentrated in one category and is worth keeping visible.",
    type: "spending",
    severity: "low",
    supportingFactIds: ["spending_largest-category", "current_expenses"],
  }],
};

class StubGenerator implements AiInsightGenerator {
  calls = 0;
  constructor(private readonly output: unknown) {}
  async generate(_context: AiInsightContext): Promise<AiInsightModelResponse> {
    this.calls += 1;
    return this.output as AiInsightModelResponse;
  }
}

describe("AI insight service", () => {
  it("builds Gemini context from deterministic aggregates without raw merchant data", async () => {
    const context = await buildAiInsightContext(new MemoryTransactionRepository(populatedRecords()), "user-a", "2026-09");
    expect(context.activeMonths).toBe(6);
    expect(context.facts).toContainEqual({ id: "current_income", label: "2026-09 income", valueMinor: 100_000 });
    expect(context.facts).toContainEqual({ id: "current_expenses", label: "2026-09 expenses", valueMinor: 70_000 });
    expect(context.facts.some((fact) => fact.textValue === "Food")).toBe(true);
    expect(JSON.stringify(context)).not.toContain("Private merchant");
  });

  it("maps validated model facts back to server-owned supporting values", async () => {
    const service = new AiInsightsService(new MemoryTransactionRepository(populatedRecords()), new StubGenerator(validModelResponse));
    const result = await service.generate("user-a", "2026-09");
    expect(result.status).toBe("ready");
    expect(result.insights[0]).toMatchObject({ id: "ai-insight-1", type: "spending", severity: "low" });
    expect(result.insights[0].supportingFacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "current_expenses", valueMinor: 70_000 }),
    ]));
  });

  it("rejects malformed, unknown-fact, and numerical-claim responses", async () => {
    const repository = new MemoryTransactionRepository(populatedRecords());
    for (const output of [
      { insights: [{ title: "Bad", summary: "Bad", type: "invalid", severity: "low", supportingFactIds: ["current_expenses"] }] },
      { insights: [{ title: "Bad", summary: "Bad", type: "spending", severity: "low", supportingFactIds: ["does-not-exist"] }] },
      { insights: [{ title: "Bad", summary: "Savings rose 30%", type: "savings", severity: "low", supportingFactIds: ["current_savings"] }] },
    ]) {
      await expect(new AiInsightsService(repository, new StubGenerator(output)).generate("user-a", "2026-09")).rejects.toBeInstanceOf(AiInsightsExtractionError);
    }
  });

  it("does not call Gemini when there are fewer than two active months", async () => {
    const generator = new StubGenerator(validModelResponse);
    const records = populatedRecords().filter((record) => record.occurredAt.startsWith("2026-09"));
    const result = await new AiInsightsService(new MemoryTransactionRepository(records), generator).generate("user-a", "2026-09");
    expect(result.status).toBe("insufficient_data");
    expect(result.insights).toEqual([]);
    expect(generator.calls).toBe(0);
  });

  it("returns a safe configuration error when the Gemini secret is missing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(new GeminiAiInsightGenerator().generate({
      period: { month: "2026-09", from: "2026-09-01", to: "2026-09-30", comparisonFrom: "2026-08-01", comparisonTo: "2026-08-31" },
      activeMonths: 2,
      facts: [],
    })).rejects.toEqual(expect.objectContaining({
      name: "AiInsightsProviderError",
      message: "Insights are not configured.",
    } satisfies Partial<AiInsightsProviderError>));
  });

  it("surfaces bounded provider failures without exposing provider internals", async () => {
    const providerFailure: AiInsightGenerator = {
      async generate(): Promise<AiInsightModelResponse> {
        throw new AiInsightsProviderError("Insights are temporarily unavailable.");
      },
    };
    await expect(new AiInsightsService(new MemoryTransactionRepository(populatedRecords()), providerFailure).generate("user-a", "2026-09"))
      .rejects.toEqual(expect.objectContaining({ message: "Insights are temporarily unavailable." }));
    await expect(withTimeout(new Promise<never>(() => undefined), 2))
      .rejects.toEqual(expect.objectContaining({ name: "AiInsightsProviderError", message: "Insight generation timed out. Please try again." }));
  });
});