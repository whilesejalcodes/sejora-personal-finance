import {
  FieldPath,
  FieldValue,
  Timestamp,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
  type Query,
} from "firebase-admin/firestore";
import type { TransactionCreateInput, TransactionListQuery, TransactionUpdateInput } from "../../../shared/schemas/index.js";
import type { TransactionListData, TransactionRecord } from "../../../shared/types/index.js";
import { getFirebaseAdminFirestore } from "../auth/firebase-admin.js";
import {
  InvalidTransactionCursorError,
  TransactionRepositoryError,
  type AnalyticsTransactionQuery,
  type TransactionRepository,
} from "./transaction-repository.js";

type CursorValue = string | number;
type CursorPayload = {
  sort: TransactionListQuery["sort"];
  value: CursorValue;
  id: string;
};

const SEARCH_SCAN_LIMIT = 500;

function collectionFor(db: Firestore, uid: string) {
  return db.collection("users").doc(uid).collection("transactions");
}

function timestampForDateOnly(value: string, endOfDay = false) {
  return Timestamp.fromDate(new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`));
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(value: string, sort: TransactionListQuery["sort"]): CursorPayload {
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as CursorPayload;
    if (decoded.sort !== sort || typeof decoded.id !== "string" || (typeof decoded.value !== "number" && typeof decoded.value !== "string")) {
      throw new Error("Invalid cursor.");
    }
    return decoded;
  } catch {
    throw new InvalidTransactionCursorError();
  }
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return new Date(value).toISOString();
  }
  throw new TransactionRepositoryError("Transaction timestamp is invalid.");
}

function toRecord(snapshot: DocumentSnapshot<DocumentData>): TransactionRecord {
  if (!snapshot.exists) {
    throw new TransactionRepositoryError("Transaction document was not found after a write.");
  }
  const data = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    amountMinor: data.amountMinor as number,
    currency: "INR",
    type: data.type as TransactionRecord["type"],
    merchant: data.merchant as string,
    ...(typeof data.category === "string" ? { category: data.category } : {}),
    occurredAt: timestampToIso(data.occurredAt),
    ...(typeof data.paymentMethod === "string" ? { paymentMethod: data.paymentMethod } : {}),
    ...(typeof data.notes === "string" ? { notes: data.notes } : {}),
    source: (data.source ?? "manual") as TransactionRecord["source"],
    ...(typeof data.receiptId === "string" ? { receiptId: data.receiptId } : {}),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function toFirestoreData(input: TransactionCreateInput | TransactionUpdateInput): DocumentData {
  const data: DocumentData = {};
  if (input.amountMinor !== undefined) data.amountMinor = input.amountMinor;
  if (input.type !== undefined) data.type = input.type;
  if (input.merchant !== undefined) data.merchant = input.merchant;
  if (input.category !== undefined) data.category = input.category;
  if (input.occurredAt !== undefined) data.occurredAt = timestampForDateOnly(input.occurredAt);
  if (input.paymentMethod !== undefined) data.paymentMethod = input.paymentMethod;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.receiptId !== undefined) data.receiptId = input.receiptId;
  return data;
}

function sortConfig(sort: TransactionListQuery["sort"]) {
  return sort === "amountAsc" || sort === "amountDesc"
    ? { field: "amountMinor", direction: sort === "amountAsc" ? "asc" as const : "desc" as const }
    : { field: "occurredAt", direction: sort === "newest" ? "desc" as const : "asc" as const };
}

function searchMatches(transaction: TransactionRecord, query: string): boolean {
  const normalizedQuery = query.toLocaleLowerCase("en-IN");
  return [transaction.merchant, transaction.category ?? "", transaction.notes ?? ""]
    .some((value) => value.toLocaleLowerCase("en-IN").includes(normalizedQuery));
}

function matchesInMemoryFilters(transaction: TransactionRecord, query: TransactionListQuery): boolean {
  if (query.type && transaction.type !== query.type) return false;
  if (query.category && transaction.category !== query.category) return false;
  if (query.paymentMethod && transaction.paymentMethod !== query.paymentMethod) return false;
  const occurredAt = Date.parse(transaction.occurredAt);
  if (query.from && occurredAt < Date.parse(`${query.from}T00:00:00.000Z`)) return false;
  if (query.to && occurredAt > Date.parse(`${query.to}T23:59:59.999Z`)) return false;
  if (query.minAmountMinor !== undefined && transaction.amountMinor < query.minAmountMinor) return false;
  if (query.maxAmountMinor !== undefined && transaction.amountMinor > query.maxAmountMinor) return false;
  if (query.q && !searchMatches(transaction, query.q)) return false;
  return true;
}

function isAfterCursor(record: TransactionRecord, cursor: CursorPayload, sort: TransactionListQuery["sort"]): boolean {
  const value = sort === "amountAsc" || sort === "amountDesc" ? record.amountMinor : record.occurredAt;
  const direction = sort === "oldest" || sort === "amountAsc" ? 1 : -1;
  const comparison = value < cursor.value ? -1 : value > cursor.value ? 1 : 0;
  return comparison * direction > 0 || (comparison === 0 && (direction === 1 ? record.id > cursor.id : record.id < cursor.id));
}

export class FirestoreTransactionRepository implements TransactionRepository {
  constructor(private readonly db?: Firestore) {}

  private database(): Firestore {
    return this.db ?? getFirebaseAdminFirestore();
  }

  async create(uid: string, input: TransactionCreateInput): Promise<TransactionRecord> {
    try {
      const reference = collectionFor(this.database(), uid).doc();
      await reference.set({
        ...toFirestoreData(input),
        currency: "INR",
        source: input.source ?? "manual",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return toRecord(await reference.get());
    } catch (error) {
      if (error instanceof TransactionRepositoryError) throw error;
      throw new TransactionRepositoryError("Could not create transaction.", { cause: error });
    }
  }

  async list(uid: string, query: TransactionListQuery): Promise<TransactionListData> {
    try {
      const { field, direction } = sortConfig(query.sort);
      let firestoreQuery: Query<DocumentData> = collectionFor(this.database(), uid);
      const hasFilters = Boolean(
        query.q
        || query.type
        || query.category
        || query.paymentMethod
        || query.from
        || query.to
        || query.minAmountMinor !== undefined
        || query.maxAmountMinor !== undefined,
      );
      firestoreQuery = firestoreQuery.orderBy(field, direction).orderBy(FieldPath.documentId(), direction);

      if (hasFilters) {
        const snapshots = await firestoreQuery.limit(SEARCH_SCAN_LIMIT).get();
        let items = snapshots.docs.map(toRecord).filter((item) => matchesInMemoryFilters(item, query));
        if (query.pageToken) {
          items = items.filter((item) => isAfterCursor(item, decodeCursor(query.pageToken!, query.sort), query.sort));
        }
        const page = items.slice(0, query.pageSize);
        const hasNextPage = items.length > page.length;
        return {
          items: page,
          hasNextPage,
          nextCursor: hasNextPage && page.length > 0
            ? encodeCursor({ sort: query.sort, value: field === "amountMinor" ? page[page.length - 1].amountMinor : page[page.length - 1].occurredAt, id: page[page.length - 1].id })
            : null,
        };
      }

      if (query.pageToken) {
        const cursor = decodeCursor(query.pageToken, query.sort);
        firestoreQuery = firestoreQuery.startAfter(cursor.value, cursor.id);
      }

      const snapshots = await firestoreQuery.limit(query.pageSize + 1).get();
      const records = snapshots.docs.map(toRecord);
      const items = records.slice(0, query.pageSize);
      const hasNextPage = records.length > query.pageSize;
      return {
        items,
        hasNextPage,
        nextCursor: hasNextPage && items.length > 0
          ? encodeCursor({ sort: query.sort, value: field === "amountMinor" ? items[items.length - 1].amountMinor : items[items.length - 1].occurredAt, id: items[items.length - 1].id })
          : null,
      };
    } catch (error) {
      if (error instanceof TransactionRepositoryError) throw error;
      throw new TransactionRepositoryError("Could not list transactions.", { cause: error });
    }
  }

  async listForAnalytics(uid: string, query: AnalyticsTransactionQuery): Promise<TransactionListData> {
    try {
      const start = timestampForDateOnly(query.from);
      const end = timestampForDateOnly(query.to, true);
      let firestoreQuery: Query<DocumentData> = collectionFor(this.database(), uid)
        .where("occurredAt", ">=", start)
        .where("occurredAt", "<=", end)
        .orderBy("occurredAt", "asc")
        .orderBy(FieldPath.documentId(), "asc");

      if (query.pageToken) {
        const cursor = decodeCursor(query.pageToken, "oldest");
        firestoreQuery = firestoreQuery.startAfter(Timestamp.fromDate(new Date(String(cursor.value))), cursor.id);
      }

      const snapshots = await firestoreQuery.limit(query.pageSize + 1).get();
      const records = snapshots.docs.map(toRecord);
      const items = records.slice(0, query.pageSize);
      const hasNextPage = records.length > query.pageSize;
      return {
        items,
        hasNextPage,
        nextCursor: hasNextPage && items.length > 0
          ? encodeCursor({ sort: "oldest", value: items[items.length - 1].occurredAt, id: items[items.length - 1].id })
          : null,
      };
    } catch (error) {
      if (error instanceof InvalidTransactionCursorError) throw error;
      if (error instanceof TransactionRepositoryError) throw error;
      throw new TransactionRepositoryError("Could not load analytics transactions.", { cause: error });
    }
  }

  async get(uid: string, transactionId: string): Promise<TransactionRecord | null> {
    try {
      const snapshot = await collectionFor(this.database(), uid).doc(transactionId).get();
      return snapshot.exists ? toRecord(snapshot) : null;
    } catch (error) {
      throw new TransactionRepositoryError("Could not retrieve transaction.", { cause: error });
    }
  }

  async update(uid: string, transactionId: string, input: TransactionUpdateInput): Promise<TransactionRecord | null> {
    try {
      const reference = collectionFor(this.database(), uid).doc(transactionId);
      const existing = await reference.get();
      if (!existing.exists) return null;
      await reference.update({
        ...toFirestoreData(input),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return toRecord(await reference.get());
    } catch (error) {
      if (error instanceof TransactionRepositoryError) throw error;
      throw new TransactionRepositoryError("Could not update transaction.", { cause: error });
    }
  }

  async delete(uid: string, transactionId: string): Promise<boolean> {
    try {
      const reference = collectionFor(this.database(), uid).doc(transactionId);
      const existing = await reference.get();
      if (!existing.exists) return false;
      await reference.delete();
      return true;
    } catch (error) {
      throw new TransactionRepositoryError("Could not delete transaction.", { cause: error });
    }
  }
}