import type { TransactionCreateInput, TransactionListQuery, TransactionUpdateInput } from "../../../shared/schemas/index.js";
import type { TransactionListData, TransactionRecord } from "../../../shared/types/index.js";

export type TransactionUpdateData = TransactionUpdateInput;
export type AnalyticsTransactionQuery = {
  from: string;
  to: string;
  pageSize: number;
  pageToken?: string;
};

export interface TransactionRepository {
  create(uid: string, input: TransactionCreateInput): Promise<TransactionRecord>;
  list(uid: string, query: TransactionListQuery): Promise<TransactionListData>;
  listForAnalytics?(uid: string, query: AnalyticsTransactionQuery): Promise<TransactionListData>;
  get(uid: string, transactionId: string): Promise<TransactionRecord | null>;
  update(uid: string, transactionId: string, input: TransactionUpdateData): Promise<TransactionRecord | null>;
  delete(uid: string, transactionId: string): Promise<boolean>;
}

export class TransactionRepositoryError extends Error {
  constructor(message = "Firestore transaction operation failed.", options?: ErrorOptions) {
    super(message, options);
    this.name = "TransactionRepositoryError";
  }
}

export class InvalidTransactionCursorError extends Error {
  constructor() {
    super("The transaction page cursor is invalid.");
    this.name = "InvalidTransactionCursorError";
  }
}