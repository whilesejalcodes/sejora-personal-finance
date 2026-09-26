import { transactionCreateSchema, type TransactionCreateInput, type TransactionListQuery, type TransactionUpdateInput } from "../../../shared/schemas/index.js";
import type { TransactionListData, TransactionRecord } from "../../../shared/types/index.js";
import { ResourceNotFoundError } from "../errors.js";
import type { TransactionRepository } from "./transaction-repository.js";

export class TransactionService {
  constructor(private readonly repository: TransactionRepository) {}

  create(uid: string, input: TransactionCreateInput): Promise<TransactionRecord> {
    return this.repository.create(uid, input);
  }

  list(uid: string, query: TransactionListQuery): Promise<TransactionListData> {
    return this.repository.list(uid, query);
  }

  async get(uid: string, transactionId: string): Promise<TransactionRecord> {
    const transaction = await this.repository.get(uid, transactionId);
    if (!transaction) throw new ResourceNotFoundError();
    return transaction;
  }

  async update(uid: string, transactionId: string, input: TransactionUpdateInput): Promise<TransactionRecord> {
    const existing = await this.repository.get(uid, transactionId);
    if (!existing) throw new ResourceNotFoundError();
    const completeInput = transactionCreateSchema.parse({
      amountMinor: input.amountMinor ?? existing.amountMinor,
      type: input.type ?? existing.type,
      merchant: input.merchant ?? existing.merchant,
      ...(input.category !== undefined ? { category: input.category } : existing.category ? { category: existing.category } : {}),
      occurredAt: input.occurredAt ?? existing.occurredAt.slice(0, 10),
      ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod } : existing.paymentMethod ? { paymentMethod: existing.paymentMethod } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : existing.notes ? { notes: existing.notes } : {}),
      ...(input.receiptId !== undefined ? { receiptId: input.receiptId } : existing.receiptId ? { receiptId: existing.receiptId } : {}),
      source: existing.source,
    });
    const transaction = await this.repository.update(uid, transactionId, completeInput);
    if (!transaction) throw new ResourceNotFoundError();
    return transaction;
  }

  async delete(uid: string, transactionId: string): Promise<void> {
    const deleted = await this.repository.delete(uid, transactionId);
    if (!deleted) throw new ResourceNotFoundError();
  }
}