import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { BudgetCreateInput, BudgetListQuery, BudgetUpdateInput, GoalCreateInput, GoalListQuery, GoalUpdateInput, TransactionCreateInput, TransactionListQuery, TransactionUpdateInput } from "../../shared/schemas/index.js";
import type { BudgetRecord, GoalListData, GoalRecord, GoalView, TransactionListData, TransactionRecord, UpcomingCashFlowData, FinancialHealthData } from "../../shared/types/index.js";
import { createApp } from "../../server/src/app.js";
import type { BudgetRepository } from "../../server/src/budgets/budget-repository.js";
import type { GoalRepository } from "../../server/src/goals/goal-repository.js";
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
    const record: TransactionRecord = { id: `transaction-${++this.sequence}`, amountMinor: input.amountMinor, currency: "INR", type: input.type, merchant: input.merchant, ...(input.category ? { category: input.category } : {}), occurredAt: `${input.occurredAt}T00:00:00.000Z`, source: "manual", createdAt: now, updatedAt: now };
    this.collection(uid).set(record.id, record);
    return record;
  }
  async list(uid: string, query: TransactionListQuery): Promise<TransactionListData> {
    return this.listForAnalytics(uid, { from: query.from ?? "1900-01-01", to: query.to ?? "2999-12-31", pageSize: query.pageSize, pageToken: query.pageToken });
  }
  async listForAnalytics(uid: string, query: { from: string; to: string; pageSize: number; pageToken?: string }): Promise<TransactionListData> {
    const records = [...this.collection(uid).values()].filter((item) => item.occurredAt.slice(0, 10) >= query.from && item.occurredAt.slice(0, 10) <= query.to).sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id));
    return { items: records, hasNextPage: false, nextCursor: null };
  }
  async get(uid: string, id: string) { return this.collection(uid).get(id) ?? null; }
  async update(uid: string, id: string, input: TransactionUpdateInput) { const current = this.collection(uid).get(id); if (!current) return null; const updated = { ...current, ...input, ...(input.occurredAt ? { occurredAt: `${input.occurredAt}T00:00:00.000Z` } : {}) }; this.collection(uid).set(id, updated); return updated; }
  async delete(uid: string, id: string) { return this.collection(uid).delete(id); }
}

class MemoryBudgetRepository implements BudgetRepository {
  private readonly users = new Map<string, Map<string, BudgetRecord>>();
  private sequence = 0;
  seed(uid: string, input: BudgetCreateInput): BudgetRecord {
    const record: BudgetRecord = { id: `budget-${++this.sequence}`, name: input.name, amountMinor: input.amountMinor, currency: "INR", period: input.period, startDate: `${input.startDate}T00:00:00.000Z`, ...(input.endDate ? { endDate: `${input.endDate}T23:59:59.999Z` } : {}), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const user = this.users.get(uid) ?? new Map<string, BudgetRecord>();
    this.users.set(uid, user);
    user.set(record.id, record);
    return record;
  }
  private collection(uid: string) { return this.users.get(uid) ?? new Map<string, BudgetRecord>(); }
  async create(uid: string, input: BudgetCreateInput) { return this.seed(uid, input); }
  async list(uid: string, query: BudgetListQuery) { const records = [...this.collection(uid).values()]; return query.month ? records.filter((item) => item.startDate.startsWith(query.month!)) : records; }
  async get(uid: string, id: string) { return this.collection(uid).get(id) ?? null; }
  async update(uid: string, id: string, input: BudgetUpdateInput) { const current = this.collection(uid).get(id); if (!current) return null; const updated = { ...current, ...input }; this.collection(uid).set(id, updated); return updated; }
  async delete(uid: string, id: string) { return this.collection(uid).delete(id); }
}

class MemoryGoalRepository implements GoalRepository {
  private readonly users = new Map<string, Map<string, GoalRecord>>();
  private sequence = 0;
  private collection(uid: string) { const existing = this.users.get(uid); if (existing) return existing; const created = new Map<string, GoalRecord>(); this.users.set(uid, created); return created; }
  async create(uid: string, input: GoalCreateInput) { const now = new Date().toISOString(); const record: GoalRecord = { id: `goal-${++this.sequence}`, name: input.name, targetAmountMinor: input.targetAmountMinor, currentAmountMinor: input.currentAmountMinor, currency: "INR", targetDate: `${input.targetDate}T00:00:00.000Z`, ...(input.category ? { category: input.category } : {}), ...(input.notes ? { notes: input.notes } : {}), createdAt: now, updatedAt: now }; this.collection(uid).set(record.id, record); return record; }
  async list(uid: string, _query: GoalListQuery) { return [...this.collection(uid).values()]; }
  async get(uid: string, id: string) { return this.collection(uid).get(id) ?? null; }
  async update(uid: string, id: string, input: GoalUpdateInput) { const current = this.collection(uid).get(id); if (!current) return null; const updated = { ...current, ...input, ...(input.targetDate ? { targetDate: `${input.targetDate}T00:00:00.000Z` } : {}), updatedAt: new Date().toISOString() }; this.collection(uid).set(id, updated); return updated; }
  async delete(uid: string, id: string) { return this.collection(uid).delete(id); }
}

const users = {
  "token-a": { uid: "user-a", email: "a@example.com", emailVerified: true },
  "token-b": { uid: "user-b", email: "b@example.com", emailVerified: true },
} as const;

let server: Server | undefined;
let baseUrl = "";
let transactionRepository: MemoryTransactionRepository;
let budgetRepository: MemoryBudgetRepository;
let goalRepository: MemoryGoalRepository;

async function startTestServer() {
  transactionRepository = new MemoryTransactionRepository();
  budgetRepository = new MemoryBudgetRepository();
  goalRepository = new MemoryGoalRepository();
  const app = createApp({
    transactionRepository,
    budgetRepository,
    goalRepository,
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

async function request(token: keyof typeof users | null, path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) } });
}

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

describe("Phase 7 API", () => {
  it("rejects unauthenticated Phase 7 requests", async () => {
    await startTestServer();
    expect((await request(null, "/api/goals")).status).toBe(401);
    expect((await request(null, "/api/financial-health?month=2026-09")).status).toBe(401);
    expect((await request(null, "/api/cash-flow/upcoming?from=2026-09-01&to=2026-09-30")).status).toBe(401);
  });

  it("validates goals and supports create, read, update, and delete", async () => {
    await startTestServer();
    const invalid = await request("token-a", "/api/goals", { method: "POST", body: JSON.stringify({ name: "Too much", targetAmountMinor: 100_000, currentAmountMinor: 100_001, targetDate: "2026-02-31" }) });
    expect(invalid.status).toBe(400);
    const created = await request("token-a", "/api/goals", { method: "POST", body: JSON.stringify({ name: "Emergency fund", targetAmountMinor: 100_000, currentAmountMinor: 0, targetDate: "2027-01-01" }) });
    expect(created.status).toBe(201);
    const goal = (await created.json()).data as GoalView;
    expect(goal).toMatchObject({ status: "not_started", remainingAmountMinor: 100_000, percentageComplete: 0 });
    expect(((await (await request("token-a", "/api/goals")).json()).data as GoalListData).items).toHaveLength(1);
    const updated = await request("token-a", `/api/goals/${goal.id}`, { method: "PATCH", body: JSON.stringify({ currentAmountMinor: 80_000 }) });
    expect((await updated.json()).data).toMatchObject({ status: "nearly_there", percentageComplete: 80 });
    expect((await request("token-a", `/api/goals/${goal.id}`, { method: "DELETE" })).status).toBe(204);
    expect((await request("token-a", `/api/goals/${goal.id}`)).status).toBe(404);
  });

  it("isolates goals by verified UID", async () => {
    await startTestServer();
    const created = await request("token-b", "/api/goals", { method: "POST", body: JSON.stringify({ name: "Private", targetAmountMinor: 100_000, currentAmountMinor: 10_000, targetDate: "2027-01-01" }) });
    const goal = (await created.json()).data as GoalView;
    expect((await request("token-a", `/api/goals/${goal.id}`)).status).toBe(404);
    expect((await request("token-a", `/api/goals/${goal.id}`, { method: "PATCH", body: JSON.stringify({ name: "Stolen" }) })).status).toBe(404);
    expect((await request("token-a", `/api/goals/${goal.id}`, { method: "DELETE" })).status).toBe(404);
  });

  it("returns deterministic health and expected recurring cash flow", async () => {
    await startTestServer();
    budgetRepository.seed("user-a", { name: "Monthly", amountMinor: 100_000, period: "monthly", startDate: "2026-09-01", endDate: "2026-09-30" });
    await goalRepository.create("user-a", { name: "Fund", targetAmountMinor: 100_000, currentAmountMinor: 50_000, targetDate: "2027-01-01" });
    for (const month of ["2026-06", "2026-07", "2026-08"]) {
      await transactionRepository.create("user-a", { amountMinor: 100_000, type: "income", merchant: "Employer", occurredAt: `${month}-01` });
      await transactionRepository.create("user-a", { amountMinor: 1_499, type: "expense", merchant: "Netflix", category: "Entertainment", occurredAt: `${month}-05` });
    }
    const healthResponse = await request("token-a", "/api/financial-health?month=2026-09");
    const cashFlowResponse = await request("token-a", "/api/cash-flow/upcoming?from=2026-09-01&to=2026-09-30");
    expect(healthResponse.status).toBe(200);
    expect(cashFlowResponse.status).toBe(200);
    const health = (await healthResponse.json()).data as FinancialHealthData;
    const cashFlow = (await cashFlowResponse.json()).data as UpcomingCashFlowData;
    expect(health.disclaimer).toContain("not professional financial advice");
    expect(health.components).toHaveLength(5);
    expect(cashFlow.items).toMatchObject([{ merchant: "Netflix", amountMinor: 1_499, expectedAt: "2026-09-05", type: "expense" }]);
    expect(cashFlow.summary).toMatchObject({ expectedIncomeMinor: 0, expectedExpenseMinor: 1_499, expectedNetFlowMinor: -1_499 });
  });
});