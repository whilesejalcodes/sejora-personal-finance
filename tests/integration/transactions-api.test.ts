import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { TransactionCreateInput, TransactionListQuery, TransactionUpdateInput } from "../../shared/schemas/index.js";
import type { TransactionListData, TransactionRecord } from "../../shared/types/index.js";
import { createApp } from "../../server/src/app.js";
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
    const transaction: TransactionRecord = {
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
      ...(input.receiptId ? { receiptId: input.receiptId } : {}),
      createdAt: now,
      updatedAt: now,
    };
    this.collection(uid).set(transaction.id, transaction);
    return transaction;
  }

  async list(uid: string, query: TransactionListQuery): Promise<TransactionListData> {
    const cursor = query.pageToken ? Number(Buffer.from(query.pageToken, "base64url").toString("utf8")) : 0;
    const records = [...this.collection(uid).values()]
      .filter((item) => !query.type || item.type === query.type)
      .filter((item) => !query.category || item.category === query.category)
      .filter((item) => !query.paymentMethod || item.paymentMethod === query.paymentMethod)
      .filter((item) => !query.q || [item.merchant, item.category, item.notes ?? ""].some((value) => value.toLowerCase().includes(query.q!.toLowerCase())))
      .sort((a, b) => {
        if (query.sort === "amountAsc") return a.amountMinor - b.amountMinor;
        if (query.sort === "amountDesc") return b.amountMinor - a.amountMinor;
        const result = a.occurredAt.localeCompare(b.occurredAt);
        return query.sort === "oldest" ? result : -result;
      });
    const page = records.slice(cursor, cursor + query.pageSize);
    const hasNextPage = cursor + query.pageSize < records.length;
    return {
      items: page,
      hasNextPage,
      nextCursor: hasNextPage ? Buffer.from(String(cursor + query.pageSize), "utf8").toString("base64url") : null,
    };
  }

  async get(uid: string, transactionId: string) {
    return this.collection(uid).get(transactionId) ?? null;
  }

  async update(uid: string, transactionId: string, input: TransactionUpdateInput) {
    const current = this.collection(uid).get(transactionId);
    if (!current) return null;
    const updated: TransactionRecord = {
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

const verifiedUsers = {
  "token-a": { uid: "user-a", email: "a@example.com", emailVerified: true },
  "token-b": { uid: "user-b", email: "b@example.com", emailVerified: true },
} as const;

let server: Server | undefined;
let baseUrl = "";
const repository = new MemoryTransactionRepository();

async function request(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function authenticatedRequest(token: keyof typeof verifiedUsers, path: string, init: RequestInit = {}) {
  return request(path, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  });
}

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  }
});

async function startTestServer() {
  const app = createApp({
    transactionRepository: repository,
    verifyToken: async (token) => {
      const user = verifiedUsers[token as keyof typeof verifiedUsers];
      if (!user) throw new Error("invalid token");
      return user;
    },
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
}

describe("transaction API", () => {
  it("rejects unauthenticated reads and writes", async () => {
    await startTestServer();
    const read = await request("/api/transactions");
    const write = await request("/api/transactions", { method: "POST", body: JSON.stringify({}) });
    expect(read.status).toBe(401);
    expect(write.status).toBe(401);
  });

  it("validates strict transaction creation input", async () => {
    await startTestServer();
    const response = await authenticatedRequest("token-a", "/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        amountMinor: -100,
        type: "expense",
        merchant: "Market",
        category: "Food",
        occurredAt: "2026-09-01",
        ownerId: "user-b",
      }),
    });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects impossible calendar dates and invalid merged expense patches", async () => {
    await startTestServer();
    const invalidDate = await authenticatedRequest("token-a", "/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        amountMinor: 1000,
        type: "expense",
        merchant: "Market",
        category: "Food",
        occurredAt: "2026-02-31",
      }),
    });
    expect(invalidDate.status).toBe(400);

    const createdResponse = await authenticatedRequest("token-a", "/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        amountMinor: 1000,
        type: "expense",
        merchant: "Market",
        category: "Food",
        occurredAt: "2026-02-01",
      }),
    });
    const created = (await createdResponse.json()).data as TransactionRecord;
    const clearedCategory = await authenticatedRequest("token-a", `/api/transactions/${created.id}`, {
      method: "PATCH",
      body: JSON.stringify({ category: "" }),
    });
    expect(clearedCategory.status).toBe(400);
  });

  it("maps malformed JSON to a safe validation error", async () => {
    await startTestServer();
    const response = await authenticatedRequest("token-a", "/api/transactions", {
      method: "POST",
      body: "{\"amountMinor\":",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "The request body contains invalid JSON.",
      },
    });
  });

  it("creates, retrieves, updates, and deletes a transaction", async () => {
    await startTestServer();
    const createdResponse = await authenticatedRequest("token-a", "/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        amountMinor: 124000,
        type: "expense",
        merchant: "Market",
        category: "Food",
        occurredAt: "2026-09-01",
        paymentMethod: "UPI",
      }),
    });
    const created = (await createdResponse.json()).data as TransactionRecord;
    expect(createdResponse.status).toBe(201);
    expect(created.currency).toBe("INR");
    expect(created.source).toBe("manual");
    expect(created).not.toHaveProperty("ownerId");

    const retrieved = await authenticatedRequest("token-a", `/api/transactions/${created.id}`);
    expect(retrieved.status).toBe(200);
    expect((await retrieved.json()).data.merchant).toBe("Market");

    const updated = await authenticatedRequest("token-a", `/api/transactions/${created.id}`, {
      method: "PATCH",
      body: JSON.stringify({ merchant: "Updated market", amountMinor: 130000 }),
    });
    expect(updated.status).toBe(200);
    expect((await updated.json()).data.merchant).toBe("Updated market");

    const deleted = await authenticatedRequest("token-a", `/api/transactions/${created.id}`, { method: "DELETE" });
    expect(deleted.status).toBe(204);
    const missing = await authenticatedRequest("token-a", `/api/transactions/${created.id}`);
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("enforces ownership by scoping resource paths to the verified user", async () => {
    await startTestServer();
    const createdResponse = await authenticatedRequest("token-a", "/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        amountMinor: 5000,
        type: "income",
        merchant: "Refund",
        category: "Other",
        occurredAt: "2026-08-31",
      }),
    });
    const created = (await createdResponse.json()).data as TransactionRecord;
    const foreignRead = await authenticatedRequest("token-b", `/api/transactions/${created.id}`);
    const foreignDelete = await authenticatedRequest("token-b", `/api/transactions/${created.id}`, { method: "DELETE" });
    expect(foreignRead.status).toBe(404);
    expect(foreignDelete.status).toBe(404);
  });

  it("returns paginated, filtered, and sorted user-scoped results", async () => {
    await startTestServer();
    for (const input of [
      { amountMinor: 1000, type: "expense", merchant: "Tea shop", category: "Food", occurredAt: "2026-09-01" },
      { amountMinor: 9000, type: "expense", merchant: "Book store", category: "Learning", occurredAt: "2026-09-02" },
      { amountMinor: 4000, type: "income", merchant: "Refund", category: "Other", occurredAt: "2026-09-03" },
    ]) {
      await authenticatedRequest("token-a", "/api/transactions", { method: "POST", body: JSON.stringify(input) });
    }
    const first = await authenticatedRequest("token-a", "/api/transactions?pageSize=1&sort=amountDesc&type=expense");
    const firstBody = (await first.json()).data as TransactionListData;
    expect(first.status).toBe(200);
    expect(firstBody.items).toHaveLength(1);
    expect(firstBody.items[0].amountMinor).toBe(9000);
    expect(firstBody.hasNextPage).toBe(true);

    const second = await authenticatedRequest("token-a", `/api/transactions?pageSize=1&sort=amountDesc&type=expense&pageToken=${encodeURIComponent(firstBody.nextCursor!)}`);
    const secondBody = (await second.json()).data as TransactionListData;
    expect(secondBody.items[0].amountMinor).toBe(1000);

    const foreignList = await authenticatedRequest("token-b", "/api/transactions");
    expect((await foreignList.json()).data.items).toHaveLength(0);
  });
});