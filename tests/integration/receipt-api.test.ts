import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TransactionCreateInput, TransactionListQuery, TransactionUpdateInput } from "../../shared/schemas/index.js";
import type { ReceiptScanData, TransactionListData, TransactionRecord } from "../../shared/types/index.js";
import { createApp } from "../../server/src/app.js";
import type { ReceiptExtractor } from "../../server/src/receipts/receipt-service.js";
import type { TransactionRepository } from "../../server/src/transactions/transaction-repository.js";

class MemoryTransactionRepository implements TransactionRepository {
  readonly created: TransactionRecord[] = [];
  async create(uid: string, input: TransactionCreateInput): Promise<TransactionRecord> {
    const record: TransactionRecord = {
      id: `${uid}-transaction-${this.created.length + 1}`,
      amountMinor: input.amountMinor,
      currency: "INR",
      type: input.type,
      merchant: input.merchant,
      ...(input.category ? { category: input.category } : {}),
      occurredAt: `${input.occurredAt}T00:00:00.000Z`,
      ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
      source: input.source ?? "manual",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.created.push(record);
    return record;
  }
  async list(_uid: string, _query: TransactionListQuery): Promise<TransactionListData> {
    return { items: this.created, hasNextPage: false, nextCursor: null };
  }
  async get(_uid: string, id: string) { return this.created.find((item) => item.id === id) ?? null; }
  async update(_uid: string, id: string, input: TransactionUpdateInput) { const current = this.created.find((item) => item.id === id); return current ? { ...current, ...input } : null; }
  async delete(_uid: string, id: string) { const index = this.created.findIndex((item) => item.id === id); if (index < 0) return false; this.created.splice(index, 1); return true; }
}

const users = {
  "token-a": { uid: "user-a", email: "a@example.com", emailVerified: true },
} as const;

const validScan: ReceiptScanData = {
  extraction: {
    merchant: "Fresh Market",
    occurredAt: "2026-09-10",
    amountMinor: 125_050,
    currency: "INR",
    type: "expense",
    category: "Food",
    paymentMethod: "UPI",
    lineItems: [],
    needsReview: [],
  },
  reviewMessage: "Review extracted fields before saving.",
};

let server: Server | undefined;
let baseUrl = "";
let repository: MemoryTransactionRepository;

async function startTestServer(extractor: ReceiptExtractor = { extract: async () => validScan }) {
  repository = new MemoryTransactionRepository();
  const app = createApp({
    transactionRepository: repository,
    receiptExtractor: extractor,
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
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

function receiptForm(data = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), type = "image/png") {
  if (data.length === 8) {
    data = new Uint8Array([
      ...data,
      0, 0, 0, 13, 73, 72, 68, 82,
      0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0,
    ]);
  }
  const form = new FormData();
  form.append("receipt", new Blob([data], { type }), "receipt.png");
  return form;
}

afterEach(async () => {
  vi.unstubAllEnvs();
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

describe("receipt scanning API", () => {
  it("rejects unauthenticated scans", async () => {
    await startTestServer();
    expect((await request(null, "/api/receipts/scan", { method: "POST", body: receiptForm() })).status).toBe(401);
  });

  it("rejects unsupported, malformed, and oversized uploads", async () => {
    await startTestServer();
    expect((await request("token-a", "/api/receipts/scan", { method: "POST", body: receiptForm(new Uint8Array([1, 2, 3]), "image/gif") })).status).toBe(400);
    expect((await request("token-a", "/api/receipts/scan", { method: "POST", body: receiptForm(new Uint8Array([1, 2, 3])) })).status).toBe(400);
    expect((await request("token-a", "/api/receipts/scan", { method: "POST", body: receiptForm(new Uint8Array(5 * 1024 * 1024 + 1)) })).status).toBe(400);

    const badDimensions = new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10,
      0, 0, 0, 13, 73, 72, 82,
      255, 255, 255, 255, 0, 0, 0, 1, 8, 2, 0, 0, 0,
    ]);
    expect((await request("token-a", "/api/receipts/scan", { method: "POST", body: receiptForm(badDimensions) })).status).toBe(400);
  });

  it("returns structured extraction without creating a transaction", async () => {
    const extractor = { extract: vi.fn(async () => validScan) };
    await startTestServer(extractor);
    const response = await request("token-a", "/api/receipts/scan", { method: "POST", body: receiptForm() });
    expect(response.status).toBe(200);
    expect((await response.json()).data.extraction.amountMinor).toBe(125_050);
    expect(extractor.extract).toHaveBeenCalledOnce();
    expect(repository.created).toHaveLength(0);
  });

  it("hides provider failures and malformed provider responses", async () => {
    await startTestServer({ extract: async () => { throw new Error("provider secret detail"); } });
    const providerFailure = await request("token-a", "/api/receipts/scan", { method: "POST", body: receiptForm() });
    expect(providerFailure.status).toBe(503);
    expect(await providerFailure.text()).not.toContain("provider secret detail");

    await new Promise<void>((resolve) => server!.close(() => resolve()));
    await startTestServer({ extract: async () => { throw new (await import("../../server/src/receipts/receipt-service.js")).ReceiptExtractionError(); } });
    const malformed = await request("token-a", "/api/receipts/scan", { method: "POST", body: receiptForm() });
    expect(malformed.status).toBe(502);
  });

  it("uses the existing transaction endpoint for final receipt confirmation", async () => {
    await startTestServer();
    const response = await request("token-a", "/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        amountMinor: validScan.extraction.amountMinor,
        type: validScan.extraction.type,
        merchant: validScan.extraction.merchant,
        category: validScan.extraction.category,
        occurredAt: validScan.extraction.occurredAt,
        paymentMethod: validScan.extraction.paymentMethod,
        source: "receipt",
      }),
    });
    expect(response.status).toBe(201);
    expect(repository.created[0]).toMatchObject({ source: "receipt", amountMinor: 125_050 });
  });
});