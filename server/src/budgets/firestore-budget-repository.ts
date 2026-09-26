import {
  FieldValue,
  Timestamp,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
} from "firebase-admin/firestore";
import type { BudgetCreateInput, BudgetListQuery, BudgetUpdateInput } from "../../../shared/schemas/index.js";
import type { BudgetRecord } from "../../../shared/types/index.js";
import { getFirebaseAdminFirestore } from "../auth/firebase-admin.js";
import { BudgetRepositoryError, type BudgetRepository } from "./budget-repository.js";

const MAX_BUDGETS = 100;

function collectionFor(db: Firestore, uid: string) {
  return db.collection("users").doc(uid).collection("budgets");
}

function timestampForDateOnly(value: string, endOfDay = false): Timestamp {
  return Timestamp.fromDate(new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`));
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  throw new BudgetRepositoryError("Budget timestamp is invalid.");
}

function toRecord(snapshot: DocumentSnapshot<DocumentData>): BudgetRecord {
  if (!snapshot.exists) throw new BudgetRepositoryError("Budget document was not found after a write.");
  const data = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    name: data.name as string,
    ...(typeof data.category === "string" ? { category: data.category } : {}),
    amountMinor: data.amountMinor as number,
    currency: "INR",
    period: data.period as BudgetRecord["period"],
    startDate: timestampToIso(data.startDate),
    ...(data.endDate ? { endDate: timestampToIso(data.endDate) } : {}),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function toFirestoreData(input: BudgetCreateInput | BudgetUpdateInput): DocumentData {
  const data: DocumentData = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.category !== undefined) data.category = input.category;
  if (input.amountMinor !== undefined) data.amountMinor = input.amountMinor;
  if (input.period !== undefined) data.period = input.period;
  if (input.startDate !== undefined) data.startDate = timestampForDateOnly(input.startDate);
  if (input.endDate !== undefined) data.endDate = timestampForDateOnly(input.endDate, true);
  return data;
}

function monthOverlapsBudget(budget: BudgetRecord, month: string): boolean {
  const monthStart = `${month}-01`;
  const [year, monthNumber] = month.split("-").map(Number);
  const monthEnd = `${year}-${String(monthNumber).padStart(2, "0")}-${new Date(Date.UTC(year, monthNumber, 0)).getUTCDate().toString().padStart(2, "0")}`;
  const budgetEnd = budget.endDate?.slice(0, 10) ?? budget.startDate.slice(0, 10);
  return budget.startDate.slice(0, 10) <= monthEnd && budgetEnd >= monthStart;
}

export class FirestoreBudgetRepository implements BudgetRepository {
  constructor(private readonly db?: Firestore) {}

  private database(): Firestore {
    return this.db ?? getFirebaseAdminFirestore();
  }

  async create(uid: string, input: BudgetCreateInput): Promise<BudgetRecord> {
    try {
      const reference = collectionFor(this.database(), uid).doc();
      await reference.set({
        ...toFirestoreData(input),
        currency: "INR",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return toRecord(await reference.get());
    } catch (error) {
      if (error instanceof BudgetRepositoryError) throw error;
      throw new BudgetRepositoryError("Could not create budget.", { cause: error });
    }
  }

  async list(uid: string, query: BudgetListQuery): Promise<BudgetRecord[]> {
    try {
      const snapshot = await collectionFor(this.database(), uid).orderBy("startDate", "desc").limit(MAX_BUDGETS).get();
      const budgets = snapshot.docs.map(toRecord);
      return query.month ? budgets.filter((budget) => monthOverlapsBudget(budget, query.month!)) : budgets;
    } catch (error) {
      if (error instanceof BudgetRepositoryError) throw error;
      throw new BudgetRepositoryError("Could not list budgets.", { cause: error });
    }
  }

  async get(uid: string, budgetId: string): Promise<BudgetRecord | null> {
    try {
      const snapshot = await collectionFor(this.database(), uid).doc(budgetId).get();
      return snapshot.exists ? toRecord(snapshot) : null;
    } catch (error) {
      throw new BudgetRepositoryError("Could not retrieve budget.", { cause: error });
    }
  }

  async update(uid: string, budgetId: string, input: BudgetUpdateInput): Promise<BudgetRecord | null> {
    try {
      const reference = collectionFor(this.database(), uid).doc(budgetId);
      const existing = await reference.get();
      if (!existing.exists) return null;
      await reference.update({
        ...toFirestoreData(input),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return toRecord(await reference.get());
    } catch (error) {
      if (error instanceof BudgetRepositoryError) throw error;
      throw new BudgetRepositoryError("Could not update budget.", { cause: error });
    }
  }

  async delete(uid: string, budgetId: string): Promise<boolean> {
    try {
      const reference = collectionFor(this.database(), uid).doc(budgetId);
      const existing = await reference.get();
      if (!existing.exists) return false;
      await reference.delete();
      return true;
    } catch (error) {
      throw new BudgetRepositoryError("Could not delete budget.", { cause: error });
    }
  }
}