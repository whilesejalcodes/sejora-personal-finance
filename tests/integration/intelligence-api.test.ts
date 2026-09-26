import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { BudgetCreateInput, BudgetListQuery, BudgetUpdateInput, TransactionCreateInput, TransactionListQuery, TransactionUpdateInput } from "../../shared/schemas/index.js";
import type { BudgetRecord, InsightsData, RecurringPaymentsData, TransactionListData, TransactionRecord } from "../../shared/types/index.js";
import { createApp } from "../../server/src/app.js";
import type { BudgetRepository } from "../../server/src/budgets/budget-repository.js";
import type { TransactionRepository } from "../../server/src/transactions/transaction-repository.js";

class MemoryTransactionRepository implements TransactionRepository {
  private readonly users = new Map<string, Map<string, TransactionRecord>>();
  private sequence = 0;

  private collection(uid: string): Map<string, TransactionRecord> {
    const existing = this.users.get(uid);
    if (existing) return existing;
    const created = new Map<string, TransactionRecord>();
    this.users.set(uid, created);
    return created;
  }

  seed(uid: string, input: TransactionCreateInput): TransactionRecord {
    const date = `${input.occurredAt}T00:00:00.000Z`;
    const record: TransactionRecord = {
      id: `transaction-${++this.sequence}`,
      amountMinor: input.amountMinor,
      currency: "INR",
      type: input.type,
      merchant: input.merchant,
      ...(input.category ? { category: input.category } : {}),
      occurredAt: date,
      ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      source: "manual",
      createdAt: date,
      updatedAt: date,
    };
    this.collection(uid).set(record.id, record);
    return record;
  }

  async create(uid: string, input: TransactionCreateInput): Promise<TransactionRecord> {
    return this.seed(uid, input);
  }

  async list(uid: string, query: TransactionListQuery): Promise<TransactionListData> {
    return this.listForAnalytics(uid, { from: query.from ?? "1900-01-01", to: query.to ?? "2999-12-31", pageSize: query.pageSize, pageToken: query.pageToken });
  }

  async listForAnalytics(uid: string, query: { from: string; to: string; pageSize: number; pageToken?: string }): Promise<TransactionListData> {
    const offset = query.pageToken ? Number(Buffer.from(query.pageToken, "base64url").toString("utf8")) : 0;
    const records = [...this.collection(uid).values()]
      .filter((record) => record.occurredAt.slice(0, 10) >= query.from && record.occurredAt.slice(0, 10) <= query.to)
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id));
    const items = records.slice(offset, offset + query.pageSize);
    const hasNextPage = offset + query.pageSize < records.length;
    return {
      items,
      hasNextPage,
      nextCursor: hasNextPage ? Buffer.from(String(offset + query.pageSize), "utf8").toString("base64url") : null,
    };
  }

  async get(uid: string, id: string): Promise<TransactionRecord | null> {
    return this.collection(uid).get(id) ?? null;
  }

  async update(uid: string, id: string, input: TransactionUpdateInput): Promise<TransactionRecord | null> {
    const current = this.collection(uid).get(id);
    if (!current) return null;
    const updated = { ...current, ...input, updatedAt: new Date().toISOString() };
    this.collection(uid).set(id, updated);
    return updated;
  }

  async delete(uid: string, id: string): Promise<boolean> {
    return this.collection(uid).delete(id);
  }
}

class EmptyBudgetRepository implements BudgetRepository {
  async create(_uid: string, _input: BudgetCreateInput): Promise<BudgetRecord> { throw new Error("Not used."); }
  async list(_uid: string, _query: BudgetListQuery): Promise<BudgetRecord[]> { return []; }
  async get(_uid: string, _id: string): Promise<BudgetRecord | null> { return null; }
  async update(_uid: string, _id: string, _input: BudgetUpdateInput): Promise<BudgetRecord | null> { return null; }
  async delete(_uid: string, _id: string): Promise<boolean> { return false; }
}

const verifiedUsers = {
  "token-a": { uid: "user-a", email: "a@example.com", emailVerified: true },
  "token-b": { uid: "user-b", email: "b@example.com", emailVerified: true },
} as const;

let server: Server | undefined;
let transactions: MemoryTransactionRepository;

async function startTestServer(): Promise<void> {
  transactions = new MemoryTransactionRepository();
  const app = createApp({
    verifyToken: async (token) => {
      const user = verifiedUsers[token as keyof typeof verifiedUsers];
      if (!user) throw new Error("Invalid token.");
      return user;
    },
    transactionRepository: transactions,
    budgetRepository: new EmptyBudgetRepository(),
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
}

async function request(path: string, token?: string): Promise<Response> {
  const address = server!.address() as AddressInfo;
  return fetch(`http://127.0.0.1:${address.port}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

afterEach(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  server = undefined;
});

describe("intelligence API", () => {
  it("requires authentication for both Phase 6 endpoints", async () => {
    await startTestServer();
    expect((await request("/api/insights")).status).toBe(401);
    expect((await request("/api/recurring-payments")).status).toBe(401);
  });

  it("returns empty, typed intelligence data for an authenticated user", async () => {
    await startTestServer();
    const insightsResponse = await request("/api/insights?month=2026-09", "token-a");
    const recurringResponse = await request("/api/recurring-payments?from=2026-01&to=2026-09", "token-a");
    expect(insightsResponse.status).toBe(200);
    expect(recurringResponse.status).toBe(200);
    const insights = (await insightsResponse.json()).data as InsightsData;
    const recurring = (await recurringResponse.json()).data as RecurringPaymentsData;
    expect(insights.insights).toEqual([]);
    expect(insights.anomalies).toEqual([]);
    expect(recurring.items).toEqual([]);
    expect(recurring.metadata).toEqual({ transactionCount: 0, expenseTransactionCount: 0 });
  });

  it("isolates intelligence to the verified UID and returns populated patterns", async () => {
    await startTestServer();
    for (const [index, date] of ["2026-06-01", "2026-07-01", "2026-08-01"].entries()) {
      transactions.seed("user-a", {
        amountMinor: 1_499,
        type: "expense",
        merchant: "Netflix",
        category: "Entertainment",
        occurredAt: date,
      });
      transactions.seed("user-b", {
        amountMinor: 99_999,
        type: "expense",
        merchant: `Private ${index}`,
        category: "Other",
        occurredAt: date,
      });
    }
    const insightsResponse = await request("/api/insights?month=2026-08", "token-a");
    const recurringResponse = await request("/api/recurring-payments?from=2026-01&to=2026-09", "token-a");
    const insights = (await insightsResponse.json()).data as InsightsData;
    const recurring = (await recurringResponse.json()).data as RecurringPaymentsData;
    expect(insights.metadata.focusTransactionCount).toBe(1);
    expect(insights.insights[0]).toMatchObject({ kind: "largest_category", category: "Entertainment" });
    expect(recurring.items).toHaveLength(1);
    expect(recurring.items[0].merchant).toBe("Netflix");
  });

  it("validates month and range query parameters", async () => {
    await startTestServer();
    expect((await request("/api/insights?month=not-a-month", "token-a")).status).toBe(400);
    expect((await request("/api/recurring-payments?from=2026-01&to=2027-02", "token-a")).status).toBe(400);
    expect((await request("/api/recurring-payments?from=2026-02&to=2026-01", "token-a")).status).toBe(400);
  });
});