import type { BudgetCreateInput, BudgetListQuery, BudgetUpdateInput } from "../../../shared/schemas/index.js";
import type { BudgetRecord } from "../../../shared/types/index.js";

export interface BudgetRepository {
  create(uid: string, input: BudgetCreateInput): Promise<BudgetRecord>;
  list(uid: string, query: BudgetListQuery): Promise<BudgetRecord[]>;
  get(uid: string, budgetId: string): Promise<BudgetRecord | null>;
  update(uid: string, budgetId: string, input: BudgetUpdateInput): Promise<BudgetRecord | null>;
  delete(uid: string, budgetId: string): Promise<boolean>;
}

export class BudgetRepositoryError extends Error {
  constructor(message = "Firestore budget operation failed.", options?: ErrorOptions) {
    super(message, options);
    this.name = "BudgetRepositoryError";
  }
}