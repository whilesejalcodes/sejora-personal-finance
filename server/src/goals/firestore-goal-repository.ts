import { FieldValue, Timestamp, type DocumentData, type DocumentSnapshot, type Firestore } from "firebase-admin/firestore";
import type { GoalCreateInput, GoalListQuery, GoalUpdateInput } from "../../../shared/schemas/index.js";
import type { GoalRecord } from "../../../shared/types/index.js";
import { getFirebaseAdminFirestore } from "../auth/firebase-admin.js";
import { GoalRepositoryError, type GoalRepository } from "./goal-repository.js";

const MAX_GOALS = 100;

function collectionFor(db: Firestore, uid: string) {
  return db.collection("users").doc(uid).collection("goals");
}

function timestampForDateOnly(value: string, endOfDay = false): Timestamp {
  return Timestamp.fromDate(new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`));
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  throw new GoalRepositoryError("Goal timestamp is invalid.");
}

function toRecord(snapshot: DocumentSnapshot<DocumentData>): GoalRecord {
  if (!snapshot.exists) throw new GoalRepositoryError("Goal document was not found after a write.");
  const data = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    name: data.name as string,
    targetAmountMinor: data.targetAmountMinor as number,
    currentAmountMinor: data.currentAmountMinor as number,
    currency: "INR",
    targetDate: timestampToIso(data.targetDate),
    ...(typeof data.category === "string" && data.category ? { category: data.category } : {}),
    ...(typeof data.notes === "string" && data.notes ? { notes: data.notes } : {}),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function toFirestoreData(input: GoalCreateInput | GoalUpdateInput): DocumentData {
  const data: DocumentData = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.targetAmountMinor !== undefined) data.targetAmountMinor = input.targetAmountMinor;
  if (input.currentAmountMinor !== undefined) data.currentAmountMinor = input.currentAmountMinor;
  if (input.targetDate !== undefined) data.targetDate = timestampForDateOnly(input.targetDate);
  if (input.category !== undefined) data.category = input.category;
  if (input.notes !== undefined) data.notes = input.notes;
  return data;
}

export class FirestoreGoalRepository implements GoalRepository {
  constructor(private readonly db?: Firestore) {}

  private database(): Firestore {
    return this.db ?? getFirebaseAdminFirestore();
  }

  async create(uid: string, input: GoalCreateInput): Promise<GoalRecord> {
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
      if (error instanceof GoalRepositoryError) throw error;
      throw new GoalRepositoryError("Could not create goal.", { cause: error });
    }
  }

  async list(uid: string, _query: GoalListQuery): Promise<GoalRecord[]> {
    try {
      const snapshot = await collectionFor(this.database(), uid).orderBy("targetDate", "asc").limit(MAX_GOALS).get();
      return snapshot.docs.map(toRecord);
    } catch (error) {
      if (error instanceof GoalRepositoryError) throw error;
      throw new GoalRepositoryError("Could not list goals.", { cause: error });
    }
  }

  async get(uid: string, goalId: string): Promise<GoalRecord | null> {
    try {
      const snapshot = await collectionFor(this.database(), uid).doc(goalId).get();
      return snapshot.exists ? toRecord(snapshot) : null;
    } catch (error) {
      throw new GoalRepositoryError("Could not retrieve goal.", { cause: error });
    }
  }

  async update(uid: string, goalId: string, input: GoalUpdateInput): Promise<GoalRecord | null> {
    try {
      const reference = collectionFor(this.database(), uid).doc(goalId);
      const existing = await reference.get();
      if (!existing.exists) return null;
      await reference.update({ ...toFirestoreData(input), updatedAt: FieldValue.serverTimestamp() });
      return toRecord(await reference.get());
    } catch (error) {
      if (error instanceof GoalRepositoryError) throw error;
      throw new GoalRepositoryError("Could not update goal.", { cause: error });
    }
  }

  async delete(uid: string, goalId: string): Promise<boolean> {
    try {
      const reference = collectionFor(this.database(), uid).doc(goalId);
      const existing = await reference.get();
      if (!existing.exists) return false;
      await reference.delete();
      return true;
    } catch (error) {
      throw new GoalRepositoryError("Could not delete goal.", { cause: error });
    }
  }
}