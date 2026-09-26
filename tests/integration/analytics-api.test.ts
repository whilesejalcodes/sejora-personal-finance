import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { BudgetCreateInput, BudgetListQuery, BudgetUpdateInput, TransactionCreateInput, TransactionListQuery, TransactionUpdateInput } from "../../shared/schemas/index.js";
import type { BudgetRecord, TransactionListData, TransactionRecord } from "../../shared/types/index.js";
import { createApp } from "../../server/src/app.js";
import type { BudgetRepository } from "../../server/src/budgets/budget-repository.js";
import type { TransactionRepository } from "../../server/src/transactions/transaction-repository.js";

class MemoryTransactionRepository implements TransactionRepository {
  private readonly users = new Map<string, Map<string, TransactionRecord>>();
  private sequence = 0;

  private collection(uid: string) {
    const existing = this.users.get(uid);
    if (existing) return existing;
    const created = new Map<string, TransactionRecord>();
    this.users.set(uid, created);
    return created;
  }

  async create(uid: string, input: TransactionCreateInput): Promise<TransactionRecord> {
    const now = new Date().toISOString();
    const record: TransactionRecord = {
      id: `transaction-${++this.sequence}`,
      amountMinor: input.amountMinor,
      currency: "INR",
      type: input.type,
      merchant: input.merchant,
      category: input.category,
      occurredAt: `${input.occurredAt}T00:00:00.000Z`,
      ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      source: "manual",
      createdAt: now,
      updatedAt: now,
    };
    this.collection(uid).set(record.id, record);
    return record;
  }

  async list(uid: string, query: TransactionListQuery): Promise<TransactionListData> {
    const offset = query.pageToken ? Number(Buffer.from(query.pageToken, "base64url").toString("utf8")) : 0;
    const items = [...this.collection(uid).values()]
      .filter((item) => !query.type || item.type === query.type)
      .filter((item) => !query.category || item.category === query.category)
      .filter((item) => !query.from || item.occurredAt.slice(0, 10) >= query.from)
      .filter((item) => !query.to || item.occurredAt.slice(0, 10) <= query.to)
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id));
    const page = items.slice(offset, offset + query.pageSize);
    const hasNextPage = offset + query.pageSize < items.length;
    return {
      items: page,
      hasNextPage,
      nextCursor: hasNextPage ? Buffer.from(String(offset + query.pageSize), "utf8").toString("base64url") : null,
    };
  }

  async get(uid: string, id: string) {
    return this.collection(uid).get(id) ?? null;
  }

  async update(uid: string, id: string, input: TransactionUpdateInput) {
    const existing = this.collection(uid).get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...input,
      ...(input.occurredAt ? { occurredAt: `${input.occurredAt}T00:00:00.000Z` } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.collection(uid).set(id, updated);
    return updated;
  }

  async delete(uid: string, id: string) {
    return this.collection(uid).delete(id);
  }
}

class MemoryBudgetRepository implements BudgetRepository {
  private readonly users = new Map<string, Map<string, BudgetRecord>>();
  private sequence = 0;

  private collection(uid: string) {
    const existing = this.users.get(uid);
    if (existing) return existing;
    const created = new Map<string, BudgetRecord>();
    this.users.set(uid, created);
    return created;
  }

  async create(uid: string, input: BudgetCreateInput): Promise<BudgetRecord> {
    const now = new Date().toISOString();
    const record: BudgetRecord = {
      id: `budget-${++this.sequence}`,
      name: input.name,
      ...(input.category ? { category: input.category } : {}),
      amountMinor: input.amountMinor,
      currency: "INR",
      period: input.period,
      startDate: `${input.startDate}T00:00:00.000Z`,
      ...(input.endDate ? { endDate: `${input.endDate}T23:59:59.999Z` } : {}),
      createdAt: now,
      updatedAt: now,
    };
    this.collection(uid).set(record.id, record);
    return record;
  }

  async list(uid: string, query: BudgetListQuery) {
    const budgets = [...this.collection(uid).values()].sort((left, right) => right.startDate.localeCompare(left.startDate));
    if (!query.month) return budgets;
    return budgets.filter((budget) => budget.startDate.slice(0, 7) === query.month);
  }

  async get(uid: string, id: string) {
    return this.collection(uid).get(id) ?? null;
  }

  async update(uid: string, id: string, input: BudgetUpdateInput) {
    const existing = this.collection(uid).get(id);
    if (!existing) return null;
    const updated = { ...existing, ...input, updatedAt: new Date().toISOString() };
    this.collection(uid).set(id, updated);
    return updated;
  }

  async delete(uid: string, id: string) {
    return this.collection(uid).delete(id);
  }
}

const users = {
  "token-a": { uid: "user-a", email: "a@example.com", emailVerified: true },
  "token-b": { uid: "user-b", email: "b@example.com", emailVerified: true },
} as const;

let server: Server | undefined;
let baseUrl = "";
let transactions: MemoryTransactionRepository;
let budgets: MemoryBudgetRepository;

async function request(token: keyof typeof users | null, path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
  });
}

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

async function startTestServer() {
  transactions = new MemoryTransactionRepository();
  budgets = new MemoryBudgetRepository();
  const app = createApp({
    transactionRepository: transactions,
    budgetRepository: budgets,
    verifyToken: async (token) => {
      const user = users[token as keyof typeof users];
      if (!user) throw new Error("invalid token");
      return user;
    },
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function createTransaction(token: keyof typeof users, input: Omit<TransactionCreateInput, "amountMinor"> & { amountMinor: number }) {
  const response = await request(token, "/api/transactions", { method: "POST", body: JSON.stringify(input) });
  expect(response.status).toBe(201);
  return (await response.json()).data as TransactionRecord;
}

describe("dashboard and analytics API", () => {
  it("requires authentication and validates the bounded analytics range", async () => {
    await startTestServer();
    expect((await request(null, "/api/dashboard?month=2026-09")).status).toBe(401);
    expect((await request("token-a", "/api/analytics?from=2025-01&to=2026-02")).status).toBe(400);
    expect((await request("token-a", "/api/analytics?from=2026-10&to=2026-09")).status).toBe(400);
  });

  it("returns dashboard totals, category spending, recent transactions, and budget actuals", async () => {
    await startTestServer();
    await createTransaction("token-a", { amountMinor: 100_000, type: "income", merchant: "Salary", category: "Salary", occurredAt: "2026-09-01" });
    await createTransaction("token-a", { amountMinor: 12_500, type: "expense", merchant: "Market", category: "Food", occurredAt: "2026-09-02" });
    await createTransaction("token-a", { amountMinor: 7_500, type: "expense", merchant: "Metro", category: "Travel", occurredAt: "2026-09-03" });
    const budget = await budgets.create("user-a", { name: "Food", category: "Food", amountMinor: 20_000, period: "monthly", startDate: "2026-09-01", endDate: "2026-09-30" });

    const response = await request("token-a", "/api/dashboard?month=2026-09");
    const body = (await response.json()).data;
    expect(response.status).toBe(200);
    expect(body.totals).toEqual({ incomeMinor: 100_000, expenseMinor: 20_000, balanceMinor: 80_000, savingsMinor: 80_000, savingsRate: 80 });
    expect(body.spendingByCategory).toEqual([
      { category: "Food", amountMinor: 12_500, percentage: 62.5 },
      { category: "Travel", amountMinor: 7_500, percentage: 37.5 },
    ]);
    expect(body.recentTransactions).toHaveLength(3);
    expect(body.budgets[0].id).toBe(budget.id);
    expect(body.budgets[0].spentMinor).toBe(12_500);
  });

  it("returns empty months honestly and aggregates multiple months without cross-user data", async () => {
    await startTestServer();
    await createTransaction("token-a", { amountMinor: 50_000, type: "income", merchant: "Salary", category: "Salary", occurredAt: "2026-08-01" });
    await createTransaction("token-a", { amountMinor: 10_000, type: "expense", merchant: "Rent", category: "Home", occurredAt: "2026-09-01" });
    await createTransaction("token-b", { amountMinor: 999_999, type: "income", merchant: "Private", category: "Other", occurredAt: "2026-09-01" });

    const response = await request("token-a", "/api/analytics?from=2026-08&to=2026-09");
    const body = (await response.json()).data;
    expect(body.monthly).toEqual([
      { month: "2026-08", incomeMinor: 50_000, expenseMinor: 0, netFlowMinor: 50_000, transactionCount: 1 },
      { month: "2026-09", incomeMinor: 0, expenseMinor: 10_000, netFlowMinor: -10_000, transactionCount: 1 },
    ]);
    expect(body.metadata.transactionCount).toBe(2);
    expect(body.totals.savingsRate).toBe(80);

    const empty = await request("token-a", "/api/dashboard?month=2026-07");
    const emptyBody = (await empty.json()).data;
    expect(emptyBody.totals).toEqual({ incomeMinor: 0, expenseMinor: 0, balanceMinor: 0, savingsMinor: 0, savingsRate: null });
    expect(emptyBody.recentTransactions).toHaveLength(0);
  });

  it("reflects deletion in the next derived dashboard read", async () => {
    await startTestServer();
    const created = await createTransaction("token-a", { amountMinor: 4_000, type: "expense", merchant: "Cafe", category: "Food", occurredAt: "2026-09-01" });
    expect((await request("token-a", "/api/dashboard?month=2026-09")).status).toBe(200);
    expect((await request("token-a", `/api/transactions/${created.id}`, { method: "DELETE" })).status).toBe(204);
    const body = (await (await request("token-a", "/api/dashboard?month=2026-09")).json()).data;
    expect(body.totals.expenseMinor).toBe(0);
    expect(body.metadata.transactionCount).toBe(0);
  });

  it("rejects a date range whose transaction volume exceeds the analytics safety limit", async () => {
    await startTestServer();
    for (let index = 0; index < 10_001; index += 1) {
      await transactions.create("user-a", {
        amountMinor: 1,
        type: "expense",
        merchant: `Entry ${index}`,
        category: "Other",
        occurredAt: "2026-09-01",
      });
    }
    const response = await request("token-a", "/api/analytics?from=2026-09&to=2026-09");
    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toContain("too many transactions");
  });
});