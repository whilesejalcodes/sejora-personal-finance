import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { TransactionCreateInput, TransactionListQuery, TransactionUpdateInput } from "../../shared/schemas/index.js";
import type { AiInsightModelResponse } from "../../shared/schemas/index.js";
import type { TransactionListData, TransactionRecord } from "../../shared/types/index.js";
import { createApp } from "../../server/src/app.js";
import type { AiInsightContext, AiInsightGenerator } from "../../server/src/ai-insights/ai-insights-service.js";
import type { TransactionRepository } from "../../server/src/transactions/transaction-repository.js";

class MemoryTransactionRepository implements TransactionRepository {
  private readonly records = new Map<string, TransactionRecord[]>();
  private sequence = 0;

  seed(uid: string, date: string, type: "income" | "expense", amountMinor: number, category: string): void {
    const record: TransactionRecord = {
      id: `transaction-${++this.sequence}`,
      amountMinor,
      currency: "INR",
      type,
      merchant: "Private merchant",
      category,
      occurredAt: `${date}T00:00:00.000Z`,
      source: "manual",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    this.records.set(uid, [...(this.records.get(uid) ?? []), record]);
  }

  snapshot(uid: string): TransactionRecord[] { return structuredClone(this.records.get(uid) ?? []); }
  async create(_uid: string, _input: TransactionCreateInput): Promise<TransactionRecord> { throw new Error("Not used."); }
  async list(uid: string, query: TransactionListQuery): Promise<TransactionListData> { return this.listForAnalytics(uid, { from: query.from ?? "1900-01-01", to: query.to ?? "2999-12-31", pageSize: query.pageSize }); }
  async listForAnalytics(uid: string, query: { from: string; to: string; pageSize: number }): Promise<TransactionListData> {
    return { items: (this.records.get(uid) ?? []).filter((record) => record.occurredAt.slice(0, 10) >= query.from && record.occurredAt.slice(0, 10) <= query.to), hasNextPage: false, nextCursor: null };
  }
  async get(_uid: string, _id: string): Promise<TransactionRecord | null> { return null; }
  async update(_uid: string, _id: string, _input: TransactionUpdateInput): Promise<TransactionRecord | null> { return null; }
  async delete(_uid: string, _id: string): Promise<boolean> { return false; }
}

class StubGenerator implements AiInsightGenerator {
  contexts: AiInsightContext[] = [];
  constructor(private readonly output: AiInsightModelResponse) {}
  async generate(context: AiInsightContext): Promise<AiInsightModelResponse> {
    this.contexts.push(context);
    return this.output;
  }
}

const users = {
  "token-a": { uid: "user-a", email: "a@example.com", emailVerified: true },
  "token-b": { uid: "user-b", email: "b@example.com", emailVerified: true },
} as const;

let server: Server | undefined;
let transactions: MemoryTransactionRepository;
let generator: StubGenerator;

async function startTestServer(output: AiInsightModelResponse = {
  insights: [{
    title: "Recorded spending is concentrated",
    summary: "One category accounts for the clearest spending pattern in this period.",
    type: "spending",
    severity: "medium",
    supportingFactIds: ["spending_largest-category", "current_expenses"],
  }],
}) {
  transactions = new MemoryTransactionRepository();
  generator = new StubGenerator(output);
  const app = createApp({
    transactionRepository: transactions,
    aiInsightGenerator: generator,
    verifyToken: async (token) => {
      const user = users[token as keyof typeof users];
      if (!user) throw new Error("invalid token");
      return user;
    },
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
}

async function request(token: keyof typeof users | null, path: string) {
  return fetch(`http://127.0.0.1:${(server!.address() as AddressInfo).port}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

function seedHistory(uid = "user-a") {
  for (const month of ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]) {
    transactions.seed(uid, `${month}-01`, "income", 100_000, "Salary");
    transactions.seed(uid, `${month}-05`, "expense", 70_000, "Food");
  }
}

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

describe("AI insights API", () => {
  it("requires authentication and validates month", async () => {
    await startTestServer();
    expect((await request(null, "/api/insights/ai")).status).toBe(401);
    expect((await request("token-a", "/api/insights/ai?month=not-a-month")).status).toBe(400);
  });

  it("returns grounded insights for the verified UID and does not write records", async () => {
    await startTestServer();
    seedHistory();
    transactions.seed("user-b", "2026-09-01", "expense", 999_999, "Private");
    const before = transactions.snapshot("user-a");
    const response = await request("token-a", "/api/insights/ai?month=2026-09");
    const body = (await response.json()).data;
    expect(response.status).toBe(200);
    expect(body.status).toBe("ready");
    expect(body.insights[0].supportingFacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "current_expenses", valueMinor: 70_000 }),
    ]));
    expect(generator.contexts[0].facts.some((fact) => fact.valueMinor === 999_999)).toBe(false);
    expect(transactions.snapshot("user-a")).toEqual(before);
  });

  it("short-circuits insufficient data without calling Gemini", async () => {
    await startTestServer();
    transactions.seed("user-a", "2026-09-01", "expense", 70_000, "Food");
    const response = await request("token-a", "/api/insights/ai?month=2026-09");
    const body = (await response.json()).data;
    expect(response.status).toBe(200);
    expect(body.status).toBe("insufficient_data");
    expect(body.insights).toEqual([]);
    expect(generator.contexts).toHaveLength(0);
  });

  it("returns safe errors for provider and validation failures", async () => {
    await startTestServer({ insights: [{
      title: "Recorded spending is concentrated",
      summary: "This includes 30% and must be rejected.",
      type: "spending",
      severity: "medium",
      supportingFactIds: ["current_expenses"],
    }] });
    seedHistory();
    const response = await request("token-a", "/api/insights/ai?month=2026-09");
    expect(response.status).toBe(502);
    expect((await response.json()).error.message).not.toContain("Gemini");
  });
});