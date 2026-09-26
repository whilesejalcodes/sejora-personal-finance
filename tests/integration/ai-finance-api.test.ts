import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type {
  BudgetCreateInput,
  BudgetListQuery,
  BudgetUpdateInput,
  GoalCreateInput,
  GoalListQuery,
  GoalUpdateInput,
  TransactionCreateInput,
  TransactionListQuery,
  TransactionUpdateInput,
} from "../../shared/schemas/index.js";
import type { FinanceQuestionIntentInput } from "../../shared/schemas/index.js";
import type {
  BudgetRecord,
  GoalRecord,
  TransactionListData,
  TransactionRecord,
} from "../../shared/types/index.js";
import { createApp } from "../../server/src/app.js";
import type { FinanceIntentContext, FinanceIntentExtractor } from "../../server/src/ai-finance/ai-finance-service.js";
import type { BudgetRepository } from "../../server/src/budgets/budget-repository.js";
import type { GoalRepository } from "../../server/src/goals/goal-repository.js";
import type { TransactionRepository } from "../../server/src/transactions/transaction-repository.js";

class MemoryTransactions implements TransactionRepository {
  private readonly byUser = new Map<string, TransactionRecord[]>();
  private sequence = 0;
  seed(uid: string, date: string, amountMinor: number, category: string): void {
    const record: TransactionRecord = {
      id: `transaction-${++this.sequence}`,
      amountMinor,
      currency: "INR",
      type: "expense",
      merchant: "Merchant",
      category,
      occurredAt: `${date}T00:00:00.000Z`,
      source: "manual",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    this.byUser.set(uid, [...(this.byUser.get(uid) ?? []), record]);
  }
  snapshot(uid: string): TransactionRecord[] { return structuredClone(this.byUser.get(uid) ?? []); }
  async create(_uid: string, _input: TransactionCreateInput): Promise<TransactionRecord> { throw new Error("Not used."); }
  async list(uid: string, query: TransactionListQuery): Promise<TransactionListData> {
    return this.listForAnalytics(uid, { from: query.from ?? "1900-01-01", to: query.to ?? "2999-12-31", pageSize: query.pageSize });
  }
  async listForAnalytics(uid: string, query: { from: string; to: string; pageSize: number }): Promise<TransactionListData> {
    return { items: (this.byUser.get(uid) ?? []).filter((item) => item.occurredAt.slice(0, 10) >= query.from && item.occurredAt.slice(0, 10) <= query.to), hasNextPage: false, nextCursor: null };
  }
  async get(_uid: string, _id: string): Promise<TransactionRecord | null> { return null; }
  async update(_uid: string, _id: string, _input: TransactionUpdateInput): Promise<TransactionRecord | null> { return null; }
  async delete(_uid: string, _id: string): Promise<boolean> { return false; }
}

class MemoryBudgets implements BudgetRepository {
  async create(_uid: string, _input: BudgetCreateInput): Promise<BudgetRecord> { throw new Error("Not used."); }
  async list(_uid: string, _query: BudgetListQuery): Promise<BudgetRecord[]> { return []; }
  async get(_uid: string, _id: string): Promise<BudgetRecord | null> { return null; }
  async update(_uid: string, _id: string, _input: BudgetUpdateInput): Promise<BudgetRecord | null> { return null; }
  async delete(_uid: string, _id: string): Promise<boolean> { return false; }
}

class MemoryGoals implements GoalRepository {
  async create(_uid: string, _input: GoalCreateInput): Promise<GoalRecord> { throw new Error("Not used."); }
  async list(_uid: string, _query: GoalListQuery): Promise<GoalRecord[]> { return []; }
  async get(_uid: string, _id: string): Promise<GoalRecord | null> { return null; }
  async update(_uid: string, _id: string, _input: GoalUpdateInput): Promise<GoalRecord | null> { return null; }
  async delete(_uid: string, _id: string): Promise<boolean> { return false; }
}

class StubExtractor implements FinanceIntentExtractor {
  calls = 0;
  async extract(_question: string, _context: FinanceIntentContext): Promise<FinanceQuestionIntentInput> {
    this.calls += 1;
    return { intent: "expense_total", period: { type: "current_month" } };
  }
}

const users = {
  "token-a": { uid: "user-a", email: "a@example.com", emailVerified: true },
  "token-b": { uid: "user-b", email: "b@example.com", emailVerified: true },
} as const;

let server: Server | undefined;
let transactions: MemoryTransactions;
let extractor: StubExtractor;

async function startServer() {
  transactions = new MemoryTransactions();
  extractor = new StubExtractor();
  const app = createApp({
    transactionRepository: transactions,
    budgetRepository: new MemoryBudgets(),
    goalRepository: new MemoryGoals(),
    aiFinanceExtractor: extractor,
    aiFinanceClock: () => "2026-09-15",
    forecastClock: () => "2026-09-15",
    verifyToken: async (token) => {
      const user = users[token as keyof typeof users];
      if (!user) throw new Error("invalid token");
      return user;
    },
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
}

async function request(token: keyof typeof users | null, question: string, extra: Record<string, unknown> = {}) {
  return fetch(`http://127.0.0.1:${(server!.address() as AddressInfo).port}/api/ai-finance/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ question, ...extra }),
  });
}

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

describe("AI Finance API", () => {
  it("requires authentication and validates the strict request body", async () => {
    await startServer();
    expect((await request(null, "How much did I spend?")).status).toBe(401);
    expect((await request("token-a", "", { uid: "user-b" })).status).toBe(400);
  });

  it("answers against the authenticated UID and leaves the repository unchanged", async () => {
    await startServer();
    transactions.seed("user-a", "2026-09-05", 20_000, "Food");
    transactions.seed("user-b", "2026-09-05", 999_999, "Private");
    const before = transactions.snapshot("user-a");
    const response = await request("token-a", "How much did I spend this month?");
    const body = (await response.json()).data;
    expect(response.status).toBe(200);
    expect(body.result.amountMinor).toBe(20_000);
    expect(body.supportingFacts.some((fact: { amountMinor?: number }) => fact.amountMinor === 999_999)).toBe(false);
    expect(transactions.snapshot("user-a")).toEqual(before);
    expect(extractor.calls).toBe(0);
  });

  it("uses an injected intent provider for non-local phrasing and keeps unsupported questions safe", async () => {
    await startServer();
    transactions.seed("user-a", "2026-09-05", 20_000, "Food");
    const providerResponse = await request("token-a", "Could you summarize my outgoings?");
    expect(providerResponse.status).toBe(200);
    expect((await providerResponse.json()).data.usedAi).toBe(true);
    expect(extractor.calls).toBe(1);
  });
});