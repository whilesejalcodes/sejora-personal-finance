import { budgetCreateSchema, type BudgetCreateInput, type BudgetListQuery, type BudgetUpdateInput } from "../../../shared/schemas/index.js";
import { calculateBudgetSummary, getBudgetEndDate } from "../../../shared/budgets/calculations.js";
import type { BudgetListData, BudgetRecord, BudgetView, TransactionRecord } from "../../../shared/types/index.js";
import { ResourceNotFoundError } from "../errors.js";
import type { TransactionRepository } from "../transactions/transaction-repository.js";
import type { BudgetRepository } from "./budget-repository.js";

const TRANSACTION_PAGE_SIZE = 50;

function normalizedCreateInput(input: BudgetCreateInput): BudgetCreateInput {
  return {
    ...input,
    endDate: input.endDate ?? getBudgetEndDate({ startDate: input.startDate }),
  };
}

function completeInput(existing: BudgetRecord, input: BudgetUpdateInput): BudgetCreateInput {
  return budgetCreateSchema.parse({
    name: input.name ?? existing.name,
    ...(input.category !== undefined ? { category: input.category } : existing.category ? { category: existing.category } : {}),
    amountMinor: input.amountMinor ?? existing.amountMinor,
    period: input.period ?? existing.period,
    startDate: input.startDate ?? existing.startDate.slice(0, 10),
    endDate: input.endDate ?? existing.endDate?.slice(0, 10) ?? getBudgetEndDate(existing),
  });
}

export class BudgetService {
  constructor(
    private readonly repository: BudgetRepository,
    private readonly transactionRepository: TransactionRepository,
  ) {}

  private async transactionsForBudget(uid: string, budget: BudgetRecord): Promise<TransactionRecord[]> {
    const transactions: TransactionRecord[] = [];
    let pageToken: string | undefined;
    do {
      const page = await this.transactionRepository.list(uid, {
        pageSize: TRANSACTION_PAGE_SIZE,
        from: budget.startDate.slice(0, 10),
        to: getBudgetEndDate(budget),
        type: "expense",
        sort: "oldest",
        ...(budget.category ? { category: budget.category } : {}),
        ...(pageToken ? { pageToken } : {}),
      });
      transactions.push(...page.items);
      pageToken = page.hasNextPage ? page.nextCursor ?? undefined : undefined;
    } while (pageToken);
    return transactions;
  }

  private async view(uid: string, budget: BudgetRecord): Promise<BudgetView> {
    const transactions = await this.transactionsForBudget(uid, budget);
    return { ...budget, ...calculateBudgetSummary(budget, transactions) };
  }

  async create(uid: string, input: BudgetCreateInput): Promise<BudgetView> {
    const budget = await this.repository.create(uid, normalizedCreateInput(input));
    return this.view(uid, budget);
  }

  async list(uid: string, query: BudgetListQuery): Promise<BudgetListData> {
    const budgets = await this.repository.list(uid, query);
    return { items: await Promise.all(budgets.map((budget) => this.view(uid, budget))) };
  }

  async get(uid: string, budgetId: string): Promise<BudgetView> {
    const budget = await this.repository.get(uid, budgetId);
    if (!budget) throw new ResourceNotFoundError("Budget");
    return this.view(uid, budget);
  }

  async update(uid: string, budgetId: string, input: BudgetUpdateInput): Promise<BudgetView> {
    const existing = await this.repository.get(uid, budgetId);
    if (!existing) throw new ResourceNotFoundError("Budget");
    const updated = await this.repository.update(uid, budgetId, completeInput(existing, input));
    if (!updated) throw new ResourceNotFoundError("Budget");
    return this.view(uid, updated);
  }

  async delete(uid: string, budgetId: string): Promise<void> {
    const deleted = await this.repository.delete(uid, budgetId);
    if (!deleted) throw new ResourceNotFoundError("Budget");
  }
}