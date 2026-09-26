import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { TransactionCreateInput, TransactionListQuery, TransactionUpdateInput } from "../../shared/schemas/index.js";
import type { TransactionListData, TransactionRecord } from "../../shared/types/index.js";
import { createApp } from "../../server/src/app.js";
import type { TransactionRepository } from "../../server/src/transactions/transaction-repository.js";

class MemoryTransactionRepository implements TransactionRepository {
  private readonly users = new Map<string, TransactionRecord[]>();
  private sequence = 0;

  seed(uid: string, input: TransactionCreateInput): TransactionRecord {
    const now = new Date().toISOString();
    const record: TransactionRecord = {
      id: `transaction-${++this.sequence}`,
      amountMinor: input.amountMinor,
      currency: "INR",
      type: input.type,
      merchant: input.merchant,
      ...(input.category ? { category: input.category } : {}),
      occurredAt: `${input.occurredAt}T00:00:00.000Z`,
      source: input.source ?? "manual",
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(uid, [...(this.users.get(uid) ?? []), record]);
    return record;
  }

  snapshot(uid: string): TransactionRecord[] {
    return structuredClone(this.users.get(uid) ?? []);
  }

  async create(uid: string, input: TransactionCreateInput) { return this.seed(uid, input); }

  async list(uid: string, query: TransactionListQuery): Promise<TransactionListData> {
    return this.listForAnalytics(uid, { from: query.from ?? "1900-01-01", to: query.to ?? "2999-12-31", pageSize: query.pageSize, pageToken: query.pageToken });
  }

  async listForAnalytics(uid: string, query: { from: string; to: string; pageSize: number; pageToken?: string }): Promise<TransactionListData> {
    const items = (this.users.get(uid) ?? []).filter((item) => item.occurredAt.slice(0, 10) >= query.from && item.occurredAt.slice(0, 10) <= query.to);
    return { items, hasNextPage: false, nextCursor: null };
  }

  async get(uid: string, id: string) { return (this.users.get(uid) ?? []).find((item) => item.id === id) ?? null; }
  async update(uid: string, id: string, input: TransactionUpdateInput) {
    const current = await this.get(uid, id);
    return current ? { ...current, ...input } : null;
  }
  async delete(uid: string, id: string) {
    const current = this.users.get(uid) ?? [];
    const next = current.filter((item) => item.id !== id);
    this.users.set(uid, next);
    return next.length !== current.length;
  }
}

const users = {
  "token-a": { uid: "user-a", email: "a@example.com", emailVerified: true },
  "token-b": { uid: "user-b", email: "b@example.com", emailVerified: true },
} as const;

let server: Server | undefined;
let baseUrl = "";
let transactions: MemoryTransactionRepository;

async function request(token: keyof typeof users | null, path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
  });
}

async function startTestServer() {
  transactions = new MemoryTransactionRepository();
  const app = createApp({
    transactionRepository: transactions,
    forecastClock: () => "2026-09-15",
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

function seedBaseline() {
  for (const month of ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]) {
    transactions.seed("user-a", { amountMinor: 100_000, type: "income", merchant: "Employer", occurredAt: `${month}-01` });
    transactions.seed("user-a", { amountMinor: 70_000, type: "expense", merchant: "Living", category: "Home", occurredAt: `${month}-05` });
  }
  transactions.seed("user-a", { amountMinor: 5_000, type: "expense", merchant: "Current month", category: "Other", occurredAt: "2026-09-10" });
}

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

describe("Forecast API", () => {
  it("requires authentication and validates simulation input", async () => {
    await startTestServer();
    expect((await request(null, "/api/forecast")).status).toBe(401);
    expect((await request(null, "/api/forecast/simulate", { method: "POST", body: JSON.stringify({}) })).status).toBe(401);
    expect((await request("token-a", "/api/forecast?horizon=2")).status).toBe(400);
    expect((await request("token-a", "/api/forecast/simulate", { method: "POST", body: JSON.stringify({ expenseAdjustmentPercent: -101 }) })).status).toBe(400);
  });

  it("returns a deterministic forecast from the verified user's completed history", async () => {
    await startTestServer();
    seedBaseline();
    const response = await request("token-a", "/api/forecast?horizon=3");
    const body = (await response.json()).data;
    expect(response.status).toBe(200);
    expect(body.status).toBe("ready");
    expect(body.historicalWindow).toMatchObject({ from: "2026-03-01", to: "2026-08-31", monthCount: 6, activeMonthCount: 6 });
    expect(body.actualBalanceMinor).toBe(175_000);
    expect(body.baseline.metrics).toMatchObject({ monthlyIncomeMinor: 100_000, monthlyExpenseMinor: 70_000, monthlySavingsMinor: 30_000, savingsRate: 30, endingBalanceMinor: 265_000 });
    expect(body.baseline.projected.map((point: { month: string; balanceMinor: number }) => [point.month, point.balanceMinor])).toEqual([
      ["2026-10", 205_000],
      ["2026-11", 235_000],
      ["2026-12", 265_000],
    ]);
  });

  it("calculates a hypothetical scenario and leaves actual records unchanged", async () => {
    await startTestServer();
    seedBaseline();
    const before = transactions.snapshot("user-a");
    const response = await request("token-a", "/api/forecast/simulate", {
      method: "POST",
      body: JSON.stringify({ horizon: 3, expenseAdjustmentPercent: -10, oneTimeExpenseMinor: 50_000, savingsTargetMinor: 37_000 }),
    });
    const body = (await response.json()).data;
    expect(response.status).toBe(200);
    expect(body.baseline.metrics.monthlySavingsMinor).toBe(30_000);
    expect(body.scenario.metrics).toMatchObject({ monthlyIncomeMinor: 100_000, monthlyExpenseMinor: 63_000, monthlySavingsMinor: 37_000, savingsRate: 37, endingBalanceMinor: 236_000 });
    expect(body.scenario.projected[0]).toMatchObject({ expenseMinor: 113_000, netSavingsMinor: -13_000, savingsRate: -13, balanceMinor: 162_000 });
    expect(body.difference).toEqual({ monthlySavingsMinor: 7_000, endingBalanceMinor: -29_000 });
    expect(body.savingsTargetMet).toBe(true);
    expect(transactions.snapshot("user-a")).toEqual(before);
  });
});