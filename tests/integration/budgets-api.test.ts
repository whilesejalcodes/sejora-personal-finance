import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { BudgetCreateInput, BudgetListQuery, BudgetUpdateInput, TransactionCreateInput, TransactionListQuery, TransactionUpdateInput } from "../../shared/schemas/index.js";
import type { BudgetListData, BudgetRecord, TransactionListData, TransactionRecord } from "../../shared/types/index.js";
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
    const items = [...this.collection(uid).values()]
      .filter((item) => !query.type || item.type === query.type)
      .filter((item) => !query.category || item.category === query.category)
      .filter((item) => !query.from || item.occurredAt.slice(0, 10) >= query.from)
      .filter((item) => !query.to || item.occurredAt.slice(0, 10) <= query.to)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    return { items: items.slice(0, query.pageSize), nextCursor: null, hasNextPage: false };
  }

  async get(uid: string, transactionId: string) {
    return this.collection(uid).get(transactionId) ?? null;
  }

  async update(uid: string, transactionId: string, input: TransactionUpdateInput) {
    const current = this.collection(uid).get(transactionId);
    if (!current) return null;
    const updated = {
      ...current,
      ...input,
      ...(input.occurredAt ? { occurredAt: `${input.occurredAt}T00:00:00.000Z` } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.collection(uid).set(transactionId, updated);
    return updated;
  }

  async delete(uid: string, transactionId: string) {
    return this.collection(uid).delete(transactionId);
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
    const values = [...this.collection(uid).values()].sort((a, b) => b.startDate.localeCompare(a.startDate));
    return query.month ? values.filter((budget) => budget.startDate.startsWith(query.month!)) : values;
  }

  async get(uid: string, budgetId: string) {
    return this.collection(uid).get(budgetId) ?? null;
  }

  async update(uid: string, budgetId: string, input: BudgetUpdateInput) {
    const current = this.collection(uid).get(budgetId);
    if (!current) return null;
    const updated: BudgetRecord = {
      ...current,
      ...input,
      ...(input.startDate ? { startDate: `${input.startDate}T00:00:00.000Z` } : {}),
      ...(input.endDate ? { endDate: `${input.endDate}T23:59:59.999Z` } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.collection(uid).set(budgetId, updated);
    return updated;
  }

  async delete(uid: string, budgetId: string) {
    return this.collection(uid).delete(budgetId);
  }
}

const users = {
  "token-a": { uid: "user-a", email: "a@example.com", emailVerified: true },
  "token-b": { uid: "user-b", email: "b@example.com", emailVerified: true },
} as const;

let server: Server | undefined;
let baseUrl = "";

async function request(token: keyof typeof users | null, path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  }
});

async function startTestServer() {
  const transactionRepository = new MemoryTransactionRepository();
  const budgetRepository = new MemoryBudgetRepository();
  const app = createApp({
    transactionRepository,
    budgetRepository,
    verifyToken: async (token) => {
      const user = users[token as keyof typeof users];
      if (!user) throw new Error("invalid token");
      return user;
    },
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { transactionRepository, budgetRepository };
}

describe("budget API", () => {
  it("rejects unauthenticated CRUD requests", async () => {
    await startTestServer();
    expect((await request(null, "/api/budgets")).status).toBe(401);
    expect((await request(null, "/api/budgets", { method: "POST", body: JSON.stringify({}) })).status).toBe(401);
    expect((await request(null, "/api/budgets/budget-1", { method: "PATCH", body: JSON.stringify({ name: "Nope" }) })).status).toBe(401);
    expect((await request(null, "/api/budgets/budget-1", { method: "DELETE" })).status).toBe(401);
  });

  it("rejects invalid amounts, date ranges, and user-controlled ownership fields", async () => {
    await startTestServer();
    const response = await request("token-a", "/api/budgets", {
      method: "POST",
      body: JSON.stringify({
        name: "Invalid",
        amountMinor: 0,
        period: "monthly",
        startDate: "2026-09-30",
        endDate: "2026-09-01",
        userId: "user-b",
      }),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");

    const invalidCalendarDate = await request("token-a", "/api/budgets", {
      method: "POST",
      body: JSON.stringify({
        name: "Invalid date",
        amountMinor: 1000,
        period: "monthly",
        startDate: "2026-02-31",
      }),
    });
    expect(invalidCalendarDate.status).toBe(400);
  });

  it("derives spent, remaining, usage, and status from matching transactions", async () => {
    await startTestServer();
    for (const transaction of [
      { amountMinor: 400000, type: "expense", merchant: "Food market", category: "Food", occurredAt: "2026-09-15" },
      { amountMinor: 100000, type: "income", merchant: "Refund", category: "Food", occurredAt: "2026-09-16" },
      { amountMinor: 50000, type: "expense", merchant: "Travel", category: "Travel", occurredAt: "2026-09-17" },
      { amountMinor: 100000, type: "expense", merchant: "Old market", category: "Food", occurredAt: "2026-08-31" },
    ]) {
      expect((await request("token-a", "/api/transactions", { method: "POST", body: JSON.stringify(transaction) })).status).toBe(201);
    }
    const response = await request("token-a", "/api/budgets", {
      method: "POST",
      body: JSON.stringify({ name: "Food", category: "Food", amountMinor: 500000, period: "monthly", startDate: "2026-09-01", endDate: "2026-09-30" }),
    });
    const body = (await response.json()).data;
    expect(response.status).toBe(201);
    expect(body.spentMinor).toBe(400000);
    expect(body.remainingMinor).toBe(100000);
    expect(body.usagePercent).toBe(80);
    expect(body.status).toBe("approaching");
    expect(body).not.toHaveProperty("ownerId");
  });

  it("supports list, get, update, delete, and missing resources", async () => {
    await startTestServer();
    const created = await request("token-a", "/api/budgets", {
      method: "POST",
      body: JSON.stringify({ name: "Essentials", amountMinor: 100000, period: "monthly", startDate: "2026-09-01", endDate: "2026-09-30" }),
    });
    const budget = (await created.json()).data as BudgetRecord;
    expect((await request("token-a", "/api/budgets?month=2026-09")).status).toBe(200);
    expect(((await (await request("token-a", "/api/budgets?month=2026-09")).json()).data as BudgetListData).items).toHaveLength(1);
    expect((await request("token-a", `/api/budgets/${budget.id}`)).status).toBe(200);
    const updated = await request("token-a", `/api/budgets/${budget.id}`, { method: "PATCH", body: JSON.stringify({ amountMinor: 200000 }) });
    expect((await updated.json()).data.amountMinor).toBe(200000);
    expect((await request("token-a", `/api/budgets/${budget.id}`, { method: "DELETE" })).status).toBe(204);
    expect((await request("token-a", `/api/budgets/${budget.id}`)).status).toBe(404);
    expect((await request("token-a", `/api/budgets/${budget.id}`, { method: "DELETE" })).status).toBe(404);
  });

  it("isolates budgets by verified user", async () => {
    await startTestServer();
    const created = await request("token-b", "/api/budgets", {
      method: "POST",
      body: JSON.stringify({ name: "Private", category: "Private", amountMinor: 90000, period: "monthly", startDate: "2026-09-01", endDate: "2026-09-30" }),
    });
    const budget = (await created.json()).data as BudgetRecord;
    expect((await request("token-a", `/api/budgets/${budget.id}`)).status).toBe(404);
    expect((await request("token-a", `/api/budgets/${budget.id}`, { method: "PATCH", body: JSON.stringify({ name: "Stolen" }) })).status).toBe(404);
    expect((await request("token-a", `/api/budgets/${budget.id}`, { method: "DELETE" })).status).toBe(404);
    const list = (await (await request("token-a", "/api/budgets")).json()).data as BudgetListData;
    expect(list.items).toHaveLength(0);
  });
});