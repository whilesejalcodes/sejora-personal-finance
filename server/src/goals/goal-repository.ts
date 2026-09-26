import type { GoalCreateInput, GoalListQuery, GoalUpdateInput } from "../../../shared/schemas/index.js";
import type { GoalRecord } from "../../../shared/types/index.js";

export interface GoalRepository {
  create(uid: string, input: GoalCreateInput): Promise<GoalRecord>;
  list(uid: string, query: GoalListQuery): Promise<GoalRecord[]>;
  get(uid: string, goalId: string): Promise<GoalRecord | null>;
  update(uid: string, goalId: string, input: GoalUpdateInput): Promise<GoalRecord | null>;
  delete(uid: string, goalId: string): Promise<boolean>;
}

export class GoalRepositoryError extends Error {
  constructor(message = "Firestore goal operation failed.", options?: ErrorOptions) {
    super(message, options);
    this.name = "GoalRepositoryError";
  }
}